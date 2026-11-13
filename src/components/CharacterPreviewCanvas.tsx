import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CharacterRig } from '../engine/CharacterRig';
import { CharacterPose, CharacterShape, CharacterSize } from '../types/game';

interface CharacterPreviewCanvasProps {
  shape: CharacterShape;
  size: CharacterSize;
  pose: CharacterPose;
  textureDataUrl: string | null;
  autoRotate?: boolean;
  className?: string;
}

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const CharacterPreviewCanvas: React.FC<CharacterPreviewCanvasProps> = ({
  shape,
  size,
  pose,
  textureDataUrl,
  autoRotate = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<CharacterRig | null>(null);
  const poseRef = useRef<CharacterPose>(pose);
  const autoRotateRef = useRef(autoRotate);
  const yawRef = useRef(0.35);

  poseRef.current = pose;
  autoRotateRef.current = autoRotate;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 320, container.clientHeight || 320);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || 1) / (container.clientHeight || 1),
      0.1,
      50,
    );
    camera.position.set(0, 1.32, 3.4);
    camera.lookAt(0, 0.86, 0);

    // Three-point studio lighting
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.75);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff7ed, 1.45);
    key.position.set(3, 5, 4);
    key.castShadow = !isSoftwareGl;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rim.position.set(-3, 3, -3);
    scene.add(rim);

    // Stylized Showcase Pedestal
    const pedGeo = new THREE.CylinderGeometry(0.88, 0.96, 0.14, 32);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.45,
    });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = -0.07;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const ringGeo = new THREE.TorusGeometry(0.9, 0.02, 12, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.55,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.005;
    scene.add(ring);

    const rig = new CharacterRig(textureDataUrl);
    rig.rebuildModel(shape, size);
    scene.add(rig.group);
    rigRef.current = rig;

    let dragging = false;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      yawRef.current += dx * 0.012;
    };
    const onUp = () => {
      dragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      if (autoRotateRef.current && !dragging) {
        yawRef.current += dt * 0.45;
      }
      rig.group.rotation.y = yawRef.current;
      rig.update(dt, 'idle', poseRef.current);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        frameId = window.setTimeout(tick, 90);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      frameId = window.setTimeout(tick, 40);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      rig.dispose();
      pedGeo.dispose();
      pedMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      if (dom.parentNode === container) container.removeChild(dom);
      rigRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rigRef.current) {
      if (rigRef.current.getShape() !== shape || rigRef.current.getSize() !== size) {
        rigRef.current.rebuildModel(shape, size);
      }
    }
  }, [shape, size]);

  useEffect(() => {
    if (rigRef.current) {
      rigRef.current.painter.loadFromDataUrl(textureDataUrl);
    }
  }, [textureDataUrl]);

  return <div ref={containerRef} className={`w-full h-full cursor-grab active:cursor-grabbing ${className}`} />;
};
