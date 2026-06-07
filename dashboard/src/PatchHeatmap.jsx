import React, { useEffect, useRef } from 'react';

// 14x14 per-patch L1 divergence heatmap — the core V-JEPA visualization
export default function PatchHeatmap({ patchErrors, tick }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const prevGrid  = useRef(Array(196).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const GRID = 14, CELL = 18, PAD = 1;
    const W = GRID * (CELL + PAD) + PAD;
    const H = W;
    canvas.width  = W;
    canvas.height = H;

    // Parse incoming patch errors (196 floats) or simulate
    let target;
    if (patchErrors && patchErrors.length === 196) {
      target = patchErrors;
    } else {
      // Simulate: random with spatial coherence
      const t = Date.now() / 1000;
      target = Array.from({ length: 196 }, (_, i) => {
        const row = Math.floor(i / GRID), col = i % GRID;
        const cx = 7 + Math.sin(t * 0.4) * 4;
        const cy = 7 + Math.cos(t * 0.3) * 4;
        const dist = Math.sqrt((col - cx) ** 2 + (row - cy) ** 2);
        const base = Math.max(0, 1 - dist / 6);
        return base * (0.05 + Math.sin(t * 2 + i * 0.1) * 0.02 + Math.random() * 0.005);
      });
    }

    // Lerp toward target
    const current = prevGrid.current.map((v, i) => v + (target[i] - v) * 0.12);
    prevGrid.current = current;

    // Find max for normalization
    const maxVal = Math.max(...current, 0.001);

    // Draw
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < 196; i++) {
      const row = Math.floor(i / GRID);
      const col = i % GRID;
      const x   = PAD + col * (CELL + PAD);
      const y   = PAD + row * (CELL + PAD);
      const norm = current[i] / maxVal;

      // Color: deep blue → cyan → yellow → red
      let r, g, b;
      if (norm < 0.33) {
        const t = norm / 0.33;
        r = Math.round(0   + t * 0);
        g = Math.round(40  + t * 172);
        b = Math.round(120 + t * 135);
      } else if (norm < 0.66) {
        const t = (norm - 0.33) / 0.33;
        r = Math.round(0   + t * 255);
        g = Math.round(212 + t * 43);
        b = Math.round(255 + t * -255);
      } else {
        const t = (norm - 0.66) / 0.34;
        r = 255;
        g = Math.round(255 - t * 255);
        b = 0;
      }

      const alpha = 0.3 + norm * 0.7;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(x, y, CELL, CELL);

      // Bright cell border for high-error patches
      if (norm > 0.75) {
        ctx.strokeStyle = `rgba(255,${Math.round(255 * (1-norm))},0,0.8)`;
        ctx.lineWidth   = 1;
        ctx.strokeRect(x, y, CELL, CELL);
      }
    }

    // Grid overlay
    ctx.strokeStyle = 'rgba(0,212,255,0.08)';
    ctx.lineWidth   = 0.5;
    for (let i = 0; i <= GRID; i++) {
      const v = PAD + i * (CELL + PAD) - PAD / 2;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke();
    }

    // Patch count label
    ctx.fillStyle   = 'rgba(0,212,255,0.4)';
    ctx.font        = '7px JetBrains Mono, monospace';
    ctx.textAlign   = 'left';
    ctx.fillText(`14×14 = 196 PATCHES`, 2, H - 2);

    animRef.current = requestAnimationFrame(() => {});
  }, [patchErrors, tick]);

  // Continuous animation when no real data
  useEffect(() => {
    if (patchErrors && patchErrors.length === 196) return;
    let frame;
    const loop = () => {
      canvasRef.current && canvasRef.current.dispatchEvent(new Event('redraw'));
      // Re-render by forcing a fake tick
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [patchErrors]);

  // Self-animating when simulating
  const intervalRef = useRef(null);
  useEffect(() => {
    if (patchErrors && patchErrors.length === 196) return;
    intervalRef.current = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const GRID = 14, CELL = 18, PAD = 1;
      const W = canvas.width, H = canvas.height;
      const t = Date.now() / 1000;

      const current = prevGrid.current.map((v, i) => {
        const row = Math.floor(i / GRID), col = i % GRID;
        const cx = 7 + Math.sin(t * 0.4) * 4;
        const cy = 7 + Math.cos(t * 0.3) * 4;
        const dist = Math.sqrt((col-cx)**2 + (row-cy)**2);
        const target = Math.max(0, 1 - dist/6) * (.05 + Math.sin(t*2+i*.1)*.02);
        return v + (target - v) * 0.08;
      });
      prevGrid.current = current;

      const maxVal = Math.max(...current, 0.001);
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < 196; i++) {
        const row = Math.floor(i / GRID), col = i % GRID;
        const x = PAD + col*(CELL+PAD), y = PAD + row*(CELL+PAD);
        const norm = current[i] / maxVal;
        let r, g, b;
        if (norm < 0.33) {
          const t2 = norm/0.33; r=0; g=Math.round(40+t2*172); b=Math.round(120+t2*135);
        } else if (norm < 0.66) {
          const t2=(norm-0.33)/0.33; r=Math.round(t2*255); g=Math.round(212+t2*43); b=Math.round(255-t2*255);
        } else {
          const t2=(norm-0.66)/0.34; r=255; g=Math.round(255-t2*255); b=0;
        }
        ctx.fillStyle = `rgba(${r},${g},${b},${0.3+norm*0.7})`;
        ctx.fillRect(x, y, CELL, CELL);
        if (norm > 0.75) {
          ctx.strokeStyle = `rgba(255,${Math.round(255*(1-norm))},0,0.8)`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, CELL, CELL);
        }
      }
      ctx.strokeStyle='rgba(0,212,255,0.08)'; ctx.lineWidth=.5;
      for(let i=0;i<=GRID;i++){
        const v=PAD+i*(CELL+PAD)-PAD/2;
        ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,H);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,v);ctx.lineTo(W,v);ctx.stroke();
      }
      ctx.fillStyle='rgba(0,212,255,0.4)';
      ctx.font='7px JetBrains Mono,monospace';
      ctx.textAlign='left';
      ctx.fillText('14×14 = 196 PATCHES', 2, H-2);
    }, 80);
    return () => clearInterval(intervalRef.current);
  }, [patchErrors]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', imageRendering: 'pixelated', display: 'block' }}
    />
  );
}
