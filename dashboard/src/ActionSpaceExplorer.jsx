import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const ActionSpaceExplorer = ({ botState, predictionErrors }) => {
  const mountRef = useRef(null);
  const keysRef = useRef({});
  const modeRef = useRef('idle'); // idle | converge | explode | cycle
  const [activeMode, setActiveMode] = useState('IDLE');
  const [activeAction, setActiveAction] = useState(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e27);

    const gridHelper = new THREE.GridHelper(20, 20, 0x00ff00, 0x0a2a1a);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pl = new THREE.PointLight(0x00ff00, 1);
    pl.position.set(10, 15, 10);
    scene.add(pl);

    function makeLabel(text, color) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(text, 10, 40);
      const texture = new THREE.CanvasTexture(canvas);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }));
      mesh.renderOrder = 999;
      return mesh;
    }

    // Origin (bot)
    const origin = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0x4488ff, emissive: 0x112244, emissiveIntensity: 0.5 })
    );
    scene.add(origin);
    const originLabel = makeLabel('CURRENT STATE', '#4488ff');
    scene.add(originLabel);

    // Merge flash
    const flashSphere = new THREE.Mesh(
      new THREE.SphereGeometry(2, 32, 32),
      new THREE.MeshPhongMaterial({ color: 0x00ff88, transparent: true, opacity: 0, emissive: 0x00ff88, emissiveIntensity: 0.8 })
    );
    scene.add(flashSphere);

    // Action cubes
    const actions = [
      { key: 'forward', label: 'FORWARD', color: 0x44ff44, basePos: new THREE.Vector3(4, 0, 0), hotkey: '1' },
      { key: 'jump', label: 'JUMP', color: 0xffaa22, basePos: new THREE.Vector3(-1, 4, -2), hotkey: '2' },
      { key: 'break', label: 'BREAK', color: 0xff4444, basePos: new THREE.Vector3(-1, 0, 4), hotkey: '3' },
    ];

    const cubes = [];
    const lines = [];
    const labels = [];
    const targetPositions = [];

    actions.forEach(action => {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshPhongMaterial({ color: action.color, emissive: action.color, emissiveIntensity: 0.2, transparent: true, opacity: 0.9 })
      );
      cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: action.color })));
      cube.position.copy(action.basePos);
      scene.add(cube);
      cubes.push(cube);
      targetPositions.push(action.basePos.clone());

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const lineMat = new THREE.LineDashedMaterial({ color: action.color, dashSize: 0.2, gapSize: 0.1, transparent: true, opacity: 0.5 });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      scene.add(lineMesh);
      lines.push(lineMesh);

      const label = makeLabel(action.label, '#' + action.color.toString(16).padStart(6, '0'));
      scene.add(label);
      labels.push(label);
    });

    // Camera
    const camera = new THREE.PerspectiveCamera(60, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(6, 5, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.minDistance = 3;
    orbitControls.maxDistance = 30;

    // Keyboard
    let selectedAction = -1; // -1 = all, 0/1/2 = specific
    let cycleIndex = 0;
    let cycleTimer = 0;

    const onKeyDown = (e) => {
      keysRef.current[e.key] = true;

      if (e.key === 'Enter') {
        modeRef.current = 'converge';
        setActiveMode('CONVERGE');
      }
      if (e.key === ' ') {
        e.preventDefault();
        modeRef.current = 'explode';
        setActiveMode('EXPLODE');
      }
      if (e.key === 'r' || e.key === 'R') {
        modeRef.current = 'idle';
        selectedAction = -1;
        setActiveMode('IDLE');
        setActiveAction(null);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        modeRef.current = 'cycle';
        cycleIndex = (cycleIndex + 1) % 3;
        selectedAction = cycleIndex;
        setActiveMode('FOCUS');
        setActiveAction(actions[cycleIndex].label);
      }
      // 1, 2, 3 to select individual action
      if (e.key === '1') { selectedAction = 0; modeRef.current = 'converge'; setActiveAction('FORWARD'); setActiveMode('CONVERGE → FORWARD'); }
      if (e.key === '2') { selectedAction = 1; modeRef.current = 'converge'; setActiveAction('JUMP'); setActiveMode('CONVERGE → JUMP'); }
      if (e.key === '3') { selectedAction = 2; modeRef.current = 'converge'; setActiveAction('BREAK'); setActiveMode('CONVERGE → BREAK'); }
    };
    const onKeyUp = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const mode = modeRef.current;

      // Origin pulse
      const pulse = 1 + Math.sin(t * 2) * 0.05;
      origin.scale.set(pulse, pulse, pulse);

      cubes.forEach((cube, i) => {
        const base = actions[i].basePos;

        if (mode === 'converge') {
          if (selectedAction === -1 || selectedAction === i) {
            // Move toward origin
            targetPositions[i].lerp(new THREE.Vector3(0, 0, 0), 0.05);
          }
          // Flash when close
          const dist = cube.position.distanceTo(origin.position);
          if (dist < 0.5) {
            flashSphere.material.opacity = Math.max(flashSphere.material.opacity, 0.4);
            flashSphere.position.copy(origin.position);
            const p = Math.sin(t * 8) * 0.2 + 1;
            cube.scale.setScalar(p);
          }
        } else if (mode === 'explode') {
          const dir = base.clone().normalize();
          targetPositions[i].copy(dir.multiplyScalar(8 + Math.sin(t + i) * 2));
          cube.scale.setScalar(1);
        } else if (mode === 'cycle') {
          if (i === selectedAction) {
            // Highlighted: move forward
            const dir = base.clone().normalize();
            targetPositions[i].copy(dir.multiplyScalar(2.5));
            cube.scale.setScalar(1.3);
            cube.material.opacity = 1;
          } else {
            // Dimmed: move back
            targetPositions[i].copy(base.clone().multiplyScalar(1.5));
            cube.scale.setScalar(0.7);
            cube.material.opacity = 0.3;
          }
        } else {
          // Idle: float around base
          targetPositions[i].set(
            base.x + Math.sin(t * 0.5 + i * 2) * 0.3,
            base.y + Math.sin(t * 0.7 + i * 1.5) * 0.2,
            base.z + Math.cos(t * 0.4 + i * 2.5) * 0.3
          );
          cube.scale.setScalar(1);
          cube.material.opacity = 0.9;
        }

        cube.position.lerp(targetPositions[i], 0.08);
        cube.rotation.x += 0.008;
        cube.rotation.y += 0.01;

        // Connection line
        const pos = lines[i].geometry.attributes.position.array;
        pos[0] = 0; pos[1] = 0; pos[2] = 0;
        pos[3] = cube.position.x; pos[4] = cube.position.y; pos[5] = cube.position.z;
        lines[i].geometry.attributes.position.needsUpdate = true;
        lines[i].computeLineDistances();

        // Label follows cube
        labels[i].position.set(cube.position.x, cube.position.y + 1.3, cube.position.z);
        labels[i].lookAt(camera.position);
      });

      // Flash decay
      flashSphere.material.opacity *= 0.96;

      originLabel.position.set(0, 1.2, 0);
      originLabel.lookAt(camera.position);

      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      orbitControls.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mountRef} style={{
        width: '100%', height: '400px',
        border: '1px solid #00ff00', background: '#0a0e27',
        borderRadius: '4px', overflow: 'hidden',
      }} />
      <div style={{
        position: 'absolute', top: '10px', left: '10px',
        color: '#00ff00', fontFamily: 'monospace', fontSize: '11px',
        background: 'rgba(0,0,0,0.85)', padding: '8px 10px',
        border: '1px solid #00ff00', borderRadius: '4px', pointerEvents: 'none',
      }}>
        MODE: {activeMode}{activeAction ? ` [${activeAction}]` : ''}
      </div>
      <div style={{
        position: 'absolute', bottom: '10px', left: '10px',
        color: '#00aa00', fontFamily: 'monospace', fontSize: '10px',
        background: 'rgba(0,0,0,0.85)', padding: '8px 10px',
        border: '1px solid #004400', borderRadius: '4px', pointerEvents: 'none',
        lineHeight: '1.6',
      }}>
        ↵ Enter: converge all &nbsp;|&nbsp; Space: explode<br/>
        1: forward &nbsp;|&nbsp; 2: jump &nbsp;|&nbsp; 3: break<br/>
        Tab: cycle focus &nbsp;|&nbsp; R: reset
      </div>
      <div style={{
        position: 'absolute', bottom: '10px', right: '10px',
        color: '#00aa00', fontFamily: 'monospace', fontSize: '10px',
        background: 'rgba(0,0,0,0.6)', padding: '6px',
        borderRadius: '4px', pointerEvents: 'none',
      }}>
        🖱️ Drag orbit • Scroll zoom
      </div>
    </div>
  );
};

export default ActionSpaceExplorer;
