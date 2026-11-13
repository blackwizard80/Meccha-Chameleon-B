import React, { useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUp,
  Copy,
  Crosshair,
  Eye,
  Flame,
  Hand,
  Megaphone,
  Paintbrush,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scan,
  UserCheck,
  Zap,
} from 'lucide-react';
import { SeekerHudSnapshot } from '../engine/GameEngine';
import { CharacterPose, RoundPhase, TeamRole } from '../types/game';

interface TouchControlsProps {
  role: TeamRole;
  phase: RoundPhase;
  isSpectator: boolean;
  pose: CharacterPose;
  crouching: boolean;
  clonesRemaining: number;
  canTagTarget: boolean;
  paintOpen: boolean;
  freeCamActive: boolean;
  seekerHud?: SeekerHudSnapshot;
  hitConfirmed?: boolean;
  onMoveJoystick: (x: number, z: number, active: boolean) => void;
  onCameraDrag: (dx: number, dy: number) => void;
  onCanvasTapOrStroke: (x: number, y: number, phase: 'down' | 'move' | 'up') => boolean;
  onJump: () => void;
  onToggleCrouch: () => void;
  onSelectPose: (pose: CharacterPose) => void;
  onRotateCharacter: (rad: number) => void;
  onTogglePaint: () => void;
  onPlaceClone: () => void;
  onTaunt: () => void;
  onAttemptTag: () => void;
  onToggleFreeCam: () => void;
  onFireBlaster?: () => void;
  onToggleAim?: () => void;
  onReloadBlaster?: () => void;
  onInspectWeapon?: () => void;
  onTriggerScanner?: () => void;
  onTriggerPulse?: () => void;
  onTriggerBoost?: () => void;
}

const POSES: { id: CharacterPose; label: string }[] = [
  { id: 'standing', label: 'Stand' },
  { id: 'crouching', label: 'Crouch' },
  { id: 'sitting', label: 'Sit' },
  { id: 'lying', label: 'Lie' },
  { id: 'curled', label: 'Curl' },
  { id: 'leaning', label: 'Lean' },
  { id: 'statue', label: 'Statue' },
];

export const TouchControls: React.FC<TouchControlsProps> = ({
  role,
  phase,
  isSpectator,
  pose,
  crouching,
  clonesRemaining,
  canTagTarget,
  paintOpen,
  freeCamActive,
  seekerHud,
  hitConfirmed = false,
  onMoveJoystick,
  onCameraDrag,
  onCanvasTapOrStroke,
  onJump,
  onToggleCrouch,
  onSelectPose,
  onRotateCharacter,
  onTogglePaint,
  onPlaceClone,
  onTaunt,
  onAttemptTag,
  onToggleFreeCam,
  onFireBlaster,
  onToggleAim,
  onReloadBlaster,
  onInspectWeapon,
  onTriggerScanner,
  onTriggerPulse,
  onTriggerBoost,
}) => {
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const [poseMenuOpen, setPoseMenuOpen] = useState(false);

  const joyPointerId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const camPointerId = useRef<number | null>(null);
  const camLast = useRef({ x: 0, y: 0 });
  const paintingPointer = useRef(false);

  const maxJoyRadius = 40;

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    joyPointerId.current = e.pointerId;
    joyCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoy(e.clientX, e.clientY);
  };

  const updateJoy = (cx: number, cy: number) => {
    const dx = cx - joyCenter.current.x;
    const dy = cy - joyCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxJoyRadius, dist);
    const ang = Math.atan2(dy, dx);
    const ox = Math.cos(ang) * clamped;
    const oy = Math.sin(ang) * clamped;
    setJoyOffset({ x: ox, y: oy });
    onMoveJoystick(ox / maxJoyRadius, -oy / maxJoyRadius, true);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    updateJoy(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    setJoyOffset({ x: 0, y: 0 });
    onMoveJoystick(0, 0, false);
  };

  // Full-viewport touch/drag layer for Camera Rotation & 3D Painting/Eyedropper
  const handleStageDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const handledByPainter = onCanvasTapOrStroke(e.clientX, e.clientY, 'down');
    if (handledByPainter) {
      paintingPointer.current = true;
      camPointerId.current = e.pointerId;
      return;
    }
    paintingPointer.current = false;
    camPointerId.current = e.pointerId;
    camLast.current = { x: e.clientX, y: e.clientY };
  };

  const handleStageMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (camPointerId.current !== e.pointerId) return;
    if (paintingPointer.current) {
      onCanvasTapOrStroke(e.clientX, e.clientY, 'move');
      return;
    }
    const dx = e.clientX - camLast.current.x;
    const dy = e.clientY - camLast.current.y;
    camLast.current = { x: e.clientX, y: e.clientY };
    onCameraDrag(dx, dy);
  };

  const handleStageUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (camPointerId.current !== e.pointerId) return;
    if (paintingPointer.current) {
      onCanvasTapOrStroke(e.clientX, e.clientY, 'up');
    }
    paintingPointer.current = false;
    camPointerId.current = null;
  };

  const isHider = role === 'hider' && !isSpectator;
  const isSeeker = role === 'seeker' && !isSpectator;

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-auto touch-none"
      onPointerDown={handleStageDown}
      onPointerMove={handleStageMove}
      onPointerUp={handleStageUp}
      onPointerCancel={handleStageUp}
    >
      {/* CENTER VIEWPORT CROSSHAIR (Seeker Only) */}
      {isSeeker && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div
              className={`rounded-full border-2 transition-all duration-150 flex items-center justify-center ${
                hitConfirmed
                  ? 'w-9 h-9 border-amber-400 scale-125'
                  : seekerHud?.aiming
                    ? 'w-5 h-5 border-cyan-300'
                    : 'w-8 h-8 border-cyan-300/75'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hitConfirmed ? 'bg-amber-400' : 'bg-cyan-300'
                }`}
              />
            </div>

            {hitConfirmed && (
              <div className="absolute -top-7 px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-display font-extrabold text-[10px] tracking-wider whitespace-nowrap shadow">
                TAG HIT!
              </div>
            )}

            {seekerHud?.reloading && (
              <div className="absolute top-7 px-2 py-0.5 rounded bg-slate-950/90 border border-cyan-400/60 text-cyan-300 font-bold text-[10px] tracking-wider whitespace-nowrap">
                RELOADING...
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEFT SIDE: Virtual Movement Joystick */}
      {!paintOpen && (
        <div
          onPointerDown={handleJoyDown}
          onPointerMove={handleJoyMove}
          onPointerUp={handleJoyUp}
          onPointerCancel={handleJoyUp}
          className="absolute bottom-5 left-5 w-28 h-28 rounded-full bg-slate-900/55 border-2 border-white/20 flex items-center justify-center touch-none shadow-lg"
        >
          <div className="w-20 h-20 rounded-full border border-white/10" />
          <div
            className="absolute w-11 h-11 rounded-full bg-white/85 shadow-md pointer-events-none"
            style={{
              transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`,
            }}
          />
        </div>
      )}

      {/* RIGHT SIDE: Landscape Mobile Action Cluster */}
      <div
        className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Expandable Pose Selector Strip */}
        {poseMenuOpen && isHider && (
          <div className="flex items-center gap-1 bg-slate-950/92 border border-slate-700 rounded-xl p-1.5 shadow-xl">
            {POSES.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectPose(p.id);
                  setPoseMenuOpen(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  pose === p.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Fine Pose Alignment & Utility Row */}
        <div className="flex items-center gap-2">
          {isHider && (
            <>
              <button
                onClick={() => onRotateCharacter(-Math.PI / 8)}
                title="Rotate Left"
                className="w-10 h-10 rounded-full bg-slate-900/80 border border-white/20 text-slate-100 flex items-center justify-center active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRotateCharacter(Math.PI / 8)}
                title="Rotate Right"
                className="w-10 h-10 rounded-full bg-slate-900/80 border border-white/20 text-slate-100 flex items-center justify-center active:scale-95"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={onTaunt}
                title="Taunt"
                className="h-10 px-3 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow"
              >
                <Megaphone className="w-4 h-4" />
                <span>Taunt</span>
              </button>
              <button
                onClick={onPlaceClone}
                disabled={clonesRemaining <= 0}
                title="Place Clone Decoy"
                className={`h-10 px-3 rounded-full font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow ${
                  clonesRemaining > 0
                    ? 'bg-sky-500/90 hover:bg-sky-400 text-slate-950'
                    : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Copy className="w-4 h-4" />
                <span>Clone ({clonesRemaining})</span>
              </button>
            </>
          )}

          {/* Seeker Ammo Readout & Gadget Row */}
          {isSeeker && seekerHud && (
            <div className="flex flex-col items-end gap-1.5">
              {/* Ammo Pill */}
              <div className="flex items-center gap-2 bg-slate-950/90 border border-cyan-500/40 rounded-xl px-3 py-1 shadow-lg">
                <div className="flex items-center gap-1">
                  {Array.from({ length: seekerHud.maxAmmo }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-1.5 h-3.5 rounded-sm transition-colors ${
                        idx < seekerHud.ammo
                          ? seekerHud.ammo <= 2
                            ? 'bg-orange-400'
                            : 'bg-cyan-400'
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-mono-tabular text-xs font-extrabold text-white pl-1">
                  {seekerHud.reloading ? 'RELOAD' : `${seekerHud.ammo}/${seekerHud.maxAmmo}`}
                </span>
              </div>

              {/* Gadgets & Weapon Inspect Row */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onInspectWeapon}
                  title="Inspect Blaster"
                  className="w-10 h-10 rounded-xl bg-slate-900/90 border border-white/20 text-slate-200 flex items-center justify-center active:scale-95"
                >
                  <Zap className="w-4 h-4 text-cyan-300" />
                </button>

                <button
                  onClick={onTriggerScanner}
                  disabled={seekerHud.scannerCooldown > 0}
                  className={`h-10 px-2.5 rounded-xl border font-bold text-[11px] flex items-center gap-1 active:scale-95 ${
                    seekerHud.scannerActive
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                      : seekerHud.scannerCooldown > 0
                        ? 'bg-slate-900/75 text-slate-400 border-slate-700'
                        : 'bg-slate-900/90 text-cyan-300 border-cyan-500/50 hover:bg-slate-800'
                  }`}
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span>
                    {seekerHud.scannerActive
                      ? 'SCAN'
                      : seekerHud.scannerCooldown > 0
                        ? `${Math.ceil(seekerHud.scannerCooldown)}s`
                        : 'Scanner'}
                  </span>
                </button>

                <button
                  onClick={onTriggerPulse}
                  disabled={seekerHud.pulseCooldown > 0}
                  className={`h-10 px-2.5 rounded-xl border font-bold text-[11px] flex items-center gap-1 active:scale-95 ${
                    seekerHud.pulseCooldown > 0
                      ? 'bg-slate-900/75 text-slate-400 border-slate-700'
                      : 'bg-slate-900/90 text-sky-300 border-sky-500/50 hover:bg-slate-800'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>
                    {seekerHud.pulseCooldown > 0
                      ? `${Math.ceil(seekerHud.pulseCooldown)}s`
                      : 'Pulse'}
                  </span>
                </button>

                <button
                  onClick={onTriggerBoost}
                  disabled={seekerHud.boostCooldown > 0}
                  className={`h-10 px-2.5 rounded-xl border font-bold text-[11px] flex items-center gap-1 active:scale-95 ${
                    seekerHud.boostActive
                      ? 'bg-orange-500 text-slate-950 border-orange-400'
                      : seekerHud.boostCooldown > 0
                        ? 'bg-slate-900/75 text-slate-400 border-slate-700'
                        : 'bg-slate-900/90 text-orange-300 border-orange-500/50 hover:bg-slate-800'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>
                    {seekerHud.boostActive
                      ? 'BOOST'
                      : seekerHud.boostCooldown > 0
                        ? `${Math.ceil(seekerHud.boostCooldown)}s`
                        : 'Boost'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {(isHider || isSpectator) && (
            <button
              onClick={onToggleFreeCam}
              className={`h-10 px-3 rounded-full font-semibold text-xs flex items-center gap-1.5 border ${
                freeCamActive
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-900/80 text-slate-200 border-white/20'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{freeCamActive ? 'Follow Cam' : 'Free Cam'}</span>
            </button>
          )}
        </div>

        {/* Primary Thumb Row */}
        <div className="flex items-center gap-2.5">
          {isHider && (
            <>
              <button
                onClick={onTogglePaint}
                className={`h-12 px-3.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 ${
                  paintOpen
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-emerald-600/95 hover:bg-emerald-500 text-white'
                }`}
              >
                <Paintbrush className="w-4 h-4" />
                <span>{paintOpen ? 'Close Paint' : 'Paint'}</span>
              </button>

              <button
                onClick={() => setPoseMenuOpen((o) => !o)}
                className="w-12 h-12 rounded-2xl bg-slate-900/85 border border-white/20 text-slate-100 flex flex-col items-center justify-center text-[10px] font-semibold active:scale-95"
              >
                <UserCheck className="w-4 h-4 mb-0.5 text-emerald-400" />
                <span>Pose</span>
              </button>
            </>
          )}

          {isSeeker && (
            <>
              {phase === 'seeking' && canTagTarget && (
                <button
                  onClick={onAttemptTag}
                  className="h-12 px-3.5 rounded-2xl font-display font-extrabold text-xs flex items-center gap-1.5 shadow-xl active:scale-95 bg-rose-500 hover:bg-rose-400 text-white ring-2 ring-amber-300"
                >
                  <Hand className="w-4 h-4" />
                  <span>TAG!</span>
                </button>
              )}

              <button
                onClick={onReloadBlaster}
                disabled={Boolean(seekerHud?.reloading) || seekerHud?.ammo === seekerHud?.maxAmmo}
                className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-white/20 text-slate-100 flex flex-col items-center justify-center text-[10px] font-semibold active:scale-95 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 mb-0.5 text-cyan-400 ${
                    seekerHud?.reloading ? 'animate-spin' : ''
                  }`}
                />
                <span>Reload</span>
              </button>

              <button
                onClick={onToggleAim}
                className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center text-[10px] font-bold active:scale-95 ${
                  seekerHud?.aiming
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                    : 'bg-slate-900/90 text-cyan-300 border-cyan-500/45'
                }`}
              >
                <Crosshair className="w-4 h-4 mb-0.5" />
                <span>Aim</span>
              </button>

              <button
                onClick={onFireBlaster}
                className={`w-16 h-16 rounded-full font-display font-extrabold text-xs flex flex-col items-center justify-center shadow-xl active:scale-95 border-2 ${
                  phase === 'seeking'
                    ? 'bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 border-white/70'
                    : 'bg-slate-800/90 text-slate-400 border-slate-600'
                }`}
              >
                <Crosshair className="w-5 h-5 mb-0.5" />
                <span>FIRE</span>
              </button>
            </>
          )}

          <button
            onClick={onToggleCrouch}
            className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center text-[10px] font-semibold active:scale-95 ${
              crouching
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-900/85 text-slate-100 border-white/20'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4 mb-0.5" />
            <span>Crouch</span>
          </button>

          <button
            onClick={onJump}
            className="w-14 h-14 rounded-full bg-white/90 hover:bg-white text-slate-950 font-bold text-xs flex flex-col items-center justify-center shadow-xl active:scale-95"
          >
            <ArrowUp className="w-5 h-5" />
            <span>Jump</span>
          </button>
        </div>
      </div>
    </div>
  );
};
