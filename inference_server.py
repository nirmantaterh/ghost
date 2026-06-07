import torch
import torch.nn as nn
import numpy as np
from PIL import Image
import json
import time
import os

class VJEPAPredictor(nn.Module):
    def __init__(self, latent_dim=256):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(3, 32, 4, stride=2, padding=1), nn.ReLU(),
            nn.Conv2d(32, 64, 4, stride=2, padding=1), nn.ReLU(),
            nn.Conv2d(64, 128, 4, stride=2, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.encoder_proj = nn.Linear(128, latent_dim)
        self.action_embed = nn.Embedding(3, 64)
        self.predictor = nn.Sequential(
            nn.Linear(latent_dim + 64, 512), nn.ReLU(),
            nn.Linear(512, 512), nn.ReLU(),
            nn.Linear(512, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 512), nn.ReLU(),
            nn.Linear(512, 128 * 8 * 8),
        )
        self.decoder_conv = nn.Sequential(
            nn.ConvTranspose2d(128, 64, 4, stride=2, padding=1), nn.ReLU(),
            nn.ConvTranspose2d(64, 32, 4, stride=2, padding=1), nn.ReLU(),
            nn.ConvTranspose2d(32, 3, 4, stride=2, padding=1), nn.Sigmoid(),
        )
    
    def forward(self, frame_t, action):
        x = self.encoder(frame_t)
        x = x.view(x.size(0), -1)
        latent_t = self.encoder_proj(x)
        action_emb = self.action_embed(action)
        combined = torch.cat([latent_t, action_emb], dim=1)
        latent_pred = self.predictor(combined)
        x = self.decoder(latent_pred)
        x = x.view(x.size(0), 128, 8, 8)
        frame_pred = self.decoder_conv(x)
        return frame_pred

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = VJEPAPredictor().to(device)
model.load_state_dict(torch.load('vjepa_minerl.pt', map_location=device))
model.eval()

frames = np.load(r'data\frames.npy')

print("Inference server ready. Waiting for requests...")

# Simulate predictions every 2 seconds
action_names = ["forward", "jump", "break"]
frame_idx = 100

while True:
    # Pick random frame
    frame_idx = np.random.randint(100, 200)
    
    frame_t = torch.tensor(frames[frame_idx], dtype=torch.float32).permute(2, 0, 1).unsqueeze(0) / 255.0
    frame_t = frame_t.to(device)
    
    predictions = {}
    with torch.no_grad():
        for action_id, action_name in enumerate(action_names):
            action_tensor = torch.tensor([action_id]).to(device)
            pred = model(frame_t, action_tensor)
            pred_img = pred.cpu().numpy()[0].transpose(1, 2, 0)
            # Calculate simple error (MSE)
            actual = frames[frame_idx+1] / 255.0
            error = np.mean((pred_img - actual) ** 2)
            predictions[action_name] = float(error)
    
    # Write to JSON file that bot reads
    output = {
        "frame_idx": int(frame_idx),
        "timestamp": time.time(),
        "predictions": predictions,
        "status": "ready"
    }
    
    with open('predictions_output.json', 'w') as f:
        json.dump(output, f)
    
    print(f"Frame {frame_idx}: {predictions}")
    time.sleep(2)