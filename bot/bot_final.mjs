import mineflayer from 'mineflayer';
import fs from 'fs';
import { DbConnection } from './module_bindings/index.ts';

const db = await new Promise((resolve, reject) => {
  DbConnection.builder()
    .withUri('ws://localhost:3000')
    .withDatabaseName('ghost')
    .onConnect((conn) => resolve(conn))
    .onConnectError((ctx, e) => reject(e))
    .build()
});

console.log('[STDB] connected');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'GhostBot',
});

bot.on('login', () => {
  console.log('Bot logged in');
});

let tick = 0;

setInterval(async () => {
  try {
    const predictions = JSON.parse(fs.readFileSync('../predictions_output.json', 'utf8'));
    const pos = bot.entity.position;
    
    await db.update_bot_state(pos.x, pos.y, pos.z, bot.health || 20, 'overworld', tick++);
    
    await db.record_prediction(
      tick,
      pos.x,
      pos.y,
      pos.z,
      predictions.predictions.forward,
      predictions.predictions.jump,
      predictions.predictions.break
    );
    
    console.log(`Tick ${tick}: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`);
  } catch (e) {
    console.error('Error:', e.message);
  }
}, 2000);

bot.on('error', (err) => console.error(err));