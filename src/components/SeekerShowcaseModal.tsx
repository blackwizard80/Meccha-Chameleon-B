import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Eye,
  Flame,
  RefreshCw,
  RotateCw,
  Scan,
  Shield,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/SoundEngine';
import { getSeekerEnergyColors } from '../engine/SeekerBlaster';
import { SeekerRig } from '../engine/SeekerRig';
import { AnimationState, SeekerTheme } from '../types/game';

interface SeekerShowcaseModalProps {
  theme: SeekerTheme;
  onSelectTheme: (theme: SeekerTheme) => void;
  onClose: () => void;
}

const PREVIEW_ANIMS: { id: AnimationState; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'inspect', label: 'Inspect' },
  { id: 'aim', label: 'Aim' },
  { id: 'search', label: 'Search' },
  { id: 'run', label: 'Sprint' },
  { id: 'crouch', label: 'Crouch' },
  { id: 'victory', label: 'Victory' },
];

const THEMES: { id: SeekerTheme; label: string; swatch: string }[] = [
  { id: 'cyan', label: 'Cyber Cyan', swatch: '#22d3ee' },
  { id: 'amber', label: 'Solar Amber', swatch: '#f59e0b' },
  { id: 'emerald', label: 'Venom Mint', swatch: '#34d399' },
];

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

export const SeekerShowcaseModal: React.FC<SeekerShowcaseModalProps> = ({
  theme,
  onSelectTheme,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<SeekerRig | null>(null);
  const ringMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const [activeAnim, setActiveAnim] = useState<AnimationState>('idle');
  const [autoRotate, setAutoRotate] = useState(true);
  const [weaponFocus, setWeaponFocus] = useState(false);
  const [boostPreview, setBoostPreview] = useState(false);

  const animRef = useRef<AnimationState>('idle');
  const autoRotateRef = useRef(true);
  const weaponFocusRef = useRef(false);
  const boostRef = useRef(false);
  const yawRef = useRef(0.38);

  animRef.current = activeAnim;
  autoRotateRef.current = autoRotate;
  weaponFocusRef.current = weaponFocus;
  boostRef.current = boostPreview;

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
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 360, container.clientHeight || 320);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 1) / (container.clientHeight || 1),
      0.1,
      50,
    );
    camera.position.set(0, 1.35, 3.45);
    camera.lookAt(0, 0.92, 0);

    // Three-point tactical studio lighting
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.82);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff7ed, 1.5);
    key.position.set(3, 5, 4);
    key.castShadow = !isSoftwareGl;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rim.position.set(-3.2, 3.2, -2.8);
    scene.add(rim);

    // Pedestal + glowing energy ring
    const pedGeo = new THREE.CylinderGeometry(0.92, 1.02, 0.14, 36);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.32,
      metalness: 0.58,
    });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = -0.07;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const colors = getSeekerEnergyColors(theme);
    const ringGeo = new THREE.TorusGeometry(0.94, 0.022, 12, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: colors.primary,
      emissive: colors.emissive,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    ringMatRef.current = ringMat;
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.006;
    scene.add(ring);

    const rig = new SeekerRig(theme);
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
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    const targetCamPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3(0, 0.92, 0);
    const currentLookAt = new THREE.Vector3(0, 0.92, 0);

    let frameId = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      if (autoRotateRef.current && !dragging) {
        yawRef.current += dt * 0.42;
      }

      if (weaponFocusRef.current) {
        targetCamPos.set(0.32, 1.18, 1.85);
        targetLookAt.set(0.14, 1.05, 0.15);
      } else {
        targetCamPos.set(0, 1.32, 3.45);
        targetLookAt.set(0, 0.9, 0);
      }

      camera.position.lerp(targetCamPos, 1 - Math.exp(-8 * dt));
      currentLookAt.lerp(targetLookAt, 1 - Math.exp(-8 * dt));
      camera.lookAt(currentLookAt);

      rig.group.rotation.y = yawRef.current;
      rig.update(dt, animRef.current, {
        currentYaw: yawRef.current,
        crouching: animRef.current === 'crouch',
        speedBoost: boostRef.current,
        scanning: animRef.current === 'search',
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        frameId = window.setTimeout(tick, 85);
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
      ringMatRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rigRef.current) {
      rigRef.current.setTheme(theme);
    }
    if (ringMatRef.current) {
      const c = getSeekerEnergyColors(theme);
      ringMatRef.current.color.setHex(c.primary);
      ringMatRef.current.emissive.setHex(c.emissive);
    }
  }, [theme]);

  const handleTestFire = () => {
    soundEngine.playBlasterShot();
    setActiveAnim('aim');
    rigRef.current?.triggerShoot();
  };

  const handleTestReload = () => {
    soundEngine.playReload();
    setActiveAnim('reload');
    rigRef.current?.triggerReload(1.6);
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/92 flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-5xl h-full max-h-[540px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-base font-bold text-white leading-tight">
                Seeker Hunter Loadout
              </h2>
              <p className="text-[11px] text-slate-400">
                Tactical Armor · Non-Lethal Tagging Blaster · Optical Gadgets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 grid grid-cols-12">
          {/* Left: 3D Seeker Viewport */}
          <div className="col-span-6 relative bg-[radial-gradient(circle_at_50%_45%,_rgba(34,211,238,0.16),_rgba(15,23,42,0.98)_70%)] border-r border-slate-800">
            <div
              ref={containerRef}
              className="w-full h-full cursor-grab active:cursor-grabbing"
            />

            {/* Viewport Camera Controls */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
              <button
                onClick={() => setWeaponFocus((f) => !f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 ${
                  weaponFocus
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-950/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{weaponFocus ? 'Full Body' : 'Inspect Blaster'}</span>
              </button>

              <button
                onClick={() => setAutoRotate((r) => !r)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 ${
                  autoRotate
                    ? 'bg-slate-800 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-950/90 text-slate-400 border-slate-700'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Auto Spin</span>
              </button>
            </div>

            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-950/88 border border-slate-800 rounded-lg px-3 py-1 text-[11px] text-slate-300 pointer-events-none">
              Drag 3D character to rotate 360°
            </div>
          </div>

          {/* Right: Theme, Weapon Test & Animation Controls */}
          <div className="col-span-6 p-4 overflow-y-auto custom-scroll space-y-4">
            {/* Visor & Blaster Energy Color */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Visor & Blaster Energy Core</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => {
                  const active = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        soundEngine.playButton();
                        onSelectTheme(t.id);
                      }}
                      className={`p-2 rounded-xl border text-left transition-colors ${
                        active
                          ? 'bg-slate-800 border-cyan-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      <span
                        className="block w-full h-2 rounded-full mb-1.5"
                        style={{ backgroundColor: t.swatch }}
                      />
                      <span className="text-xs font-bold block">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Blaster & Gadget Tests */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-orange-400" />
                <span>Tagging Blaster & Thruster Test</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleTestFire}
                  className="py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Test Fire</span>
                </button>
                <button
                  onClick={handleTestReload}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Test Reload</span>
                </button>
                <button
                  onClick={() => {
                    const next = !boostPreview;
                    setBoostPreview(next);
                    if (next) soundEngine.playSpeedBoost();
                  }}
                  className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border active:scale-95 ${
                    boostPreview
                      ? 'bg-orange-500 text-slate-950 border-orange-400 font-bold'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Thrusters</span>
                </button>
              </div>
            </div>

            {/* Animation Stance Preview */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Character Animations</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {PREVIEW_ANIMS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      soundEngine.playButton();
                      setActiveAnim(a.id);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                      activeAnim === a.id
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Field Equipment Summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Scan className="w-3.5 h-3.5" />
                <span>Hunter Equipment Kit</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Equipped with a non-lethal 8-cell Energy Tagging Blaster, Optical Line-of-Sight
                Scanner (12s CD), 14m Directional Sonar Pulse (18s CD), and Backpack Thruster
                Boost (15s CD).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
