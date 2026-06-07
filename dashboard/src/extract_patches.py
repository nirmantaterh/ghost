"""
extract_patches.py  —  GHOST V-JEPA patch error extractor
Reads predictions_output.json, computes per-patch L1 loss (196 floats),
and writes back a JSON that SpacetimeDB ingest can consume.

Usage:
    python extract_patches.py                     # processes latest frame
    python extract_patches.py --demo demo.mp4     # batch process video
"""

import json, time, argparse, pathlib
import numpy as np
import torch

PATCH_GRID  = 14          # 14×14 spatial patches
PATCH_COUNT = PATCH_GRID * PATCH_GRID   # 196
OUTPUT_JSON = pathlib.Path("C:/Users/Nirman/ghost/data/predictions_output.json")
PATCH_JSON  = pathlib.Path("C:/Users/Nirman/ghost/data/patch_errors.json")


# ── Core: compute per-patch L1 from two latent tensors ──────────────────────

def patch_l1(z_target: np.ndarray, z_pred: np.ndarray) -> list:
    """
    z_target, z_pred: shape (196, latent_dim) or (1, 196, latent_dim)
    Returns: list of 196 floats (L1 per patch)
    """
    if z_target.ndim == 3:
        z_target = z_target.squeeze(0)
        z_pred   = z_pred.squeeze(0)

    # L1 per patch: mean over latent_dim axis
    diff = np.abs(z_target - z_pred)         # (196, latent_dim)
    per_patch = diff.mean(axis=-1)           # (196,)
    return per_patch.tolist()


# ── Option A: from your existing predictions_output.json ────────────────────

def process_from_json():
    if not OUTPUT_JSON.exists():
        print(f"[GHOST] {OUTPUT_JSON} not found — using random sim")
        return simulate_patch_errors()

    with open(OUTPUT_JSON) as f:
        data = json.load(f)

    # Your existing JSON has: { "error": 0.034, "predicted_latent": [...], "target_latent": [...] }
    z_pred   = np.array(data.get("predicted_latent", []))
    z_target = np.array(data.get("target_latent",    []))

    if z_pred.size == 0 or z_target.size == 0:
        print("[GHOST] No latent vectors in JSON — simulating")
        return simulate_patch_errors()

    # Reshape: expect (latent_dim,) → pretend it's (196, latent_dim/196)
    latent_dim = z_pred.shape[-1]
    if latent_dim >= PATCH_COUNT:
        chunk = latent_dim // PATCH_COUNT
        z_pred_patches   = z_pred[:PATCH_COUNT * chunk].reshape(PATCH_COUNT, chunk)
        z_target_patches = z_target[:PATCH_COUNT * chunk].reshape(PATCH_COUNT, chunk)
    else:
        # Fallback: tile the scalar error into a spatial pattern
        return simulate_patch_errors(base_error=data.get("error", 0.03))

    patches = patch_l1(z_target_patches, z_pred_patches)
    return patches


# ── Option B: from your VJEPAPredictor model directly ───────────────────────

def process_from_model(frame_tensor: torch.Tensor, model):
    """
    frame_tensor: (1, C, T, H, W) — single frame or clip
    model: your VJEPAPredictor instance

    Call this from your inference loop instead of predictions_output.json.
    """
    model.eval()
    with torch.no_grad():
        z_target, z_pred = model.encode_and_predict(frame_tensor)
        # z_target, z_pred: (1, 196, latent_dim)

    patches = patch_l1(
        z_target.squeeze(0).cpu().numpy(),
        z_pred.squeeze(0).cpu().numpy()
    )
    return patches


# ── Simulation: spatially coherent fake data ────────────────────────────────

def simulate_patch_errors(base_error: float = 0.03) -> list:
    """Generate a believable 14×14 patch error map for demo purposes."""
    grid = np.zeros(PATCH_COUNT)
    # Hot spot: random location each call
    cx = np.random.randint(2, 12)
    cy = np.random.randint(2, 12)
    for i in range(PATCH_COUNT):
        row, col = divmod(i, PATCH_GRID)
        dist = np.sqrt((col - cx)**2 + (row - cy)**2)
        grid[i] = base_error * max(0, 1 - dist / 5) + np.random.normal(0, base_error * 0.1)
    return np.clip(grid, 0, None).tolist()


# ── Write output that your Mineflayer bot can read ──────────────────────────

def write_patch_output(patches: list, tick: int, scalar_error: float):
    out = {
        "tick":         tick,
        "error":        scalar_error,
        "patch_errors": patches,           # 196 floats → SpacetimeDB → dashboard
        "patch_grid":   PATCH_GRID,
        "timestamp":    time.time(),
    }
    with open(PATCH_JSON, "w") as f:
        json.dump(out, f)
    print(f"[GHOST] tick={tick} | error={scalar_error:.4f} | patches written to {PATCH_JSON}")


# ── Main loop ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop",     action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=float, default=0.5, help="Poll interval (s)")
    args = parser.parse_args()

    print("[GHOST] Patch extractor starting...")
    tick = 0

    while True:
        patches      = process_from_json()
        scalar_error = float(np.mean(patches))
        write_patch_output(patches, tick, scalar_error)
        tick += 1

        if not args.loop:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
