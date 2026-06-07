import React, { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('in'); // in | hold | out

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('out'),  3200);
    const t3 = setTimeout(() => onDone(),          3800);
    return () => [t1,t2,t3].forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#020812',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 32,
      opacity: phase === 'out' ? 0 : 1,
      transition: phase === 'in' ? 'opacity 0.4s' : 'opacity 0.6s',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Hex bg */}
      <div style={{
        position:'absolute', inset:0, opacity:.04,
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0-2l26-15V18L28 2 2 18v31l26 15z' fill='%2300d4ff'/%3E%3C/svg%3E")`,
      }}/>

      {/* Logo */}
      <div style={{ textAlign:'center', opacity: phase === 'hold' || phase === 'out' ? 1 : 0, transition: 'opacity 0.5s' }}>
        <div style={{
          fontFamily:"'Orbitron', monospace",
          fontSize: 64, fontWeight: 900,
          color: '#00d4ff',
          letterSpacing: 12,
          textShadow: '0 0 40px rgba(0,212,255,0.8), 0 0 80px rgba(0,212,255,0.3)',
          marginBottom: 8,
        }}>G.H.O.S.T</div>
        <div style={{
          fontFamily:"'Orbitron', monospace",
          fontSize: 13, fontWeight: 400,
          color: 'rgba(0,212,255,0.5)',
          letterSpacing: 6,
          marginBottom: 32,
        }}>OBSERVABILITY PLATFORM</div>

        {/* Divider */}
        <div style={{ width: 480, height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)', margin: '0 auto 28px' }}/>

        {/* Pitch line 1 */}
        <div style={{
          maxWidth: 560, fontSize: 13, lineHeight: 1.7,
          color: 'rgba(226,243,255,0.85)',
          textAlign: 'center', letterSpacing: 0.3, marginBottom: 20,
        }}>
          An observability platform for self-supervised world models.<br/>
          We ingest training session batches, pipe high-dimensional latent vectors<br/>
          into SpacetimeDB, and map the precise spatial patches where the<br/>
          predictive engine experiences structural breakdown.
        </div>

        {/* Tag */}
        <div style={{
          display: 'inline-block',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 3,
          padding: '6px 18px',
          fontSize: 11,
          color: 'rgba(0,212,255,0.6)',
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}>A debug dashboard for the future of world simulation</div>
      </div>

      {/* Loading bar */}
      <div style={{ width: 320, height: 2, background: 'rgba(0,212,255,0.1)', borderRadius: 2, overflow:'hidden' }}>
        <div style={{
          height: '100%', background: '#00d4ff',
          boxShadow: '0 0 8px rgba(0,212,255,0.8)',
          width: phase === 'hold' || phase === 'out' ? '100%' : '0%',
          transition: 'width 2.8s linear',
        }}/>
      </div>

      <div style={{ fontSize: 9, color: 'rgba(0,212,255,0.3)', letterSpacing: 3 }}>
        V-JEPA · SPACETIMEDB · 14×14 PATCH TOKENIZATION · 275K FRAMES
      </div>
    </div>
  );
}
