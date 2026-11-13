import { useEffect, useState } from 'react';
import {
  BookOpen,
  Map as MapIcon,
  Maximize2,
  Palette,
  Play,
  RotateCw,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { soundEngine } from './audio/SoundEngine';
import { CharacterPreviewCanvas } from './components/CharacterPreviewCanvas';
import { CustomizationModal } from './components/CustomizationModal';
import { GameViewport } from './components/GameViewport';
import { LobbyScreen } from './components/LobbyScreen';
import { MultiplayerMenu } from './components/MultiplayerMenu';
import {
  OfflineIndicator,
  PWAInstallButton,
  SplashScreen,
} from './components/PWAComponents';
import { SeekerShowcaseModal } from './components/SeekerShowcaseModal';
import {
  AndroidLanGuideModal,
  HowToPlayModal,
  MapSelectModal,
  SettingsModal,
} from './components/SettingsAndGuideModals';
import { MAP_CATALOG } from './engine/maps/MapBuilder';
import { ConnectionStatus, lanClient } from './network/LanClient';
import { ensureLanServer } from './network/LanServerRuntime';
import {
  loadProfile,
  loadSettings,
  saveProfile,
  saveSettings,
} from './settings/SettingsManager';
import { GameSettings, MapId, PlayerAppearance, RoomState } from './types/game';

type ScreenState = 'menu' | 'multiplayer' | 'lobby' | 'playing';

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [appearance, setAppearance] = useState<PlayerAppearance>(() => loadProfile());
  const [selectedMap, setSelectedMap] = useState<MapId>('mansion');

  const [screen, setScreen] = useState<ScreenState>('menu');
  const [playMode, setPlayMode] = useState<'solo' | 'lan'>('solo');

  const [room, setRoom] = useState<RoomState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [lanError, setLanError] = useState<string | null>(null);
  const [localIps, setLocalIps] = useState<string[]>([]);

  const [showCustomize, setShowCustomize] = useState(false);
  const [showSeekerShowcase, setShowSeekerShowcase] = useState(false);
  const [showMaps, setShowMaps] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  // Sync audio & persistence
  useEffect(() => {
    saveSettings(settings);
    soundEngine.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveProfile(appearance);
  }, [appearance]);

  // Set global LAN client callbacks. The native LAN server starts only when
  // the player opens the multiplayer screen.
  useEffect(() => {
    lanClient.setCallbacks({
      onStatusChange: (status, err) => {
        setConnectionStatus(status);
        if (err) setLanError(err);
      },
      onRoomState: (nextRoom) => {
        setRoom(nextRoom);
        setLocalPlayerId(lanClient.playerId);
        setLanError(null);
        if (nextRoom.phase === 'lobby') {
          setScreen('lobby');
        } else {
          setPlayMode('lan');
          setScreen('playing');
        }
      },
      onPlayerDelta: (id, position, rotationY, animation, aimPitch) => {
        window.dispatchEvent(
          new CustomEvent('mc_player_delta', {
            detail: { id, position, rotationY, animation, aimPitch },
          }),
        );
      },
      onDiscovery: (alert) => {
        window.dispatchEvent(new CustomEvent('mc_discovery', { detail: alert }));
      },
      onTaunt: (taunt) => {
        window.dispatchEvent(new CustomEvent('mc_taunt', { detail: taunt }));
      },
      onSeekerAction: (event) => {
        window.dispatchEvent(new CustomEvent('mc_seeker_action', { detail: event }));
      },
      onError: (msg) => {
        setLanError(msg);
      },
    });
  }, []);

  const requestLandscapeFullscreen = async () => {
    soundEngine.unlock();
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      const orient = screenOrientation();
      if (orient && orient.lock) {
        await orient.lock('landscape');
      }
    } catch {
      // Orientation lock only allowed in fullscreen/installed PWA on Android
    }
  };

  function screenOrientation(): { lock?: (mode: string) => Promise<void> } | null {
    return typeof window !== 'undefined' && window.screen?.orientation
      ? (window.screen.orientation as unknown as { lock?: (m: string) => Promise<void> })
      : null;
  }

  const startSoloPractice = (mapId: MapId) => {
    soundEngine.playMatchStart();
    requestLandscapeFullscreen();
    setSelectedMap(mapId);
    setPlayMode('solo');
    setScreen('playing');
  };

  const leaveMatchOrLobby = () => {
    soundEngine.playButton();
    if (playMode === 'lan' || room) {
      lanClient.leaveRoom();
      setRoom(null);
      setLocalPlayerId(null);
    }
    setScreen('menu');
    soundEngine.stopMusic();
  };

  const handleAppearanceChange = (next: PlayerAppearance) => {
    setAppearance(next);
    if (room) {
      lanClient.updateAppearance(next);
    }
  };

  const currentMapMeta = MAP_CATALOG.find((m) => m.id === selectedMap) || MAP_CATALOG[0];

  return (
    <div
      className="relative w-full h-full bg-slate-950 text-slate-100 overflow-hidden"
      onPointerDown={() => soundEngine.unlock()}
    >
      <SplashScreen />
      <OfflineIndicator />

      {/* Portrait Orientation Guard on Narrow Mobile Phones */}
      <div className="portrait-lock-overlay hidden fixed inset-0 z-[100] bg-slate-950 flex-col items-center justify-center p-6 text-center">
        <RotateCw className="w-12 h-12 text-emerald-400 mb-3 animate-spin" />
        <h2 className="font-display text-xl font-bold text-white">
          Rotate Device to Landscape
        </h2>
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
          Meccha Chameleon is designed for full-screen landscape play on Android smartphones.
        </p>
      </div>

      {/* MAIN MENU */}
      {screen === 'menu' && (
        <div className="w-full h-full bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,0.16),_rgba(15,23,42,1)_60%)] flex flex-col justify-between p-4 sm:p-6">
          {/* Top Bar */}
          <header className="flex items-center justify-between gap-4 shrink-0">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Meccha Chameleon
              </h1>
              <p className="text-xs text-slate-400">
                3D Painting Camouflage · Offline LAN Hide & Seek
              </p>
            </div>

            <div className="flex items-center gap-2">
              <PWAInstallButton />
              <button
                onClick={() => {
                  soundEngine.playButton();
                  requestLandscapeFullscreen();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-200"
              >
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Landscape Fullscreen</span>
              </button>
              <button
                onClick={() => {
                  soundEngine.playButton();
                  setShowHowTo(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-200"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>How to Play</span>
              </button>
              <button
                onClick={() => {
                  soundEngine.playButton();
                  setShowSettings(true);
                }}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Center Split: Action Menu (Left) + 3D Character Showcase (Right) */}
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-4 items-center py-2">
            <div className="col-span-6 sm:col-span-5 flex flex-col gap-2.5 max-w-md">
              <button
                onClick={() => startSoloPractice(selectedMap)}
                className="w-full py-3.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-base flex items-center justify-between shadow-xl transition-transform active:scale-[0.99]"
              >
                <span className="flex items-center gap-2.5">
                  <Play className="w-5 h-5 fill-current" />
                  <span>Play Practice Arena</span>
                </span>
                <span className="text-xs font-sans font-bold opacity-80">
                  {currentMapMeta.name}
                </span>
              </button>

              <button
                onClick={async () => {
                  soundEngine.playButton();
                  requestLandscapeFullscreen();
                  setLanError(null);
                  setScreen('multiplayer');
                  try {
                    await ensureLanServer();
                    const info = await lanClient.fetchLanInfo();
                    setLocalIps(info.localIps);
                  } catch (error) {
                    setLanError(
                      error instanceof Error
                        ? error.message
                        : 'Unable to start the offline LAN service.',
                    );
                  }
                }}
                className="w-full py-3.5 px-5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-base flex items-center justify-between shadow-lg transition-transform active:scale-[0.99]"
              >
                <span className="flex items-center gap-2.5">
                  <Users className="w-5 h-5" />
                  <span>LAN Multiplayer (2–8)</span>
                </span>
                <span className="text-xs font-sans font-bold opacity-80">Offline Wi-Fi</span>
              </button>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => {
                    soundEngine.playButton();
                    setShowCustomize(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-left flex items-center gap-2"
                >
                  <Palette className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Hider</div>
                    <div className="text-[11px] text-slate-400 capitalize truncate">
                      {appearance.shape}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    soundEngine.playButton();
                    setShowSeekerShowcase(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-left flex items-center gap-2"
                >
                  <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Seeker</div>
                    <div className="text-[11px] text-cyan-300 capitalize truncate">
                      {appearance.seekerTheme || 'cyan'}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    soundEngine.playButton();
                    setShowMaps(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-left flex items-center gap-2"
                >
                  <MapIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Maps (3)</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {currentMapMeta.name}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Right: Live 3D Humanoid Character Showcase */}
            <div className="col-span-6 sm:col-span-7 h-full min-h-[220px] relative">
              <CharacterPreviewCanvas
                shape={appearance.shape}
                size={appearance.size}
                pose={appearance.pose}
                textureDataUrl={appearance.textureDataUrl}
                autoRotate={true}
              />
              <div className="absolute bottom-2 right-2 text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg pointer-events-none">
                {settings.playerName} · Drag to inspect
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-between text-[11px] text-slate-500 shrink-0">
            <span>4 Modes: Infection · Double · Reverse Chicken Race · Team Battle</span>
            <span className="font-mono-tabular">
              LAN Host: {localIps[0] ? `${localIps[0]}:3000` : 'Ready'}
            </span>
          </footer>
        </div>
      )}

      {/* MULTIPLAYER MENU */}
      {screen === 'multiplayer' && (
        <MultiplayerMenu
          playerName={settings.playerName}
          appearance={appearance}
          connectionStatus={connectionStatus}
          errorMessage={lanError}
          onBack={() => {
            soundEngine.playButton();
            setScreen('menu');
          }}
          onOpenAndroidGuide={() => setShowAndroidGuide(true)}
        />
      )}

      {/* LOBBY SCREEN */}
      {screen === 'lobby' && room && localPlayerId && (
        <LobbyScreen
          room={room}
          localPlayerId={localPlayerId}
          localIps={localIps}
          onLeave={leaveMatchOrLobby}
          onOpenCustomize={() => setShowCustomize(true)}
          onOpenSeekerShowcase={() => setShowSeekerShowcase(true)}
        />
      )}

      {/* ACTIVE 3D GAMEPLAY */}
      {screen === 'playing' && (
        <GameViewport
          mode={playMode}
          soloMapId={selectedMap}
          room={room}
          localPlayerId={localPlayerId}
          appearance={appearance}
          settings={settings}
          onUpdateAppearance={handleAppearanceChange}
          onOpenSettings={() => setShowSettings(true)}
          onExitMatch={leaveMatchOrLobby}
        />
      )}

      {/* MODALS */}
      {showCustomize && (
        <CustomizationModal
          appearance={appearance}
          onChange={handleAppearanceChange}
          onClose={() => setShowCustomize(false)}
        />
      )}

      {showSeekerShowcase && (
        <SeekerShowcaseModal
          theme={appearance.seekerTheme || 'cyan'}
          onSelectTheme={(seekerTheme) =>
            handleAppearanceChange({ ...appearance, seekerTheme })
          }
          onClose={() => setShowSeekerShowcase(false)}
        />
      )}

      {showMaps && (
        <MapSelectModal
          selectedMap={selectedMap}
          onSelectMap={(id) => setSelectedMap(id)}
          onPlaySolo={(id) => {
            setShowMaps(false);
            startSoloPractice(id);
          }}
          onClose={() => setShowMaps(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}

      {showAndroidGuide && (
        <AndroidLanGuideModal
          localIps={localIps}
          onClose={() => setShowAndroidGuide(false)}
        />
      )}
    </div>
  );
}
