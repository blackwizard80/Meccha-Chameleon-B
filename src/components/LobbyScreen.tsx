import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Play,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { MAP_CATALOG } from '../engine/maps/MapBuilder';
import { lanClient } from '../network/LanClient';
import { GameMode, MapId, RoomState, TeamRole } from '../types/game';

interface LobbyScreenProps {
  room: RoomState;
  localPlayerId: string;
  localIps: string[];
  onLeave: () => void;
  onOpenCustomize: () => void;
  onOpenSeekerShowcase: () => void;
}

const MODES: { id: GameMode; name: string; summary: string }[] = [
  { id: 'infection', name: 'Infection', summary: 'Caught hiders convert into seekers' },
  { id: 'double', name: 'Double', summary: 'Everyone hides first, then all hunt' },
  { id: 'reverse_chicken', name: 'Reverse Chicken Race', summary: 'Memorize hiders in lineup before hunt' },
  { id: 'team_battle', name: 'Team Battle', summary: 'Squads alternate hiding & seeking turns' },
];

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  localPlayerId,
  localIps,
  onLeave,
  onOpenCustomize,
  onOpenSeekerShowcase,
}) => {
  const localPlayer = room.players.find((p) => p.id === localPlayerId);
  const isHost = Boolean(localPlayer?.isHost);

  const toggleReady = () => {
    if (!localPlayer) return;
    lanClient.send({ type: 'toggle_ready', ready: !localPlayer.ready });
  };

  const updateSettings = (patch: Partial<RoomState['settings']>) => {
    if (!isHost) return;
    lanClient.send({ type: 'update_settings', settings: patch });
  };

  const swapTeam = (playerId: string, current: TeamRole) => {
    if (!isHost || room.settings.autoTeams) return;
    const next: TeamRole = current === 'hider' ? 'seeker' : 'hider';
    lanClient.assignTeam(playerId, next);
  };

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/95 flex flex-col p-3 sm:p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Leave</span>
          </button>
          <div>
            <h1 className="font-display text-lg font-bold text-white leading-tight">
              {room.settings.roomName}
            </h1>
            <p className="text-xs text-slate-400 font-mono-tabular">
              Room {room.roomId} · Host IP {localIps[0] || 'LAN'}:3000 · {room.players.length}/
              {room.settings.maxPlayers} Players
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSeekerShowcase}
            className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-xs font-semibold text-cyan-200 flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Seeker Hunter</span>
          </button>
          <button
            onClick={onOpenCustomize}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
          >
            Shape & Size
          </button>
          {!isHost && (
            <button
              onClick={toggleReady}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                localPlayer?.ready
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{localPlayer?.ready ? 'Ready' : 'Tap Ready'}</span>
            </button>
          )}
          {isHost && (
            <button
              onClick={() => lanClient.send({ type: 'start_match' })}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center gap-1.5 shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Match</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 pt-3">
        {/* Left: Connected Players */}
        <div className="md:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2.5 shrink-0">
            <h2 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Connected Players</span>
            </h2>
            {isHost && !room.settings.autoTeams && (
              <span className="text-[11px] text-amber-300">Tap player team to swap</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll space-y-2">
            {room.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-7 h-7 rounded-lg border border-white/25 shrink-0"
                    style={{ backgroundColor: p.appearance.accentColor }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-white truncate">
                        {p.name} {p.id === localPlayerId ? '(You)' : ''}
                      </span>
                      {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-slate-400 capitalize">
                      {p.appearance.shape} · {p.appearance.size}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={!isHost || room.settings.autoTeams}
                    onClick={() => swapTeam(p.id, p.team)}
                    className={`px-2 py-1 rounded text-[11px] font-bold capitalize ${
                      p.team === 'seeker'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {room.settings.autoTeams ? 'Auto' : p.team}
                  </button>
                  <span
                    className={`text-[11px] font-semibold ${
                      p.ready ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {p.ready ? 'Ready' : 'Waiting'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Match Settings */}
        <div className="md:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 overflow-y-auto custom-scroll space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-sky-400" />
              <span>Match Configuration</span>
            </h2>
            {!isHost && (
              <span className="text-[11px] text-slate-400">Controlled by Host</span>
            )}
          </div>

          {/* Map Picker */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">3D Map</label>
            <div className="grid grid-cols-3 gap-2">
              {MAP_CATALOG.map((m) => {
                const active = room.settings.mapId === m.id;
                return (
                  <button
                    key={m.id}
                    disabled={!isHost}
                    onClick={() => updateSettings({ mapId: m.id as MapId })}
                    className={`text-left p-2.5 rounded-xl border transition-colors ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex gap-1 mb-1.5">
                      {m.palette.map((c, i) => (
                        <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="font-bold text-xs leading-snug">{m.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Game Mode Picker */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Game Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((gm) => {
                const active = room.settings.gameMode === gm.id;
                return (
                  <button
                    key={gm.id}
                    disabled={!isHost}
                    onClick={() => updateSettings({ gameMode: gm.id })}
                    className={`text-left p-2 rounded-xl border transition-colors ${
                      active
                        ? 'bg-sky-500/15 border-sky-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs">{gm.name}</div>
                    <div className="text-[11px] text-slate-400">{gm.summary}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Hiding Time</span>
                <span className="font-mono-tabular text-emerald-400">
                  {room.settings.hidingDuration}s
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={90}
                step={5}
                disabled={!isHost}
                value={room.settings.hidingDuration}
                onChange={(e) => updateSettings({ hidingDuration: Number(e.target.value) })}
                className="w-full accent-emerald-400"
              />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Round Duration</span>
                <span className="font-mono-tabular text-sky-400">
                  {room.settings.roundDuration}s
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={300}
                step={15}
                disabled={!isHost}
                value={room.settings.roundDuration}
                onChange={(e) => updateSettings({ roundDuration: Number(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          {/* Toggles: Team Assignment & Forced Taunt */}
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={!isHost}
              onClick={() => updateSettings({ autoTeams: !room.settings.autoTeams })}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
            >
              <span className="text-slate-300">Team Assignment</span>
              <span className="font-bold text-emerald-400">
                {room.settings.autoTeams ? 'Auto Balance' : 'Host Manual'}
              </span>
            </button>

            <button
              disabled={!isHost}
              onClick={() =>
                updateSettings({
                  forcedTauntInterval: room.settings.forcedTauntInterval === 0 ? 25 : 0,
                })
              }
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
            >
              <span className="text-slate-300">Forced Taunts</span>
              <span className="font-bold text-amber-400">
                {room.settings.forcedTauntInterval > 0
                  ? `Every ${room.settings.forcedTauntInterval}s`
                  : 'Off'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
