import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const GhostDashboard3D = ({ botState, predictionErrors, onHudUpdate }) => {
  const mountRef    = useRef(null);
  const botStateRef = useRef(botState);
  const errorsRef   = useRef(predictionErrors);
  const modeRef     = useRef("auto");
  const manualRef   = useRef(new THREE.Vector3());
  const keysRef     = useRef({});
  const resetRef    = useRef(false);
  const [activeKeys, setActiveKeys] = useState([]);  // visual feedback only

  useEffect(() => { botStateRef.current = botState; },        [botState]);
  useEffect(() => { errorsRef.current   = predictionErrors; }, [predictionErrors]);

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth, H = mountRef.current.clientHeight;

    // ─── Scene ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020812);
    scene.fog = new THREE.FogExp2(0x020812, 0.02);

    const g1 = new THREE.GridHelper(40,40,0x0d2a50,0x071528); g1.position.y=-2; scene.add(g1);
    const g2 = new THREE.GridHelper(80,16,0x060e20,0x030810); g2.position.y=-2.01; scene.add(g2);

    const pp = new Float32Array(300*3);
    for(let i=0;i<pp.length;i++) pp[i]=(Math.random()-.5)*50;
    const partGeo=new THREE.BufferGeometry(); partGeo.setAttribute('position',new THREE.BufferAttribute(pp,3));
    scene.add(new THREE.Points(partGeo,new THREE.PointsMaterial({color:0x00d4ff,size:.05,transparent:true,opacity:.4})));

    scene.add(new THREE.AmbientLight(0x112233,.7));
    const dl=new THREE.DirectionalLight(0x7ab4cc,.4); dl.position.set(5,15,8); scene.add(dl);
    const botLight=new THREE.PointLight(0x00d4ff,2.5,18); scene.add(botLight);
    const predLight=new THREE.PointLight(0xffcc44,2,16); scene.add(predLight);

    // ─── Bot cube ────────────────────────────────────────────────────
    const botGroup = new THREE.Group();
    const botGeo = new THREE.BoxGeometry(1.6,1.6,1.6);
    const botMat = new THREE.MeshPhongMaterial({color:0x2266aa,emissive:0x0d3366,emissiveIntensity:.3,transparent:true,opacity:.9});
    botGroup.add(new THREE.Mesh(botGeo,botMat));
    botGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(botGeo),new THREE.LineBasicMaterial({color:0x00d4ff,transparent:true,opacity:.4})));
    [[-.3,.2],[.3,.2]].forEach(([x,y])=>{
      const e=new THREE.Mesh(new THREE.PlaneGeometry(.28,.28),new THREE.MeshBasicMaterial({color:0x66ddff,transparent:true,opacity:.9}));
      e.position.set(x,y,.82); botGroup.add(e);
    });
    const mouth=new THREE.Mesh(new THREE.PlaneGeometry(.45,.14),new THREE.MeshBasicMaterial({color:0x44aacc,transparent:true,opacity:.8}));
    mouth.position.set(0,-.28,.82); botGroup.add(mouth);
    botGroup.position.set(-1,0,0); scene.add(botGroup);

    // ─── Pred cube ───────────────────────────────────────────────────
    const predGroup = new THREE.Group();
    const predGeo = new THREE.BoxGeometry(1.5,1.5,1.5);
    const predMat = new THREE.MeshPhongMaterial({color:0xcc9922,emissive:0x775511,emissiveIntensity:.3,transparent:true,opacity:.8});
    predGroup.add(new THREE.Mesh(predGeo,predMat));
    predGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(predGeo),new THREE.LineBasicMaterial({color:0xffdd44,transparent:true,opacity:.55})));
    const outerEdge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2,2,2)),new THREE.LineDashedMaterial({color:0xffee44,dashSize:.1,gapSize:.08,transparent:true,opacity:.2}));
    outerEdge.computeLineDistances(); predGroup.add(outerEdge);
    predGroup.position.set(4,.5,0); scene.add(predGroup);

    const flash=new THREE.Mesh(new THREE.SphereGeometry(2.5,16,16),new THREE.MeshBasicMaterial({color:0x00ff9f,transparent:true,opacity:0}));
    scene.add(flash);

    // ─── Trajectory ──────────────────────────────────────────────────
    const trajGroup=new THREE.Group(); scene.add(trajGroup);
    function rebuildTraj(){
      while(trajGroup.children.length) trajGroup.remove(trajGroup.children[0]);
      const s=botGroup.position.clone(), e=predGroup.position.clone();
      const m=s.clone().add(e).multiplyScalar(.5); m.y+=2;
      const curve=new THREE.QuadraticBezierCurve3(s,m,e);
      const pts=curve.getPoints(40);
      trajGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x00d4ff,transparent:true,opacity:.6})));
      trajGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve,20,.04,6,false),new THREE.MeshBasicMaterial({color:0x00d4ff,transparent:true,opacity:.1})));
      const dir=new THREE.Vector3().subVectors(pts[pts.length-1],pts[pts.length-3]).normalize();
      const cone=new THREE.Mesh(new THREE.ConeGeometry(.12,.4,6),new THREE.MeshBasicMaterial({color:0x00d4ff}));
      cone.position.copy(pts[pts.length-1]); cone.lookAt(pts[pts.length-1].clone().add(dir)); cone.rotateX(Math.PI/2);
      trajGroup.add(cone);
    }

    // ─── Labels ──────────────────────────────────────────────────────
    function makeLabel(txt,col){
      const cv=document.createElement('canvas'); cv.width=512; cv.height=96;
      const cx=cv.getContext('2d');
      cx.shadowColor=col; cx.shadowBlur=18; cx.fillStyle=col;
      cx.font='bold 48px Orbitron,monospace'; cx.textAlign='center'; cx.fillText(txt,256,60);
      const tex=new THREE.CanvasTexture(cv);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(4,.75),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false}));
      m.renderOrder=999; return m;
    }
    const botLbl=makeLabel('STEVE','#00d4ff');
    const predLbl=makeLabel('PREDICTION','#ffdd44');
    scene.add(botLbl); scene.add(predLbl);

    // ─── Trail ───────────────────────────────────────────────────────
    const trailPts=[];
    const trailGeo=new THREE.BufferGeometry();
    scene.add(new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:0x00d4ff,transparent:true,opacity:.25})));

    // ─── Camera / Renderer / Controls ────────────────────────────────
    const camera=new THREE.PerspectiveCamera(50,W/H,.1,200);
    camera.position.set(-3,4,11); camera.lookAt(1,0,0);

    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(W,H); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.3;
    mountRef.current.appendChild(renderer.domElement);

    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.dampingFactor=.06;
    controls.minDistance=3; controls.maxDistance=40; controls.target.set(1,0,0);

    // ─── Keyboard — attached to window, ALWAYS fires ─────────────────
    const MOVE_KEYS = new Set(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright']);

    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();

      // Prevent browser defaults for keys we handle
      if (k === ' ' || k === 'enter' || MOVE_KEYS.has(k)) e.preventDefault();

      keysRef.current[k] = true;
      setActiveKeys(Object.keys(keysRef.current).filter(x => keysRef.current[x]));

      if (k === 'enter')    { modeRef.current = 'converge'; }
      if (k === ' ')        { modeRef.current = 'explode';  }
      if (k === 'r') { modeRef.current = 'auto'; manualRef.current.set(0,0,0); resetRef.current = true; }
      if (MOVE_KEYS.has(k)) { modeRef.current = 'manual'; }
    };

    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = false;
      setActiveKeys(Object.keys(keysRef.current).filter(x => keysRef.current[x]));
      // Return to auto when all move keys released
      if (MOVE_KEYS.has(k) && !Object.values(keysRef.current).some(Boolean)) {
        modeRef.current = 'auto';
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    // ─── Animate ─────────────────────────────────────────────────────
    const clock=new THREE.Clock();
    const tB=new THREE.Vector3(), tP=new THREE.Vector3();
    const DEFAULT_BOT  = new THREE.Vector3(-1, 0, 0);
    const DEFAULT_PRED = new THREE.Vector3( 4, 0.5, 0);
    let ca=0;

    const animate=()=>{
      requestAnimationFrame(animate);
      const t=clock.getElapsedTime();
      const k=keysRef.current;
      const mode=modeRef.current;
      const sp=0.12;

      // Move manual position every frame while key held
      // ── FULL RESET ──────────────────────────────────────────────
      if (resetRef.current) {
        resetRef.current = false;
        ca = 0;
        botGroup.position.copy(DEFAULT_BOT);
        predGroup.position.copy(DEFAULT_PRED);
        botGroup.scale.setScalar(1);
        predGroup.scale.setScalar(1);
        flash.material.opacity = 0;
        trailPts.length = 0;
      }

      if(k["w"]||k["arrowup"])    manualRef.current.z -= sp;
      if(k['s']||k['arrowdown'])  manualRef.current.z += sp;
      if(k['a']||k['arrowleft'])  manualRef.current.x -= sp;
      if(k['d']||k['arrowright']) manualRef.current.x += sp;
      if(k['q'])                  manualRef.current.y += sp;
      if(k['e'])                  manualRef.current.y -= sp;

      // Bot target
      const bs=botStateRef.current;
      if(mode==='manual')           tB.copy(manualRef.current);
      else if(bs&&(bs.x||bs.z))    tB.set(bs.x*.3,(bs.y-64)*.3,bs.z*.3);
      else                         tB.set(Math.sin(t*.35)*3.5,Math.sin(t*.7)*.4,Math.sin(t*.2)*Math.cos(t*.25)*3.5);
      botGroup.position.lerp(tB,.07);

      // Pred target
      const errs=errorsRef.current;
      const le=errs?.length?(errs[errs.length-1]?.error||.03):.03;
      const noise=le*7;

      if(mode==='converge'){
        ca=Math.min(ca+.018,1);
        tP.copy(botGroup.position);
        predGroup.position.lerp(tP,ca*.1);
        const d=botGroup.position.distanceTo(predGroup.position);
        flash.position.copy(botGroup.position).add(predGroup.position).multiplyScalar(.5);
        flash.material.opacity=Math.max(0,(1-d*.4))*.55;
        if(d<.3){const p=Math.sin(t*8)*.12+1;botGroup.scale.setScalar(p);predGroup.scale.setScalar(p);}
      } else if(mode==='explode'){
        ca=0;
        const dir=predGroup.position.clone().sub(botGroup.position).normalize();
        if(!dir.length()) dir.set(1,.5,0);
        tP.copy(botGroup.position).add(dir.multiplyScalar(11));
        predGroup.position.lerp(tP,.05);
        flash.material.opacity*=.95;
        botGroup.scale.setScalar(1); predGroup.scale.setScalar(1);
      } else {
        ca=0; flash.material.opacity*=.95;
        botGroup.scale.setScalar(1); predGroup.scale.setScalar(1);
        tP.set(botGroup.position.x+4+Math.sin(t*1.5)*noise,botGroup.position.y+.5+Math.cos(t)*noise,botGroup.position.z+Math.cos(t*1.5)*noise);
        predGroup.position.lerp(tP,.04);
      }

      predMat.color.lerp(le<.03?new THREE.Color(0x44cc44):le<.06?new THREE.Color(0xff9900):new THREE.Color(0xff3333),.04);
      botGroup.rotation.y+=.004; predGroup.rotation.y-=.003;

      rebuildTraj();
      botLbl.position.set(botGroup.position.x,botGroup.position.y+2,botGroup.position.z); botLbl.lookAt(camera.position);
      predLbl.position.set(predGroup.position.x,predGroup.position.y+1.8,predGroup.position.z); predLbl.lookAt(camera.position);
      botLight.position.copy(botGroup.position).add(new THREE.Vector3(0,2,1));
      predLight.position.copy(predGroup.position).add(new THREE.Vector3(0,2,1));

      trailPts.push(botGroup.position.clone());
      if(trailPts.length>120) trailPts.shift();
      if(trailPts.length>1) trailGeo.setFromPoints(trailPts);

      onHudUpdate?.({
        mode: mode.toUpperCase(),
        dist: botGroup.position.distanceTo(predGroup.position).toFixed(2),
        botPos:[botGroup.position.x.toFixed(1),botGroup.position.y.toFixed(1),botGroup.position.z.toFixed(1)],
        predPos:[predGroup.position.x.toFixed(1),predGroup.position.y.toFixed(1),predGroup.position.z.toFixed(1)],
      });

      controls.update();
      renderer.render(scene,camera);
    };
    animate();

    const onResize=()=>{
      if(!mountRef.current) return;
      const w=mountRef.current.clientWidth,h=mountRef.current.clientHeight;
      camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
    };
    window.addEventListener('resize',onResize);

    return ()=>{
      window.removeEventListener('resize',  onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      controls.dispose();
      if(mountRef.current?.contains(renderer.domElement)) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{position:'relative', width:'100%', height:'100%'}}>
      <div ref={mountRef} style={{width:'100%',height:'100%'}} />

      {/* Key indicator — shows what's being pressed */}
      <div style={{
        position:'absolute', bottom:10, right:10,
        display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end',
        pointerEvents:'none', zIndex:30,
      }}>
        {[
          {k:'w', label:'W'}, {k:'a', label:'A'}, {k:'s', label:'S'}, {k:'d', label:'D'},
          {k:'q', label:'Q'}, {k:'e', label:'E'},
          {k:'enter', label:'↵'}, {k:' ', label:'SPC'}, {k:'r', label:'R'},
        ].map(({k, label}) => (
          <div key={k} style={{
            width: label==='SPC'?36:20, height:20, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'9px', fontFamily:'JetBrains Mono, monospace', fontWeight:600,
            borderRadius:3, transition:'all 0.08s',
            background: activeKeys.includes(k) ? 'var(--cyan)' : 'rgba(0,212,255,0.08)',
            color:        activeKeys.includes(k) ? '#020812'     : 'rgba(0,212,255,0.4)',
            border:      `1px solid ${activeKeys.includes(k) ? 'var(--cyan)' : 'rgba(0,212,255,0.15)'}`,
            boxShadow:    activeKeys.includes(k) ? '0 0 8px rgba(0,212,255,0.6)' : 'none',
          }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GhostDashboard3D;
