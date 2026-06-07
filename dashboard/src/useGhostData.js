import { useEffect, useState, useRef } from 'react';

export function useGhostData(db) {
  const [botState, setBotState]           = useState(null);
  const [predictionErrors, setPredictionErrors] = useState([]);
  const [connected, setConnected]         = useState(false);
  const [tick, setTick]                   = useState(0);
  const simRef = useRef(null);

  const norm = (row) => ({
    x: row?.x ?? row?.pos_x ?? row?.position?.x ?? 0,
    y: row?.y ?? row?.pos_y ?? row?.position?.y ?? 64,
    z: row?.z ?? row?.pos_z ?? row?.position?.z ?? 0,
    tick: row?.tick ?? 0,
  });

  useEffect(() => {
    let didConnect = false;

    // ── Try db prop (SpacetimeDB client passed from main.jsx) ──
    if (db) {
      try {
        // New SDK (v1.x): db.db.botState
        if (db.db?.botState) {
          db.db.botState.onInsert?.((ctx, row) => {
            didConnect = true; setConnected(true);
            setBotState(norm(row)); setTick(row.tick || 0);
          });
          db.db.botState.onUpdate?.((ctx, _, row) => {
            setBotState(norm(row)); setTick(row.tick || 0);
          });
          db.db.predictionError?.onInsert?.((ctx, row) =>
            setPredictionErrors(p => [...p.slice(-99), row])
          );
          didConnect = true; setConnected(true);
          console.log('[GHOST] Connected via db.db.botState');
        }
        // Old SDK (v0.x): db.onInsert
        else if (typeof db.onInsert === 'function') {
          db.onInsert('bot_state', row => {
            didConnect = true; setConnected(true);
            setBotState(norm(row)); setTick(row.tick || 0);
          });
          db.onInsert('prediction_error', row =>
            setPredictionErrors(p => [...p.slice(-99), row])
          );
          didConnect = true; setConnected(true);
          console.log('[GHOST] Connected via db.onInsert');
        }
      } catch (err) {
        console.warn('[GHOST] db prop failed:', err.message);
      }
    }

    // ── Simulation fallback after 1.5s if no real connection ──
    const timeout = setTimeout(() => {
      if (didConnect) return;
      console.log('[GHOST] No SpacetimeDB connection — running simulation');
      let t = 0;
      simRef.current = setInterval(() => {
        t += 0.05;
        setBotState({
          x: Math.sin(t * 0.4) * 12,
          y: 64 + Math.sin(t * 0.8) * 2,
          z: Math.sin(t * 0.2) * Math.cos(t * 0.3) * 12,
        });
        setTick(v => v + 1);
        setPredictionErrors(p => [...p.slice(-99), {
          error: Math.max(0, 0.02 + Math.random() * 0.06 + Math.sin(t) * 0.02),
          tick: Math.floor(t * 20),
          action: ['forward', 'jump', 'break'][Math.floor(t * 5) % 3],
        }]);
      }, 200);
    }, 1500);

    return () => {
      clearTimeout(timeout);
      if (simRef.current) clearInterval(simRef.current);
    };
  }, [db]);

  return { botState, predictionErrors, connected, tick };
}
