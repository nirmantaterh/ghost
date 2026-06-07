import mineflayer from 'mineflayer';
import { DbConnection } from './module_bindings/index.ts';
import dgram from 'dgram';

const db = await new Promise((resolve, reject) => {
  DbConnection.builder()
    .withUri('ws://localhost:3000')
    .withDatabaseName('ghost')
    .onConnect((conn) => resolve(conn))
    .onConnectError((ctx, e) => reject(e))
    .build()
});

console.log('[STDB] connected');

const udp = dgram.createSocket('udp4');
udp.bind(9001);

let prediction = { x: 0, y: 64, z: 0 };
udp.on('message', (msg) => {
  try { prediction = JSON.parse(msg.toString()); } catch {}
});

let tickCount = 0;
let lastKnownPosition = { x: 0, y: 64, z: 0 };
let pendingTeleport = null;
let activeBot = null;
let movementInterval = null;
let movementPulse = null;
let movementMode = 0;
let roamHeading = 0;
let roamPitch = 0;
let sprintBoostUntil = 0;
let rescueBurstUntil = 0;
let alignmentShowcaseUntil = 0;
let alignmentBurstInterval = null;
let manualControls = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
};

function hasManualControl() {
  return Object.values(manualControls).some(Boolean);
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function applyManualControls(bot) {
  clearMovement(bot);
  for (const [control, active] of Object.entries(manualControls)) {
    bot.setControlState(control, active);
  }
}

function stopAlignmentBurst() {
  if (alignmentBurstInterval) {
    clearInterval(alignmentBurstInterval);
    alignmentBurstInterval = null;
  }
}

function setManualControl(bot, control, active) {
  if (!(control in manualControls)) return;
  manualControls[control] = active;
  if (active) {
    sprintBoostUntil = Date.now() + 7000;
  }
  applyManualControls(bot);
}

db.db.challenge.onInsert((ctx, row) => {
  const challengeType = String(row?.challengeType || '').trim().toLowerCase();
  if (!challengeType) return;

  console.log('[challenge]', challengeType, 'id=', row?.id);
  if (challengeType.startsWith('key:')) {
    const [, control, state] = challengeType.split(':');
    const pressed = state === 'down';
    if (activeBot) {
      setManualControl(activeBot, control, pressed);
    }
    return;
  }

  if (challengeType === 'teleport') {
    if (!activeBot || !applyTeleport(activeBot)) {
      pendingTeleport = {
        id: row.id,
      };
      return;
    }
    publishSnapshot(activeBot, true);
    return;
  }

  if (challengeType === 'sprint') {
    if (!activeBot) return;
    sprintBoostUntil = Date.now() + 7000;
    movementMode = 0;
    if (!hasManualControl()) {
      clearMovement(activeBot);
      activeBot.setControlState('sprint', true);
      activeBot.setControlState('forward', true);
      activeBot.setControlState('jump', true);
      setTimeout(() => {
        if (activeBot) activeBot.setControlState('jump', false);
      }, 250);
    }
    publishSnapshot(activeBot, true);
    return;
  }

  if (challengeType === 'align') {
    if (!activeBot) return;
    alignmentShowcaseUntil = Date.now() + 2200;
    rescueBurstUntil = Math.max(rescueBurstUntil, alignmentShowcaseUntil);
    sprintBoostUntil = 0;
    stopAlignmentBurst();
    clearMovement(activeBot);
    publishSnapshot(activeBot, false);

    const live = readPosition(activeBot);
    const currentPrediction = {
      x: Number(prediction.x) || live.x,
      y: Number(prediction.y) || live.y,
      z: Number(prediction.z) || live.z,
    };
    const burstSteps = 12;
    let step = 0;

    alignmentBurstInterval = setInterval(() => {
      if (!activeBot) {
        stopAlignmentBurst();
        return;
      }

      const blend = Math.min(1, (step + 1) / burstSteps);
      const eased = blend * blend * (3 - 2 * blend);
      const wobble = Math.sin((step + 1) * 1.35) * (2.8 * (1 - blend * 0.55));
      const sideSwing = Math.cos((step + 1) * 1.05) * (1.9 * (1 - blend * 0.45));
      const settle = (live.x - currentPrediction.x) * eased * 0.72;
      const settleY = (live.y - currentPrediction.y) * eased * 0.72;
      const settleZ = (live.z - currentPrediction.z) * eased * 0.72;
      const px = live.x + wobble * 0.65 + settle;
      const py = live.y + sideSwing * 0.38 + settleY;
      const pz = live.z - wobble * 0.42 + settleZ;

      writeReducerObject(db.reducers.recordPrediction, {
        tick: tickCount + step,
        px,
        py,
        pz,
        ax: live.x,
        ay: live.y,
        az: live.z,
      });

      step += 1;
      if (step >= burstSteps) {
        stopAlignmentBurst();
      }
    }, 120);
  }
});

db.subscriptionBuilder().subscribe('SELECT * FROM challenge');

function readPosition(bot) {
  const x = Number(bot.entity?.position?.x);
  const y = Number(bot.entity?.position?.y);
  const z = Number(bot.entity?.position?.z);

  return {
    x: Number.isFinite(x) ? x : lastKnownPosition.x,
    y: Number.isFinite(y) ? y : lastKnownPosition.y,
    z: Number.isFinite(z) ? z : lastKnownPosition.z,
  };
}

function writeReducerObject(method, params) {
  return method(params);
}

function applyTeleport(bot) {
  if (!bot.entity?.position) return false;

  const current = readPosition(bot);
  const offset = 24 + Math.random() * 12;
  const direction = Math.random() < 0.5 ? -1 : 1;
  const target = {
    x: current.x + offset * direction,
    y: Math.max(2, Math.min(120, current.y + (Math.random() * 4 - 2))),
    z: current.z - offset * direction,
  };

  if (typeof bot.entity.position.set === 'function') {
    bot.entity.position.set(target.x, target.y, target.z);
  } else if (bot.entity.position.offset) {
    bot.entity.position = bot.entity.position.offset(
      target.x - current.x,
      target.y - current.y,
      target.z - current.z
    );
  }

  console.log('[challenge] teleport applied', target.x.toFixed(1), target.y.toFixed(1), target.z.toFixed(1));
  return true;
}

function clearMovement(bot) {
  for (const control of ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak']) {
    bot.setControlState(control, false);
  }
}

function scheduleMovement(bot) {
  if (movementInterval) {
    clearInterval(movementInterval);
  }
  if (movementPulse) {
    clearInterval(movementPulse);
  }

  movementMode = 0;
  roamHeading = Math.random() * Math.PI * 2;
  roamPitch = 0;
  clearMovement(bot);

  movementInterval = setInterval(() => {
    if (hasManualControl()) {
      applyManualControls(bot);
      return;
    }

    if (Date.now() < alignmentShowcaseUntil) {
      clearMovement(bot);
      bot.setControlState('sprint', false);
      bot.look(roamHeading, roamPitch, true);
      return;
    }

    const rescue = Date.now() < rescueBurstUntil;
    movementMode = (movementMode + 1) % 8;
    const pattern = [
      { forward: true,  left: false, right: false, back: false, jump: false, yaw: 0.0 },
      { forward: true,  left: true,  right: false, back: false, jump: false, yaw: Math.PI / 2 },
      { forward: true,  left: false, right: true,  back: false, jump: false, yaw: -Math.PI / 2 },
      { forward: false, left: false, right: false, back: true,  jump: true,  yaw: Math.PI },
      { forward: true,  left: true,  right: false, back: false, jump: true,  yaw: Math.PI / 3 },
      { forward: true,  left: false, right: true,  back: false, jump: true,  yaw: -Math.PI / 3 },
      { forward: false, left: true,  right: false, back: true,  jump: false, yaw: Math.PI / 4 },
      { forward: true,  left: false, right: false, back: false, jump: true,  yaw: -Math.PI / 4 },
    ][movementMode];

    roamHeading = wrapAngle(roamHeading + pattern.yaw + (rescue ? ((Math.random() * 1.0) - 0.5) : ((Math.random() * 0.55) - 0.275)));
    roamPitch = Math.max(-0.25, Math.min(0.22, roamPitch + (rescue ? ((Math.random() * 0.16) - 0.08) : ((Math.random() * 0.08) - 0.04))));
    clearMovement(bot);

    bot.setControlState('sprint', true);
    bot.look(roamHeading, roamPitch, true);

    const boosting = rescue || Date.now() < sprintBoostUntil;

    bot.setControlState('forward', pattern.forward || (boosting && !pattern.back));
    bot.setControlState('back', pattern.back && !boosting ? true : pattern.back && !pattern.forward);
    bot.setControlState('left', pattern.left || (boosting && movementMode % 2 === 0));
    bot.setControlState('right', pattern.right || (boosting && movementMode % 2 === 1));
    if (pattern.jump || boosting) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), rescue ? 140 : 220);
    }

    if (boosting) {
      bot.setControlState('sprint', true);
      bot.setControlState('forward', true);
      if (movementMode === 1) {
        bot.setControlState('left', true);
      } else if (movementMode === 2) {
        bot.setControlState('right', true);
      } else if (movementMode === 3) {
        bot.setControlState('back', true);
      } else {
        bot.setControlState('jump', true);
      }
      if (rescue) {
        bot.setControlState('jump', true);
      }
    }
  }, 420);

  movementPulse = setInterval(() => {
    if (hasManualControl()) return;
    if (Date.now() < alignmentShowcaseUntil) return;
    const rescue = Date.now() < rescueBurstUntil;
    roamHeading = wrapAngle(roamHeading + (rescue ? ((Math.random() * 1.15) - 0.575) : ((Math.random() * 0.65) - 0.325)));
    roamPitch = Math.max(-0.28, Math.min(0.24, roamPitch + (rescue ? ((Math.random() * 0.16) - 0.08) : ((Math.random() * 0.1) - 0.05))));
    bot.look(roamHeading, roamPitch, true);
    bot.setControlState('sprint', true);
    bot.setControlState('forward', true);
    if (rescue) {
      bot.setControlState('left', Math.random() > 0.5);
      bot.setControlState('right', Math.random() > 0.5);
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 140);
    }
  }, 180);
}

function publishSnapshot(bot, forceSpike = false) {
  const { x, y, z } = readPosition(bot);
  const health = Number(bot.health) || 20;
  const biome = bot.biome?.name || 'unknown';
  const yaw = Number(bot.entity?.yaw) || 0;
  const pitch = Number(bot.entity?.pitch) || 0;
  const motionDelta = Math.abs(x - lastKnownPosition.x) + Math.abs(z - lastKnownPosition.z);

  if (tickCount > 30 && motionDelta < 0.03) {
    rescueBurstUntil = Date.now() + 4500;
  }

  if (forceSpike || tickCount > 20) {
    const px = forceSpike ? lastKnownPosition.x : Number(prediction.x) || 0;
    const py = forceSpike ? lastKnownPosition.y : Number(prediction.y) || 64;
    const pz = forceSpike ? lastKnownPosition.z : Number(prediction.z) || 0;
    writeReducerObject(db.reducers.recordPrediction, {
      tick: tickCount,
      px,
      py,
      pz,
      ax: x,
      ay: y,
      az: z,
    });
  }

  writeReducerObject(db.reducers.updateBotState, {
    x,
    y,
    z,
    health,
    biome,
    tick: tickCount,
  });
  udp.send(JSON.stringify({ tick: tickCount, x, y, z, yaw, pitch, health }), 9002, 'localhost');
  console.log('[tick]', tickCount, 'pos=', x.toFixed(1), y.toFixed(1), z.toFixed(1));
  lastKnownPosition = { x, y, z };
}

function createBot() {
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'GHOST_bot',
    version: '1.20.6',
  });

  bot.on('physicsTick', () => {
    tickCount++;
    if (hasManualControl()) {
      applyManualControls(bot);
    }
    if (tickCount % 10 !== 0) return;
    if (!bot.entity) return;

    try {
      let teleportThisTick = false;

      if (pendingTeleport) {
        applyTeleport(bot);
        teleportThisTick = true;
        pendingTeleport = null;
      }

      publishSnapshot(bot, teleportThisTick);
    } catch(e) {
      console.error('[tick error]', e.message);
    }
  });

  bot.once('spawn', () => {
    activeBot = bot;
    lastKnownPosition = readPosition(bot);
    console.log('[bot] spawned');
    scheduleMovement(bot);
  });

  bot.on('end', (reason) => {
    console.log('[bot] disconnected:', reason, '-- reconnecting in 3s');
    if (movementInterval) {
      clearInterval(movementInterval);
      movementInterval = null;
    }
    if (movementPulse) {
      clearInterval(movementPulse);
      movementPulse = null;
    }
    stopAlignmentBurst();
    if (activeBot === bot) {
      activeBot = null;
    }
    manualControls = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    };
    alignmentShowcaseUntil = 0;
    setTimeout(createBot, 3000);
  });

  bot.on('error', (e) => console.error('[bot error]', e.message));

  return bot;
}

createBot();
