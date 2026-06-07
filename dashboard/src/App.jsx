import React, { useState, useEffect, useRef, useCallback } from 'react';
import GhostDashboard3D from './GhostDashboard3D';
import NeuralNet from './NeuralNet';
import PatchHeatmap from './PatchHeatmap';
import SplashScreen from './SplashScreen';
import DriftAlert from './DriftAlert';
import { useGhostData } from './useGhostData';
import './App.css';
import * as THREE from 'three';

function ActionMini({ label, color, offset }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const W = ref.current.clientWidth, H = 108;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020812);
    const g = new THREE.GridHelper(10,10,0x0d2a50,0x071528); g.position.y=-1; scene.add(g);
    scene.add(new THREE.AmbientLight(0x334455,.8));
    const pl = new THREE.PointLight(color,2,12); pl.position.set(0,3,3); scene.add(pl);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.9), new THREE.MeshPhongMaterial({color:0x2266aa,emissive:0x0d3366,emissiveIntensity:.3}));
    bm.position.set(-1.5,0,0); scene.add(bm);
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(bm.geometry), new THREE.LineBasicMaterial({color:0x00d4ff,transparent:true,opacity:.4})));
    const pm = new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8), new THREE.MeshPhongMaterial({color,emissive:color,emissiveIntensity:.3,transparent:true,opacity:.85}));
    pm.position.set(1.5,offset?.y||0,offset?.z||0); scene.add(pm);
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(pm.geometry), new THREE.LineBasicMaterial({color,transparent:true,opacity:.5})));
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(1,offset?.y||0,offset?.z||0).normalize(),new THREE.Vector3(-.5,0,0),1.5,color,.3,.2));
    const camera = new THREE.PerspectiveCamera(60,W/H,.1,100);
    camera.position.set(0,2.5,5); camera.lookAt(0,0,0);
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(W,H); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    ref.current.appendChild(renderer.domElement);
    let frame;
    const animate=()=>{ frame=requestAnimationFrame(animate); bm.rotation.y+=.01; pm.rotation.y-=.008; renderer.render(scene,camera); };
    animate();
    return ()=>{ cancelAnimationFrame(frame); if(ref.current?.contains(renderer.domElement)) ref.current.removeChild(renderer.domElement); };
  }, []);
  return (
    <div className="action-panel panel">
      <div className="panel-title">
        <div className="panel-title-accent" style={{background:`#${color.toString(16).padStart(6,'0')}`}}/>
        {label}
      </div>
      <div ref={ref} style={{width:'100%',height:'108px'}}/>
    </div>
  );
}

export default function App({ db }) {
  const [splashDone, setSplashDone] = useState(false);
  const [hud, setHud]               = useState({ mode:'AUTO', dist:'0.00', botPos:['0','64','0'], predPos:['0','64','0'] });
  const realignRef                  = useRef(null);   // callback injected by GhostDashboard3D

  const { botState, predictionErrors, connected, tick } = useGhostData(db);

  const errs          = predictionErrors || [];
  const latestErr     = errs.length ? (errs[errs.length-1]?.error || 0) : 0;
  const avgErr        = errs.slice(-10).reduce((s,e)=>s+(e?.error||0),0) / Math.max(errs.slice(-10).length,1);
  const patchErrors   = errs.length ? errs[errs.length-1]?.patch_errors || null : null;
  const chartPts      = errs.slice(-60);
  const maxErr        = Math.max(...chartPts.map(e=>e.error||0), 0.001);
  const divergencePct = Math.min(latestErr * 100, 99.9).toFixed(2);
  const errColor      = latestErr > 0.06 ? 'var(--red)' : latestErr > 0.03 ? 'var(--amber)' : 'var(--green)';
  const modeClass     = `mode-${hud.mode.toLowerCase()}`;

  // DriftAlert calls this → fires keydown 'enter' on window to trigger converge
  const handleRealign = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })), 100);
  }, []);

  if (!splashDone) return <SplashScreen onDone={() => setSplashDone(true)} />;

  return (
    <div className="ghost-app" tabIndex={0} onClick={e=>e.currentTarget.focus()}>
      <div className="bg-hex"/>

      {/* Drift alert — floats above everything */}
      <DriftAlert l1Loss={latestErr} threshold={0.06} onRealign={handleRealign} />

      {/* ── HEADER ── */}
      <header className="hdr">
        <div className="hdr-logo">
          <div>
            <div className="hdr-logo-glyph">G.H.O.S.T</div>
            <div style={{
              fontFamily:"'Orbitron',monospace", fontSize:9, fontWeight:700,
              color:'rgba(0,212,255,0.5)', letterSpacing:4,
              textTransform:'uppercase', marginBottom:2,
            }}>OBSERVABILITY PLATFORM</div>
            <div className="hdr-logo-sub">
              V-JEPA Latent World Model · SpacetimeDB Real-Time · 14×14 Patch Tokenization
            </div>
          </div>
        </div>
        <div className="hdr-stats">
          <div className="hdr-stat">
            <div className="hdr-stat-label">Latent Z̃</div>
            <div className="hdr-stat-value">{hud.botPos.join(' / ')}</div>
          </div>
          <div className="hdr-stat">
            <div className="hdr-stat-label">Frame Tick</div>
            <div className="hdr-stat-value" style={{color:'var(--cyan)'}}>{tick}<span className="blink">_</span></div>
          </div>
          <div className="hdr-stat">
            <div className="hdr-stat-label">L1 Loss</div>
            <div className="hdr-stat-value" style={{color:errColor}}>{latestErr.toFixed(4)}</div>
          </div>
          <div className="hdr-stat">
            <div className="hdr-stat-label">Latent Divergence</div>
            <div className="hdr-stat-value" style={{color:errColor}}>{divergencePct}%</div>
          </div>
          <div className="hdr-stat">
            <div className="hdr-stat-label">SpacetimeDB</div>
            <div className="hdr-stat-value" style={{color:connected?'var(--green)':'var(--amber)'}}>
              {connected?'● LIVE':'◌ SIM'}
            </div>
          </div>
          <div className="live-badge"><div className="live-dot"/>ONLINE</div>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <div className="main-grid">

        {/* 3D VIEWPORT */}
        <div className="panel viewport-panel">
          <div className="panel-title">
            <div className="panel-title-accent"/>
            LATENT EMBEDDING SPACE · Z̃ TARGET (BLUE) vs Ẑ PREDICTED (YELLOW) · L1: {hud.dist}
          </div>
          <div className="viewport-hud">
            <div className="hud-bar">
              <div className="hud-item">Z̃: [<span>{hud.botPos.join(', ')}</span>]</div>
              <div className="hud-item">Ẑ: [<span>{hud.predPos.join(', ')}</span>]</div>
              <div className="hud-item">L1: <span style={{color:errColor}}>{latestErr.toFixed(5)}</span></div>
              <div className="hud-item">Div: <span style={{color:errColor}}>{divergencePct}%</span></div>
            </div>
          </div>
          <div className="viewport-mode">
            <div className={`mode-badge ${modeClass}`}>{hud.mode}</div>
          </div>
          <div className="kb-hint">
            WASD/↑↓←→ move · Q/E elevation<br/>
            ENTER converge · SPACE diverge · R reset
          </div>
          <div style={{position:'absolute',inset:'36px 0 0 0'}}>
            <GhostDashboard3D
              botState={botState}
              predictionErrors={predictionErrors}
              onHudUpdate={setHud}
            />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="right-col">

          {/* L1 Loss Chart */}
          <div className="panel chart-panel">
            <div className="panel-title">
              <div className="panel-title-accent"/>
              JEPA L1 REGRESSION LOSS · Ẑ vs Z̃
            </div>
            <div className="err-metric">
              <div>
                <div className="err-value" style={{color:errColor}}>{latestErr.toFixed(4)}</div>
                <div className="err-sub" style={{marginTop:2}}>L1 LOSS · {divergencePct}% LATENT DIVERGENCE</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="err-sub">{errs.length} FRAMES</div>
                <div className="err-sub">AVG {avgErr.toFixed(4)} L1</div>
              </div>
            </div>
            <svg className="chart-svg" viewBox="0 0 280 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.02"/>
                </linearGradient>
                <linearGradient id="cg-warn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4545" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#ff4545" stopOpacity="0.02"/>
                </linearGradient>
              </defs>
              {/* Threshold line */}
              <line x1="0" y1={95-(0.06/maxErr)*85} x2="280" y2={95-(0.06/maxErr)*85}
                stroke="rgba(255,69,69,0.4)" strokeWidth="0.8" strokeDasharray="4,3"/>
              <text x="232" y={90-(0.06/maxErr)*85} fill="rgba(255,69,69,0.5)" fontSize="6" fontFamily="JetBrains Mono">DRIFT LIMIT</text>
              {[0,1,2,3].map(i=>(
                <line key={i} x1="0" y1={i*33} x2="280" y2={i*33} stroke="rgba(0,212,255,0.06)" strokeWidth="0.5"/>
              ))}
              {chartPts.length>1 && <>
                <path d={'M'+chartPts.map((e,i)=>{
                  const x=(i/(chartPts.length-1))*280;
                  const y=95-((e.error||0)/maxErr)*85;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' L')+` L280,100 L0,100 Z`}
                fill={latestErr > 0.06 ? 'url(#cg-warn)' : 'url(#cg)'}/>
                <polyline
                  points={chartPts.map((e,i)=>`${((i/(chartPts.length-1))*280).toFixed(1)},${(95-((e.error||0)/maxErr)*85).toFixed(1)}`).join(' ')}
                  fill="none" stroke={latestErr > 0.06 ? '#ff4545' : '#00d4ff'} strokeWidth="1.5"/>
                <circle cx={280} cy={95-((chartPts[chartPts.length-1]?.error||0)/maxErr)*85} r="3"
                  fill={latestErr > 0.06 ? '#ff4545' : '#00d4ff'}/>
              </>}
              <text x="3" y="9"   fill="rgba(58,85,119,0.7)" fontSize="7" fontFamily="JetBrains Mono">{maxErr.toFixed(3)}</text>
              <text x="3" y="98"  fill="rgba(58,85,119,0.7)" fontSize="7" fontFamily="JetBrains Mono">0</text>
            </svg>
          </div>

          {/* Patch heatmap */}
          <div className="panel" style={{padding:'0 0 4px'}}>
            <div className="panel-title">
              <div className="panel-title-accent" style={{background:'var(--amber)'}}/>
              SPATIO-TEMPORAL PATCH SURPRISE · 14×14 TUBELET GRID
            </div>
            <div style={{padding:'4px 10px 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:'9px',color:'var(--text3)',letterSpacing:'1px'}}>
                PER-PATCH L1 · <span style={{color:'var(--green)'}}>LOW</span> → <span style={{color:'var(--cyan)'}}>MED</span> → <span style={{color:'var(--red)'}}>HIGH</span>
              </div>
              <div style={{fontSize:'9px',color:'var(--text3)'}}>{patchErrors?'LIVE DATA':'SIMULATED'}</div>
            </div>
            <div style={{padding:'4px 10px 0'}}>
              <PatchHeatmap patchErrors={patchErrors} tick={tick}/>
            </div>
          </div>

          {/* Metrics */}
          <div className="metrics-grid panel" style={{border:'none'}}>
            <div className="metric-cell">
              <div className="metric-label">Architecture</div>
              <div className="metric-val" style={{fontSize:11}}>V-JEPA</div>
            </div>
            <div className="metric-cell">
              <div className="metric-label">Latent Dim</div>
              <div className="metric-val cyan">256</div>
            </div>
            <div className="metric-cell">
              <div className="metric-label">Patch Grid</div>
              <div className="metric-val cyan">14×14</div>
            </div>
            <div className="metric-cell">
              <div className="metric-label">Confidence</div>
              <div className={`metric-val ${latestErr<.03?'green':latestErr<.06?'amber':'red'}`}>
                {((1-Math.min(latestErr*10,1))*100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Neural net */}
          <div className="panel neural-panel">
            <div className="panel-title">
              <div className="panel-title-accent" style={{background:'var(--green)'}}/>
              V-JEPA ENCODER · LATENT SIGNAL FLOW
            </div>
            <div className="neural-canvas-wrap">
              <NeuralNet error={latestErr}/>
            </div>
          </div>
        </div>

        {/* Action space */}
        <div className="action-row" style={{gridColumn:'1/3'}}>
          <ActionMini label="FORWARD → Δẑ" color={0x44ff99} offset={{y:0,z:-1}}/>
          <ActionMini label="JUMP ↑ Δẑ"    color={0xffaa22} offset={{y:1.5,z:0}}/>
          <ActionMini label="BREAK ⬡ Δẑ"  color={0xff4545} offset={{y:0,z:1}}/>
        </div>
      </div>

      {/* ── STATUS BAR ── */}
      <footer className="status-bar">
        <div className="status-item green">SpacetimeDB: <span>{connected?'CONNECTED':'SIMULATION'}</span></div>
        <div className="status-item">Frame: <span>{tick}</span></div>
        <div className="status-item">Z̃: <span>[{hud.botPos.join(', ')}]</span></div>
        <div className="status-item">L1: <span style={{color:errColor}}>{latestErr.toFixed(5)}</span></div>
        <div className="status-item">Divergence: <span style={{color:errColor}}>{divergencePct}%</span></div>
        <div className="status-item">Patches: <span>196 (14×14)</span></div>
        <div className="status-item" style={{flex:1}}>
          G.H.O.S.T · Observability Platform · V-JEPA · MineRL 275K · SpacetimeDB
        </div>
      </footer>
    </div>
  );
}
