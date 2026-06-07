import json
import socket
import threading
import time
from collections import deque

import numpy as np
import torch
import torch.nn as nn


class ResidualPredictor(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(8 * 5 + 3, 64),
            nn.SiLU(),
            nn.Linear(64, 64),
            nn.SiLU(),
            nn.Linear(64, 3),
            nn.Tanh(),
        )

    def forward(self, inputs):
        return self.net(inputs)


model = ResidualPredictor()
optimizer = torch.optim.Adam(model.parameters(), lr=5e-4)
loss_fn = nn.SmoothL1Loss()

history = deque(maxlen=8)
velocity_ema = np.zeros(3, dtype=np.float32)
last_training_features = None
last_training_base = None
last_prediction = None

recv = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
recv.bind(("localhost", 9002))
send = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)


def pad_history(samples):
    if not samples:
        samples = [np.zeros(5, dtype=np.float32)]
    while len(samples) < 8:
        samples.insert(0, samples[0].copy())
    return np.array(samples[-8:], dtype=np.float32)


def estimate_velocity(samples):
    if len(samples) < 2:
        return np.zeros(3, dtype=np.float32)

    positions = np.array(samples, dtype=np.float32)[:, :3]
    diffs = np.diff(positions[-5:], axis=0)
    if len(diffs) == 0:
        return np.zeros(3, dtype=np.float32)
    return diffs.mean(axis=0)


def build_features(samples, velocity, health):
    history_vector = pad_history(samples).flatten()
    feature_vector = np.concatenate([
        history_vector,
        velocity.astype(np.float32),
        np.array([health / 20.0], dtype=np.float32),
    ])
    return torch.tensor(feature_vector, dtype=torch.float32).unsqueeze(0)


def predict_from_packet(packet):
    global velocity_ema, last_training_features, last_training_base, last_prediction

    sample = np.array([
        float(packet["x"]),
        float(packet["y"]),
        float(packet["z"]),
        float(packet.get("yaw", 0.0)),
        float(packet.get("health", 20.0)),
    ], dtype=np.float32)

    history.append(sample)

    if len(history) == 1:
        last_prediction = sample[:3].copy()
        return {
            "x": float(sample[0]),
            "y": float(sample[1]),
            "z": float(sample[2]),
        }

    velocity = estimate_velocity(history)
    velocity_ema = velocity_ema * 0.72 + velocity * 0.28

    current_position = sample[:3]
    base_prediction = current_position + velocity_ema * 1.25
    features = build_features(history, velocity_ema, sample[4])

    if last_training_features is not None and last_training_base is not None:
        actual = torch.tensor(current_position, dtype=torch.float32).unsqueeze(0)
        predicted_previous = last_training_base + model(last_training_features) * 0.25
        loss = loss_fn(predicted_previous, actual)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        print(f"[JEPA] tick={packet.get('tick', '?')} loss={loss.item():.4f}")

    with torch.no_grad():
        residual = model(features).squeeze(0).numpy() * 0.25

    raw_prediction = base_prediction + residual
    if last_prediction is None:
        smoothed_prediction = raw_prediction
    else:
        smoothed_prediction = last_prediction * 0.55 + raw_prediction * 0.45

    last_prediction = smoothed_prediction.astype(np.float32)
    last_training_features = features.detach()
    last_training_base = torch.tensor(base_prediction, dtype=torch.float32).unsqueeze(0)

    return {
        "x": float(last_prediction[0]),
        "y": float(last_prediction[1]),
        "z": float(last_prediction[2]),
    }


def run():
    while True:
        data, _ = recv.recvfrom(4096)
        packet = json.loads(data.decode("utf-8"))
        if len(history) < 8:
            print(f"[JEPA] warming up... {len(history)}/8")

        prediction = predict_from_packet(packet)
        send.sendto(json.dumps(prediction).encode("utf-8"), ("localhost", 9001))


threading.Thread(target=run, daemon=True).start()
print("[JEPA] predictor listening on :9002")

try:
    while True:
        time.sleep(60)
        torch.save(model.state_dict(), "predictor.pt")
        print("[JEPA] weights saved")
except KeyboardInterrupt:
    torch.save(model.state_dict(), "predictor.pt")
    print("[JEPA] stopped")
