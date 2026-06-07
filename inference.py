import torch
import torch.nn as nn
import numpy as np
from PIL import Image
import json

# Load model (same architecture)
class FramePredictor(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(3, 32, 4, stride=2, padding=1), nn.ReLU(),
            nn.Conv2d(32, 64, 4, stride=2, padding=1), nn.ReLU(),
            nn.Conv2d(64, 128, 4, stride=2, padding=1), nn.ReLU(),
        )
        self.fc_size = 128 * 8 * 8
        self.action_embed = nn.Embedding(3, 32)
        self.predictor = nn.Sequential(
            nn.Linear(self.fc_size + 32, 512), nn.ReLU(),
            nn.Linear(512, 512), nn.ReLU(),
            nn.Linear(512, self.fc_size),
        )
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(128, 64, 4, stride=2, padding=1), nn.ReLU(),
            nn.ConvTranspose2d(64, 32, 4, stride=2, padding=1), nn.ReLU(),
            nn.ConvTranspose2d(32, 3, 4, stride=2, padding=1), nn.Sigmoid(),
        )
    
    def forward(self, frame_t, action):
        encoded = self.encoder(frame_t)
        encoded_flat = encoded.view(encoded.size(0), -1)
        action_emb = self.action_embed(action)
        combined = torch.cat([encoded_flat, action_emb], dim=1)
        latent_pred = self.predictor(combined)
        latent_reshaped = latent_pred.view(-1, 128, 8, 8)
        frame_pred = self.decoder(latent_reshaped)
        return frame_pred

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = FramePredictor().to(device)
model.load_state_dict(torch.load('model.pt'))
model.eval()

# Load frames
frames = np.load(r'data\frames.npy')
print(f"Loaded {len(frames)} frames")

# Pick a random frame
test_idx = 100
frame_t = torch.tensor(frames[test_idx], dtype=torch.float32).permute(2, 0, 1).unsqueeze(0) / 255.0
frame_t = frame_t.to(device)

# Predict all 3 actions
action_names = ["forward", "jump", "break"]
action_ids = torch.tensor([0, 1, 2]).to(device)

predictions = []
with torch.no_grad():
    for action_id in action_ids:
        action_tensor = action_id.unsqueeze(0)
        pred = model(frame_t, action_tensor)
        predictions.append(pred.cpu().numpy()[0].transpose(1, 2, 0))

print(f"Predicted 3 futures for frame {test_idx}")

# Save predictions as images
for i, (name, pred) in enumerate(zip(action_names, predictions)):
    img = (pred * 255).astype(np.uint8)
    Image.fromarray(img).save(f'pred_{name}.png')
    print(f"Saved pred_{name}.png")