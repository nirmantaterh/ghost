# Ghost - Minecraft Server with ML Inference

A Minecraft server integrated with machine learning inference for player action prediction using Vision Transformer models (JEPA/V-JEPA).

## Project Structure

- **bot/** - Discord bot integration with TypeScript bindings to SpacetimeDB
- **ghost-module/** - SpacetimeDB Rust module for server state management
- **jepa/** - Vision Transformer (JEPA/V-JEPA) inference code for predicting player actions
- **dashboard/** - Web dashboard for server monitoring and management
- **inference.py** / **inference_server.py** - Python-based inference servers for model predictions
- **mcserver/** - Paper Minecraft server configuration and plugins

## Features

- **Player Action Prediction** - Uses V-JEPA models to predict player movements (jump, break, forward)
- **Real-time State Sync** - SpacetimeDB integration for live game state synchronization
- **Bot Integration** - Discord bot for server administration and control
- **Web Dashboard** - Real-time monitoring interface

## Models

- `model.pt` - Main V-JEPA model for action prediction
- `vjepa_minerl.pt` - V-JEPA model trained on MineRL dataset

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   cd bot && npm install && cd ..
   cd ghost-module && cargo build --target wasm32-unknown-unknown --release && cd ..
   ```

2. Start the inference server:
   ```bash
   python inference_server.py
   ```

3. Start the Minecraft server:
   ```bash
   java -Xmx2G -jar server.jar nogui
   ```

## Configuration

- `server.properties` - Minecraft server settings
- `bukkit.yml` - Bukkit plugin configuration
- `spigot.yml` - Spigot server configuration
- `spacetime.json` - SpacetimeDB module configuration

## Technologies

- **Minecraft**: Paper (performance-optimized Spigot fork)
- **ML**: V-JEPA, PyTorch
- **Backend**: SpacetimeDB (WASM/Rust)
- **Bot**: Node.js with TypeScript
- **Database**: SpacetimeDB (in-memory with persistence)
