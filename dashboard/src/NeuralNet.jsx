import React, { useEffect, useRef } from 'react';

// Animated neural network visualizing V-JEPA "thinking"
export default function NeuralNet({ error = 0.03 }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth, H = 88;
    canvas.width = W; canvas.height = H;

    // Layer sizes: input → hidden1 → hidden2 → output
    const layers = [[4], [6], [5], [3]];
    const nodeRadius = 5;

    // Build node positions
    const nodes = [];
    layers.forEach((layer, li) => {
      const count = layer[0];
      const x = (li / (layers.length - 1)) * (W - 40) + 20;
      for (let ni = 0; ni < count; ni++) {
        const y = ((ni + 1) / (count + 1)) * H;
        nodes.push({ li, ni, x, y, fire: Math.random() });
      }
    });

    // Build edges
    const edges = [];
    for (let li = 0; li < layers.length - 1; li++) {
      const from = nodes.filter(n => n.li === li);
      const to = nodes.filter(n => n.li === li + 1);
      from.forEach(f => to.forEach(t => {
        edges.push({ from: f, to: t, w: Math.random() * 2 - 1, signal: 0, signalPos: 0 });
      }));
    }

    let t = 0;

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      t += 0.03;

      // Edges
      edges.forEach(e => {
        e.signalPos = (e.signalPos + 0.025 * (1 + error * 5)) % 1;
        const active = Math.sin(t * 2 + e.from.ni + e.to.ni) > 0.2;

        ctx.beginPath();
        ctx.moveTo(e.from.x, e.from.y);
        ctx.lineTo(e.to.x, e.to.y);
        ctx.strokeStyle = active ? 'rgba(0,212,255,0.25)' : 'rgba(0,212,255,0.05)';
        ctx.lineWidth = 0.7;
        ctx.stroke();

        // Signal particle
        if (active) {
          const px = e.from.x + (e.to.x - e.from.x) * e.signalPos;
          const py = e.from.y + (e.to.y - e.from.y) * e.signalPos;
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = error > 0.06 ? '#ff4545' : error > 0.03 ? '#ffb830' : '#00ff9f';
          ctx.fill();
        }
      });

      // Nodes
      nodes.forEach(n => {
        n.fire = 0.5 + 0.5 * Math.sin(t * 1.5 + n.li * 2 + n.ni * 0.8);
        const isOutput = n.li === layers.length - 1;
        const alpha = 0.3 + n.fire * 0.7;
        const baseColor = isOutput
          ? (error > 0.06 ? `rgba(255,69,69,${alpha})` : `rgba(0,255,159,${alpha})`)
          : `rgba(0,212,255,${alpha})`;

        // Glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, nodeRadius + 3, 0, Math.PI * 2);
        ctx.fillStyle = isOutput
          ? (error > 0.06 ? 'rgba(255,69,69,0.1)' : 'rgba(0,255,159,0.1)')
          : 'rgba(0,212,255,0.1)';
        ctx.fill();

        // Node
        ctx.beginPath();
        ctx.arc(n.x, n.y, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, nodeRadius, 0, Math.PI * 2);
        ctx.strokeStyle = isOutput ? (error > 0.06 ? '#ff4545' : '#00ff9f') : '#00d4ff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Label
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(58,85,119,0.8)';
      ['INPUT', 'H1', 'H2', 'OUTPUT'].forEach((lbl, li) => {
        const x = (li / 3) * (W - 40) + 20;
        ctx.textAlign = 'center';
        ctx.fillText(lbl, x, H - 4);
      });
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [error]);

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '88px', display: 'block' }} />
  );
}
