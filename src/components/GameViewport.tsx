import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  LogOut,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { GameEngine, SeekerHudSnapshot } from '../engine/GameEngine';
import { lanClient } from '../network/LanClient';
import {
  BodyPartId,
  CharacterPose,
  CloneState,
  DiscoveryAlert,
  GameSettings,
  MapId,
  PaintPattern,
  PaintSample,
  PaintTool,
  PlayerAppearance,
  RoomState,
  SeekerActionEvent,
  TauntPulse,
} from '../types/game';
import { PaintingPanel } from './PaintingPanel';
import { ResultsScreen } from './ResultsScreen';
import { TouchControls } from './TouchControls';

interface GameViewportProps {
  mode: 'solo' | 'lan';
  soloMapId: MapId;
  room: RoomState | null;
  localPlayerId: string | null;
  appearance: PlayerAppearance;
  settings: GameSettings;
  onUpdateAppearance: (next: PlayerAppearance) => void;
  onOpenSettings: () => void;
  onExitMatch: () => void;
}

export const GameViewport: React.FC<GameViewportProps> = ({
  mode,
  soloMapId,
  room,
  localPlayerId,
  appearance,
  settings,
  onUpdateAppearance,
  onOpenSettings,
  onExitMatch,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [paintOpen, setPaintOpen] = useState(false);
  const [paintTool, setPaintTool] = useState<PaintTool>('brush');
  const [paintColor, setPaintColor] = useState('#c26d4a');
  const [paintPattern, setPaintPattern] = useState<PaintPattern>('solid');
  const [brushSize, setBrushSize] = useState(18);
  const [selectedPart, setSelectedPart] = useState<BodyPartId>('chest');
  const [lastSample, setLastSample] = useState<PaintSample | null>(null);

  const [crouching, setCrouching] = useState(false);
  const [pose, setPose] = useState<CharacterPose>(appearance.pose);
  const [freeCam, setFreeCam] = useState(false);
  const [soloClonesLeft, setSoloClonesLeft] = useState(3);
  const [soloClones, setSoloClones] = useState<CloneState[]>([]);
  const [catchTarget, setCatchTarget] = useState<{
    id: string;
    isClone: boolean;
    distance: number;
  } | null>(null);
  const [bannerAlert, setBannerAlert] = useState<string | null>(null);
  const [hitConfirmed, setHitConfirmed] = useState(false);
  const [seekerHud, setSeekerHud] = useState<SeekerHudSnapshot>({
    ammo: 8,
    maxAmmo: 8,
    reloading: false,
    aiming: false,
    scannerCooldown: 0,
    pulseCooldown: 0,
    boostCooldown: 0,
    boostActive: false,
    scannerActive: false,
  });

  const bannerTimerRef = useRef<number | null>(null);
  const hitTimerRef = useRef<number | null>(null);
  const lastSyncSentRef = useRef(0);

  const showBanner = (text: string) => {
    setBannerAlert(text);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setBannerAlert(null), 3200);
  };

  const triggerHitConfirmFlash = () => {
    setHitConfirmed(true);
    if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
    hitTimerRef.current = window.setTimeout(() => setHitConfirmed(false), 380);
  };

  // Mount Three.js GameEngine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GameEngine(
      container,
      appearance,
      settings.graphicsQuality,
      {
        onSampledColor: (sample) => {
          setPaintColor(sample.hex);
          setPaintPattern(sample.pattern);
          setLastSample(sample);
          setPaintTool('brush');
          showBanner(`Sampled ${sample.label} (${sample.pattern})`);
        },
        onPaintModified: (nextApp) => {
          onUpdateAppearance(nextApp);
          if (mode === 'lan') {
            const now = Date.now();
            if (now - lastSyncSentRef.current > 250) {
              lastSyncSentRef.current = now;
              lanClient.updateAppearance(nextApp);
            }
          }
        },
        onLocalTransform: (pos, rotY, anim, aimPitch) => {
          if (mode === 'lan') {
            lanClient.updateTransform(pos, rotY, anim, aimPitch);
          }
        },
        onSeekerTargetChange: (t) => {
          setCatchTarget(t);
        },
        onSeekerHudUpdate: (hud) => {
          setSeekerHud(hud);
        },
        onSeekerWeaponHit: (targetId, isClone) => {
          triggerHitConfirmFlash();
          if (mode === 'lan') {
            lanClient.attemptCapture(targetId, isClone, true);
          }
        },
        onSeekerClue: (msg) => {
          showBanner(msg);
        },
        onSeekerActionEmit: (event) => {
          if (mode === 'lan') {
            lanClient.sendSeekerAction(event);
          }
        },
      },
    );

    engineRef.current = engine;
    if (mode === 'solo') {
      engine.loadMap(soloMapId);
      soundEngine.startMusic('hide');
    } else if (room) {
      engine.syncRoomState(room, localPlayerId);
      soundEngine.startMusic(room.phase === 'seeking' ? 'seek' : 'hide');
    }

    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
      engine.dispose();
      engineRef.current = null;
      soundEngine.startMusic('menu');
    };
  }, []);

  // Sync graphics & sensitivity changes live
  useEffect(() => {
    engineRef.current?.applyGraphicsQuality(settings.graphicsQuality);
    engineRef.current?.setControlPreferences(settings.cameraSensitivity, settings.invertY);
  }, [settings]);

  // Sync RoomState updates from LAN server
  useEffect(() => {
    if (mode !== 'lan' || !room || !engineRef.current) return;
    engineRef.current.syncRoomState(room, localPlayerId);

    if (room.phase === 'seeking') {
      setPaintOpen(false);
      soundEngine.startMusic('seek');
    } else if (room.phase === 'hiding') {
      soundEngine.startMusic('hide');
    } else if (room.phase === 'match_results') {
      const lp = room.players.find((p) => p.id === localPlayerId);
      const won =
        (room.winnerTeam === 'hiders' && lp?.team === 'hider') ||
        (room.winnerTeam === 'seekers' && lp?.team === 'seeker');
      if (won) soundEngine.playVictory();
      else soundEngine.playDefeat();
    }
  }, [room, localPlayerId, mode]);

  // Sync paint tool state into GameEngine
  useEffect(() => {
    engineRef.current?.setPaintStudioState(
      paintOpen,
      paintTool,
      paintColor,
      paintPattern,
      brushSize,
    );
  }, [paintOpen, paintTool, paintColor, paintPattern, brushSize]);

  // Listen for LAN delta, discovery, taunt & seeker action events dispatched by App.tsx
  useEffect(() => {
    const onDelta = (e: Event) => {
      const d = (e as CustomEvent).detail;
      engineRef.current?.applyRemoteDelta(d.id, d.position, d.rotationY, d.animation, d.aimPitch);
    };
    const onDiscovery = (e: Event) => {
      const alert = (e as CustomEvent<DiscoveryAlert>).detail;
      soundEngine.playDiscovery();
      showBanner(
        alert.wasClone
          ? `${alert.seekerName} busted a Decoy Clone!`
          : `${alert.seekerName} captured ${alert.targetName}!`,
      );
    };
    const onTaunt = (e: Event) => {
      const taunt = (e as CustomEvent<TauntPulse>).detail;
      soundEngine.playTaunt(taunt.variant);
      engineRef.current?.spawnRingFX(taunt.position, 0xf59e0b);
      showBanner(`${taunt.playerName} taunted!`);
    };
    const onSeekerAction = (e: Event) => {
      const evt = (e as CustomEvent<SeekerActionEvent>).detail;
      engineRef.current?.applyRemoteSeekerAction(evt);
    };

    window.addEventListener('mc_player_delta', onDelta);
    window.addEventListener('mc_discovery', onDiscovery);
    window.addEventListener('mc_taunt', onTaunt);
    window.addEventListener('mc_seeker_action', onSeekerAction);
    return () => {
      window.removeEventListener('mc_player_delta', onDelta);
      window.removeEventListener('mc_discovery', onDiscovery);
      window.removeEventListener('mc_taunt', onTaunt);
      window.removeEventListener('mc_seeker_action', onSeekerAction);
    };
  }, []);

  const localPlayer = room?.players.find((p) => p.id === localPlayerId);
  const role = mode === 'solo' ? 'hider' : localPlayer?.team || 'hider';
  const phase = mode === 'solo' ? 'hiding' : room?.phase || 'hiding';
  const isSpectator = Boolean(localPlayer?.found || role === 'spectator');
  const clonesLeft = mode === 'solo' ? soloClonesLeft : localPlayer?.clonesRemaining ?? 0;

  const remainingHiders =
    room?.players.filter((p) => p.team === 'hider' && !p.found).length ?? 1;

  const handleSelectPose = (nextPose: CharacterPose) => {
    setPose(nextPose);
    engineRef.current?.setLocalPose(nextPose);
    if (mode === 'lan' && engineRef.current) {
      lanClient.updateAppearance(engineRef.current.getLocalAppearance());
    }
  };

  const handlePlaceClone = () => {
    if (!engineRef.current || clonesLeft <= 0) return;
    const pos = engineRef.current.getLocalPosition();
    const rotY = engineRef.current.getLocalYaw();
    soundEngine.playClone();
    engineRef.current.spawnRingFX(pos, 0x38bdf8);

    if (mode === 'solo') {
      const nextClone: CloneState = {
        id: `SOLO-${Date.now()}`,
        ownerId: 'solo',
        position: pos,
        rotationY: rotY,
        appearance: engineRef.current.getLocalAppearance(),
        createdAt: Date.now(),
      };
      const updated = [...soloClones, nextClone];
      setSoloClones(updated);
      setSoloClonesLeft((c) => c - 1);
      engineRef.current.syncClones(updated);
      showBanner('Decoy Clone placed!');
    } else {
      lanClient.placeClone(pos, rotY);
      showBanner('Clone synced to LAN!');
    }
  };

  const handleTaunt = () => {
    const variant = Math.floor(Math.random() * 3);
    if (mode === 'solo') {
      soundEngine.playTaunt(variant);
      if (engineRef.current) {
        engineRef.current.spawnRingFX(engineRef.current.getLocalPosition(), 0xf59e0b);
      }
      showBanner('Chameleon Taunt!');
    } else {
      lanClient.triggerTaunt(variant);
    }
  };

  const handleAttemptTag = () => {
    if (!catchTarget) {
      showBanner('Move closer to a suspicious object to inspect & capture!');
      return;
    }
    soundEngine.playCapture();
    lanClient.attemptCapture(catchTarget.id, catchTarget.isClone);
  };

  const formatClock = (sec: number) => {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  const phaseTitle =
    mode === 'solo'
      ? 'Practice Arena'
      : phase === 'hiding'
        ? 'Hiding Time'
        : phase === 'observation'
          ? 'Observation'
          : phase === 'seeking'
            ? 'Seeking Time'
            : phase === 'round_end'
              ? 'Next Turn...'
              : 'Match Complete';

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden select-none">
      {/* Isolated WebGL Viewport */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top Compact Landscape HUD */}
      <div className="fixed top-2 inset-x-2 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-950/88 border border-slate-700/80 rounded-xl px-3 py-1.5 pointer-events-auto shadow-lg">
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
              isSpectator
                ? 'bg-slate-700 text-slate-200'
                : role === 'seeker'
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-500 text-slate-950'
            }`}
          >
            {isSpectator ? 'Spectator' : role}
          </span>
          <span className="text-xs font-semibold text-white">{phaseTitle}</span>
          {mode === 'lan' && room && (
            <div className="flex items-center gap-1 pl-2 border-l border-slate-700 font-mono-tabular text-sm font-bold text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatClock(room.phaseTimeRemaining)}</span>
            </div>
          )}
        </div>

        {/* Center Alert Toast */}
        {bannerAlert && (
          <div className="bg-slate-950/92 border border-amber-400/50 text-amber-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-lg">
            {bannerAlert}
          </div>
        )}

        {/* Right HUD Counters & Quick Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {mode === 'lan' && room && (
            <div className="flex items-center gap-3 bg-slate-950/88 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs">
              <div className="flex items-center gap-1 text-emerald-300 font-semibold">
                <Users className="w-3.5 h-3.5" />
                <span className="font-mono-tabular">{remainingHiders} Hiders</span>
              </div>
              {localPlayer && (
                <div className="font-mono-tabular font-bold text-white border-l border-slate-700 pl-2.5">
                  {localPlayer.score} pts
                </div>
              )}
            </div>
          )}

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-950/88 border border-slate-700/80 text-slate-200 hover:bg-slate-800"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onExitMatch}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-950/90 border border-rose-700/80 text-rose-200 hover:bg-rose-900 text-xs font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Seeker Waiting Barrier Notice during Hiding Phase */}
      {mode === 'lan' && role === 'seeker' && phase === 'hiding' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-20 bg-rose-950/92 border border-rose-600/70 rounded-xl px-4 py-2 text-xs text-rose-100 flex items-center gap-2 pointer-events-none">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Wait inside the Seeker Lounge until Hiders finish painting!</span>
        </div>
      )}

      {/* Landscape Touch Controls */}
      <TouchControls
        role={role}
        phase={phase}
        isSpectator={isSpectator}
        pose={pose}
        crouching={crouching}
        clonesRemaining={clonesLeft}
        canTagTarget={Boolean(catchTarget)}
        paintOpen={paintOpen}
        freeCamActive={freeCam}
        seekerHud={seekerHud}
        hitConfirmed={hitConfirmed}
        onMoveJoystick={(x, z, active) => {
          if (!engineRef.current) return;
          engineRef.current.hasTouchInput = active;
          engineRef.current.setJoystick(x, z);
        }}
        onCameraDrag={(dx, dy) => engineRef.current?.rotateCameraBy(dx, dy)}
        onCanvasTapOrStroke={(x, y, p) =>
          engineRef.current ? engineRef.current.handleCanvasPointer(x, y, p) : false
        }
        onJump={() => {
          soundEngine.playJump();
          engineRef.current?.triggerJump();
        }}
        onToggleCrouch={() => {
          const next = !crouching;
          setCrouching(next);
          engineRef.current?.setCrouch(next);
        }}
        onSelectPose={handleSelectPose}
        onRotateCharacter={(rad) => engineRef.current?.rotateCharacterYaw(rad)}
        onTogglePaint={() => setPaintOpen((o) => !o)}
        onPlaceClone={handlePlaceClone}
        onTaunt={handleTaunt}
        onAttemptTag={handleAttemptTag}
        onToggleFreeCam={() => {
          const next = !freeCam;
          setFreeCam(next);
          engineRef.current?.setFreeCamera(next);
        }}
        onFireBlaster={() => engineRef.current?.fireSeekerBlaster()}
        onToggleAim={() => engineRef.current?.setSeekerAim(!seekerHud.aiming)}
        onReloadBlaster={() => engineRef.current?.reloadSeekerBlaster()}
        onInspectWeapon={() => engineRef.current?.triggerWeaponInspect()}
        onTriggerScanner={() => engineRef.current?.triggerSeekerScanner()}
        onTriggerPulse={() => engineRef.current?.triggerSeekerPulse()}
        onTriggerBoost={() => engineRef.current?.triggerSeekerBoost()}
      />

      {/* Expandable Hider Camouflage Painting Studio */}
      <PaintingPanel
        isOpen={paintOpen && role === 'hider' && !isSpectator}
        onClose={() => {
          setPaintOpen(false);
          if (mode === 'lan' && engineRef.current) {
            lanClient.updateAppearance(engineRef.current.getLocalAppearance());
          }
        }}
        activeTool={paintTool}
        onToolChange={setPaintTool}
        colorHex={paintColor}
        onColorChange={setPaintColor}
        pattern={paintPattern}
        onPatternChange={setPaintPattern}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        selectedPart={selectedPart}
        onSelectPart={setSelectedPart}
        onFillPart={(part) => engineRef.current?.fillBodyPart(part)}
        onFillFullBody={() => engineRef.current?.fillFullBody()}
        onUndo={() => engineRef.current?.undoPaint()}
        onRedo={() => engineRef.current?.redoPaint()}
        onResetWhite={() => engineRef.current?.resetPaintToWhite()}
        lastSample={lastSample}
      />

      {/* Match Results Screen */}
      {mode === 'lan' && room && room.phase === 'match_results' && localPlayerId && (
        <ResultsScreen
          room={room}
          localPlayerId={localPlayerId}
          onLeaveToMenu={onExitMatch}
        />
      )}
    </div>
  );
};
