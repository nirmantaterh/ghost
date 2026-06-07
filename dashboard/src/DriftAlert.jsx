import React, { useEffect, useRef, useState } from 'react';

export default function DriftAlert({ l1Loss, threshold = 0.06, onRealign }) {
  const [state, setState] = useState('idle');   // idle | breach | realigning | resolved
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef(null);
  const prevBreachRef = useRef(false);

  useEffect(() => {
    const isBreaching = l1Loss > threshold;

    if (isBreaching && !prevBreachRef.current && state === 'idle') {
      // Breach just started
      prevBreachRef.current = true;
      setState('breach');
      setCountdown(3);

      // Auto-realign after 3s
      let c = 3;
      timerRef.current = setInterval(() => {
        c -= 1;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(timerRef.current);
          setState('realigning');
          onRealign?.();   // trigger converge in the 3D view
          setTimeout(() => setState('resolved'), 1800);
          setTimeout(() => { setState('idle'); prevBreachRef.current = false; }, 3500);
        }
      }, 1000);
    }

    if (!isBreaching && prevBreachRef.current && state === 'idle') {
      prevBreachRef.current = false;
    }

    return () => {};
  }, [l1Loss, state]);

  const handleManualRealign = () => {
    clearInterval(timerRef.current);
    setState('realigning');
    onRealign?.();
    setTimeout(() => setState('resolved'), 1800);
    setTimeout(() => { setState('idle'); prevBreachRef.current = false; }, 3500);
  };

  if (state === 'idle') return null;

  const colors = {
    breach:     { border: '#ff4545', bg: 'rgba(255,69,69,0.08)',   text: '#ff4545', glow: 'rgba(255,69,69,0.4)' },
    realigning: { border: '#ffb830', bg: 'rgba(255,184,48,0.08)',  text: '#ffb830', glow: 'rgba(255,184,48,0.4)' },
    resolved:   { border: '#00ff9f', bg: 'rgba(0,255,159,0.08)',   text: '#00ff9f', glow: 'rgba(0,255,159,0.4)' },
  };
  const c = colors[state] || colors.breach;

  return (
    <>
      {/* Full-screen flash on breach */}
      {state === 'breach' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 8888, pointerEvents: 'none',
          border: `2px solid ${c.border}`,
          boxShadow: `inset 0 0 60px ${c.glow}`,
          animation: 'drift-flash 0.4s ease-in-out infinite alternate',
        }}/>
      )}

      {/* Alert banner */}
      <div style={{
        position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9000,
        background: c.bg,
        border: `1px solid ${c.border}`,
        boxShadow: `0 0 20px ${c.glow}, 0 0 40px ${c.glow}`,
        borderRadius: 4,
        padding: '12px 24px',
        fontFamily: "'Orbitron', monospace",
        display: 'flex', alignItems: 'center', gap: 20,
        animation: state === 'breach' ? 'drift-pulse 0.6s ease-in-out infinite alternate' : 'none',
        minWidth: 480,
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, letterSpacing: 2, marginBottom: 4 }}>
            {state === 'breach'     && `⚠ DRIFT THRESHOLD EXCEEDED  —  L1: ${l1Loss.toFixed(4)}`}
            {state === 'realigning' && '⟳ ENFORCING STATE REALIGNMENT...'}
            {state === 'resolved'   && '✓ EMBEDDINGS SYNCHRONIZED — DRIFT RESOLVED'}
          </div>
          <div style={{ fontSize: 9, color: `${c.text}99`, letterSpacing: 1.5 }}>
            {state === 'breach'     && `THRESHOLD: ${threshold} L1  ·  AUTO-REALIGN IN ${countdown}s  ·  SAFETY ALIGNMENT PROTOCOL ACTIVE`}
            {state === 'realigning' && 'APPLYING BOUNDARY CONSTRAINT  ·  FORCING STRUCTURAL STATE VECTOR CONSENSUS'}
            {state === 'resolved'   && 'SIMULATION DRIFT ELIMINATED  ·  LATENT DIVERGENCE NOMINAL'}
          </div>
        </div>

        {state === 'breach' && (
          <button onClick={handleManualRealign} style={{
            background: 'transparent',
            border: `1px solid ${c.border}`,
            color: c.text,
            fontFamily: "'Orbitron', monospace",
            fontSize: 10, fontWeight: 700,
            letterSpacing: 2, padding: '6px 14px',
            borderRadius: 3, cursor: 'pointer',
            flexShrink: 0,
            boxShadow: `0 0 8px ${c.glow}`,
          }}>
            REALIGN NOW
          </button>
        )}
      </div>

      <style>{`
        @keyframes drift-flash {
          from { opacity: 0.3; }
          to   { opacity: 1; }
        }
        @keyframes drift-pulse {
          from { box-shadow: 0 0 20px ${c.glow}; }
          to   { box-shadow: 0 0 40px ${c.glow}, 0 0 80px ${c.glow}; }
        }
      `}</style>
    </>
  );
}
