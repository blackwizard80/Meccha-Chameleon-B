import React from 'react';
import {
  BookOpen,
  Map as MapIcon,
  Settings,
  Smartphone,
  Volume2,
  X,
} from 'lucide-react';
import { MAP_CATALOG } from '../engine/maps/MapBuilder';
import { GameSettings, GraphicsQuality, MapId } from '../types/game';

export const SettingsModal: React.FC<{
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}> = ({ settings, onChange, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            <h2 className="font-display text-base font-bold text-white">Game Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Player Nickname</label>
            <input
              type="text"
              maxLength={18}
              value={settings.playerName}
              onChange={(e) => onChange({ ...settings, playerName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Graphics Quality (Android Optimization)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => onChange({ ...settings, graphicsQuality: q })}
                  className={`py-2 rounded-xl font-bold capitalize border ${
                    settings.graphicsQuality === q
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex justify-between text-slate-300">
              <span>Camera Sensitivity</span>
              <span className="font-mono-tabular text-emerald-400">
                {settings.cameraSensitivity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={2.2}
              step={0.1}
              value={settings.cameraSensitivity}
              onChange={(e) =>
                onChange({ ...settings, cameraSensitivity: Number(e.target.value) })
              }
              className="w-full accent-emerald-400"
            />
            <label className="flex items-center justify-between pt-1 cursor-pointer">
              <span className="text-slate-300">Invert Camera Y-Axis</span>
              <input
                type="checkbox"
                checked={settings.invertY}
                onChange={(e) => onChange({ ...settings, invertY: e.target.checked })}
                className="accent-emerald-400 w-4 h-4"
              />
            </label>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold pb-1">
              <Volume2 className="w-4 h-4 text-sky-400" />
              <span>Audio Volumes</span>
            </div>
            {[
              { key: 'masterVolume' as const, label: 'Master' },
              { key: 'musicVolume' as const, label: 'Music' },
              { key: 'sfxVolume' as const, label: 'Sound Effects' },
            ].map((v) => (
              <div key={v.key} className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>{v.label}</span>
                  <span className="font-mono-tabular">{Math.round(settings[v.key] * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings[v.key]}
                  onChange={(e) => onChange({ ...settings, [v.key]: Number(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const MapSelectModal: React.FC<{
  selectedMap: MapId;
  onSelectMap: (mapId: MapId) => void;
  onPlaySolo: (mapId: MapId) => void;
  onClose: () => void;
}> = ({ selectedMap, onSelectMap, onPlaySolo, onClose }) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/90 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapIcon className="w-4 h-4 text-emerald-400" />
            <h2 className="font-display text-base font-bold text-white">Select 3D Arena</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {MAP_CATALOG.map((m) => {
            const active = selectedMap === m.id;
            return (
              <div
                key={m.id}
                onClick={() => onSelectMap(m.id)}
                className={`cursor-pointer rounded-2xl border p-4 flex flex-col justify-between transition-colors ${
                  active
                    ? 'bg-emerald-500/10 border-emerald-400'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex gap-1.5 mb-3">
                    {m.palette.map((c, idx) => (
                      <div key={idx} className="h-3 flex-1 rounded" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <h3 className="font-display text-base font-bold text-white">{m.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{m.subtitle}</p>
                  <ul className="mt-3 space-y-1">
                    {m.highlights.map((h) => (
                      <li key={h} className="text-[11px] text-slate-300">
                        · {h}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlaySolo(m.id);
                  }}
                  className="mt-4 w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  Enter Practice Arena
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
    <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <h2 className="font-display text-base font-bold text-white">How to Play Meccha Chameleon</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scroll p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <h3 className="font-display text-sm font-bold text-emerald-400">As a Hider (Camouflage)</h3>
          <p>1. You begin pure white. Open <strong>Paint</strong> during Hiding Time.</p>
          <p>2. Select the <strong>Sample (Eyedropper)</strong> tool and tap wooden crates, marble floors, velvet sofas, or sewer pipes to copy their exact color and texture pattern.</p>
          <p>3. Use <strong>Brush</strong>, <strong>Part</strong>, or <strong>Full</strong> to paint your 13 body parts so you blend seamlessly into nearby objects.</p>
          <p>4. Choose a <strong>Pose</strong> (Crouch, Sit, Lie, Curl, Lean, Statue) and rotate with ⟲ / ⟳ to align with walls or furniture. Drop <strong>Clones</strong> to trick Seekers!</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <h3 className="font-display text-sm font-bold text-rose-400">As a Seeker (Observer)</h3>
          <p>1. Wait inside the designated Waiting Zone until Hiding Time ends.</p>
          <p>2. Patrol rooms carefully—no wall outlines or nametags reveal hidden players!</p>
          <p>3. Spot unnatural seams, slightly off-shade limbs, awkward poses, or listen for hider Taunts.</p>
          <p>4. Move close to any suspicious figure and tap <strong>CAPTURE!</strong> to tag them.</p>
        </div>
        <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-3.5">
          <h3 className="font-display text-sm font-bold text-sky-400 mb-1.5">4 Game Modes</h3>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><strong>Infection:</strong> Caught hiders join the Seeker team.</div>
            <div><strong>Double:</strong> Everyone hides first, then everyone hunts each other.</div>
            <div><strong>Reverse Chicken Race:</strong> Seekers memorize hiders in a lineup before the hunt; tagging decoy clones costs points!</div>
            <div><strong>Team Battle:</strong> Two squads swap hiding & seeking turns across 2 rounds.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const AndroidLanGuideModal: React.FC<{
  localIps: string[];
  onClose: () => void;
}> = ({ localIps, onClose }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
    <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-amber-400" />
          <h2 className="font-display text-base font-bold text-white">
            Offline Android LAN & Hotspot Setup
          </h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div className="font-bold text-emerald-400 mb-1">1. Same Wi-Fi or Mobile Hotspot (Zero Internet Needed)</div>
          <p>
            Turn on Wi-Fi Hotspot on one Android phone (or connect all devices to an offline Wi-Fi router).
            Run the local game server on the host device or laptop (<code className="text-amber-300">npm start</code>).
          </p>
          <p className="mt-1 font-mono-tabular text-sky-300">
            Detected Local IP(s): {localIps.join(', ') || '192.168.x.x'} · Port 3000
          </p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div className="font-bold text-emerald-400 mb-1">2. Connect Other Android Phones</div>
          <p>
            On each joining Android device, open Chrome/WebView to{' '}
            <code className="text-amber-300">http://{localIps[0] || '192.168.43.1'}:3000</code>, or tap{' '}
            <strong>Multiplayer → Join Local Room</strong> and enter the Host IP. UDP subnet discovery (Port 41234) also lists active rooms automatically.
          </p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div className="font-bold text-emerald-400 mb-1">3. Packaging as Native Landscape Android APK</div>
          <p>
            To package this project as an installable Android APK with landscape orientation lock, bundle with Capacitor (<code className="text-amber-300">npx cap add android</code>), set <code className="text-amber-300">android:screenOrientation="landscape"</code> and <code className="text-amber-300">usesCleartextTraffic="true"</code> in <code className="text-amber-300">AndroidManifest.xml</code> for local <code className="text-amber-300">ws://</code> LAN sockets.
          </p>
        </div>
      </div>
    </div>
  </div>
);
