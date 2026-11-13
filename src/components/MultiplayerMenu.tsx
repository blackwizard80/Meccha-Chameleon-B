import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Laptop,
  Network,
  Plus,
  RefreshCw,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import { MAP_CATALOG } from '../engine/maps/MapBuilder';
import { ConnectionStatus, lanClient } from '../network/LanClient';
import { DiscoveredRoom, GameMode, MapId, PlayerAppearance } from '../types/game';

interface MultiplayerMenuProps {
  playerName: string;
  appearance: PlayerAppearance;
  connectionStatus: ConnectionStatus;
  errorMessage: string | null;
  onBack: () => void;
  onOpenAndroidGuide: () => void;
}

const MODE_LABELS: Record<GameMode, string> = {
  infection: 'Infection',
  double: 'Double',
  reverse_chicken: 'Reverse Chicken',
  team_battle: 'Team Battle',
};

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({
  playerName,
  appearance,
  connectionStatus,
  errorMessage,
  onBack,
  onOpenAndroidGuide,
}) => {
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [port, setPort] = useState(3000);
  const [rooms, setRooms] = useState<DiscoveredRoom[]>([]);
  const [loadingScan, setLoadingScan] = useState(false);

  const [roomName, setRoomName] = useState(`${playerName}'s Room`);
  const [selectedMap, setSelectedMap] = useState<MapId>('mansion');
  const [selectedMode, setSelectedMode] = useState<GameMode>('infection');
  const [maxPlayers, setMaxPlayers] = useState(8);

  const [directIp, setDirectIp] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const scanLan = async () => {
    setLoadingScan(true);
    try {
      const info = await lanClient.fetchLanInfo();
      setLocalIps(info.localIps);
      setPort(info.port);
      setRooms(info.rooms);
    } catch {
      // ignore
    } finally {
      setLoadingScan(false);
    }
  };

  useEffect(() => {
    scanLan();
    const timer = window.setInterval(scanLan, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleHost = async () => {
    setBusy(true);
    setLocalError(null);
    try {
      await lanClient.hostRoom(
        playerName,
        {
          roomName: roomName.trim() || 'Chameleon LAN Room',
          mapId: selectedMap,
          gameMode: selectedMode,
          maxPlayers,
        },
        appearance,
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to host room');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (hostAddr: string, roomId?: string) => {
    setBusy(true);
    setLocalError(null);
    try {
      await lanClient.joinRoom(hostAddr, playerName, appearance, roomId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to connect to host');
    } finally {
      setBusy(false);
    }
  };

  const displayError = localError || errorMessage;

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/95 flex flex-col p-3 sm:p-5 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="font-display text-lg font-bold text-white leading-tight">
              Offline LAN Multiplayer
            </h1>
            <p className="text-xs text-slate-400">
              No internet required · Wi-Fi Router or Mobile Hotspot · 2–8 Players
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAndroidGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Hotspot Guide</span>
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono-tabular">
              {localIps[0] ? `${localIps[0]}:${port}` : 'LAN Ready'}
            </span>
          </div>
        </div>
      </div>

      {displayError && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-rose-950/80 border border-rose-700 text-xs text-rose-200 shrink-0">
          {displayError}
        </div>
      )}

      {/* Two-Column Landscape Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
        {/* LEFT COLUMN: Host Room */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto custom-scroll">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>Host LAN Room</span>
              </h2>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                Status: {connectionStatus}
              </span>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Room Name</label>
              <input
                type="text"
                value={roomName}
                maxLength={28}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Map</label>
                <select
                  value={selectedMap}
                  onChange={(e) => setSelectedMap(e.target.value as MapId)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                >
                  {MAP_CATALOG.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Game Mode</label>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value as GameMode)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                >
                  <option value="infection">Infection</option>
                  <option value="double">Double</option>
                  <option value="reverse_chicken">Reverse Chicken Race</option>
                  <option value="team_battle">Team Battle</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Max Players</span>
                <span className="font-mono-tabular text-emerald-400">{maxPlayers} Players</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
          </div>

          <button
            onClick={handleHost}
            disabled={busy}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create & Host Room</span>
          </button>
        </div>

        {/* RIGHT COLUMN: LAN Room Browser & Direct IP Join */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Network className="w-4 h-4 text-sky-400" />
              <span>Join Local Room</span>
            </h2>
            <button
              onClick={scanLan}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingScan ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Direct IP Connect Bar */}
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <input
              type="text"
              value={directIp}
              onChange={(e) => setDirectIp(e.target.value)}
              placeholder="Enter Host LAN IP (e.g. 192.168.1.42:3000)"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono-tabular text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
            />
            <button
              onClick={() => handleJoin(directIp)}
              disabled={busy || !directIp.trim()}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs whitespace-nowrap"
            >
              Connect IP
            </button>
          </div>

          {/* Discovered Local LAN Rooms */}
          <div className="flex-1 overflow-y-auto custom-scroll space-y-2">
            {rooms.length === 0 ? (
              <div className="h-full min-h-[120px] rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center text-center p-4">
                <Users className="w-7 h-7 text-slate-600 mb-1.5" />
                <p className="text-xs font-semibold text-slate-300">
                  No active rooms discovered on this subnet yet
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Have one player tap Create & Host Room, or enter the host's IP above.
                </p>
              </div>
            ) : (
              rooms.map((r) => (
                <div
                  key={r.roomId}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/90 border border-slate-800"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{r.roomName}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{MAP_CATALOG.find((m) => m.id === r.mapId)?.name || r.mapId}</span>
                      <span>·</span>
                      <span>{MODE_LABELS[r.gameMode]}</span>
                      <span>·</span>
                      <span className="font-mono-tabular">
                        {r.hostIp}:{r.port}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="font-mono-tabular text-xs text-emerald-400">
                      {r.playerCount}/{r.maxPlayers}
                    </span>
                    <button
                      onClick={() => handleJoin(`${r.hostIp}:${r.port}`, r.roomId)}
                      disabled={busy}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
