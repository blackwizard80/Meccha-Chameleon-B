import dgram from 'dgram';
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  ClientMessage,
  CloneState,
  DiscoveredRoom,
  DiscoveryAlert,
  GameMode,
  MapId,
  PlayerAppearance,
  PlayerState,
  RoomSettings,
  RoomState,
  ServerMessage,
  TauntPulse,
  TeamRole,
} from './src/types/game.ts';

const PORT = Number(process.env.PORT || 3000);
const LAN_DISCOVERY_PORT = 41234;

function getLocalIPv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const candidates: Array<{ address: string; score: number }> = [];

  for (const [name, entries] of Object.entries(nets)) {
    for (const net of entries || []) {
      if (net.family !== 'IPv4' || net.internal) continue;

      const address = net.address;
      const octets = address.split('.').map(Number);
      const isPrivate =
        octets[0] === 10 ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] === 192 && octets[1] === 168) ||
        (octets[0] === 169 && octets[1] === 254);
      const isWifiInterface = /(wlan|wifi|ap|swlan|p2p)/i.test(name);

      // Prefer Android Wi-Fi / hotspot interfaces and private LAN addresses.
      // Keep other non-loopback addresses as fallbacks for unusual devices.
      candidates.push({
        address,
        score: (isWifiInterface ? 4 : 0) + (isPrivate ? 2 : 0),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return [...new Set(candidates.map((item) => item.address))].length
    ? [...new Set(candidates.map((item) => item.address))]
    : ['127.0.0.1'];
}

function makeId(prefix = ''): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

interface InternalRoom {
  state: RoomState;
  sockets: Map<string, WebSocket>;
  reconnectTokens: Map<string, string>; // token -> playerId
  lastForcedTauntAt: number;
  lastTickAt: number;
}

const rooms = new Map<string, InternalRoom>();
const discoveredLanRooms = new Map<string, DiscoveredRoom>();

const DEFAULT_APPEARANCE: PlayerAppearance = {
  shape: 'normal',
  size: 'normal',
  pose: 'standing',
  textureDataUrl: null,
  accentColor: '#F8FAFC',
};

const DEFAULT_SETTINGS: RoomSettings = {
  roomName: 'Chameleon LAN Party',
  mapId: 'mansion',
  gameMode: 'infection',
  maxPlayers: 8,
  hidingDuration: 35,
  roundDuration: 150,
  autoTeams: true,
  forcedTauntInterval: 0,
  maxClonesPerHider: 3,
  cloneCooldown: 8,
};

function sendToSocket(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room: InternalRoom, msg: ServerMessage, excludeId?: string): void {
  const payload = JSON.stringify(msg);
  for (const [pid, ws] of room.sockets.entries()) {
    if (excludeId && pid === excludeId) continue;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function assignTeamsForMatch(room: InternalRoom): void {
  const players = room.state.players;
  const mode = room.state.settings.gameMode;

  if (mode === 'double') {
    players.forEach((p, idx) => {
      p.team = 'hider';
      p.squad = (idx % 2) as 0 | 1;
      p.found = false;
      p.clonesRemaining = room.state.settings.maxClonesPerHider;
    });
    return;
  }

  if (mode === 'team_battle') {
    players.forEach((p, idx) => {
      if (room.state.settings.autoTeams) {
        p.squad = (idx % 2) as 0 | 1;
      }
      const hidingSquad = room.state.battleTurn === 1 ? 0 : 1;
      p.team = p.squad === hidingSquad ? 'hider' : 'seeker';
      p.found = false;
      p.clonesRemaining = p.team === 'hider' ? room.state.settings.maxClonesPerHider : 0;
    });
    return;
  }

  // Infection & Reverse Chicken Race
  if (room.state.settings.autoTeams) {
    const seekerCount = Math.max(1, Math.floor(players.length / 4));
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, idx) => {
      p.team = idx < seekerCount ? 'seeker' : 'hider';
      p.found = false;
      p.clonesRemaining = p.team === 'hider' ? room.state.settings.maxClonesPerHider : 0;
    });
  } else {
    // Ensure at least 1 seeker and 1 hider when >= 2 players
    const hasSeeker = players.some((p) => p.team === 'seeker');
    const hasHider = players.some((p) => p.team === 'hider');
    if (players.length >= 2 && (!hasSeeker || !hasHider)) {
      players.forEach((p, idx) => {
        p.team = idx === 0 ? 'seeker' : 'hider';
      });
    }
    players.forEach((p) => {
      p.found = false;
      p.clonesRemaining = p.team === 'hider' ? room.state.settings.maxClonesPerHider : 0;
    });
  }
}

function getSpawnPosition(mapId: MapId, role: TeamRole, idx: number): { x: number; y: number; z: number } {
  if (role === 'seeker') {
    if (mapId === 'sewer') return { x: (idx - 1) * 1.3, y: 0.15, z: 15.0 };
    if (mapId === 'indoor_country') return { x: (idx - 1) * 1.3, y: 0.05, z: 14.0 };
    return { x: (idx - 1) * 1.3, y: 0.05, z: 13.2 };
  }
  const presets: Record<MapId, { x: number; y: number; z: number }[]> = {
    mansion: [
      { x: -11.5, y: 0.05, z: 1.5 },
      { x: -12.5, y: 0.05, z: -12.0 },
      { x: 11.0, y: 0.05, z: 1.5 },
      { x: 11.5, y: 0.05, z: -10.5 },
      { x: 0, y: 2.85, z: -13.2 },
      { x: -9.5, y: 0.05, z: 11.5 },
      { x: 10.5, y: 0.05, z: 10.5 },
      { x: 0, y: 0.05, z: -0.5 },
    ],
    indoor_country: [
      { x: -12.5, y: 0.05, z: -13.0 },
      { x: -12.0, y: 0.05, z: 4.5 },
      { x: 12.5, y: 2.65, z: -12.5 },
      { x: 13.5, y: 0.05, z: 5.5 },
      { x: 0, y: 0.05, z: -7.5 },
      { x: -14.5, y: 0.05, z: 13.0 },
      { x: 9.5, y: 0.05, z: -1.5 },
      { x: 2.5, y: 0.05, z: 5.5 },
    ],
    sewer: [
      { x: -15.5, y: 0.05, z: -13.5 },
      { x: -16.8, y: 2.15, z: -5.0 },
      { x: 16.8, y: 2.15, z: 4.0 },
      { x: 14.5, y: 0.05, z: -11.0 },
      { x: -8.5, y: 0.05, z: -8.0 },
      { x: 8.5, y: 0.05, z: 8.0 },
      { x: -15.5, y: 0.05, z: 9.5 },
      { x: 14.5, y: 0.05, z: 12.0 },
    ],
  };
  const list = presets[mapId] || presets.mansion;
  return list[idx % list.length];
}

function startRound(room: InternalRoom, resetScores: boolean): void {
  const st = room.state;
  if (resetScores) {
    st.battleTurn = 1;
    st.squadScores = [0, 0];
    st.players.forEach((p) => {
      p.score = 0;
      p.captures = 0;
      p.survivedSeconds = 0;
    });
  }
  st.clones = [];
  st.winnerTeam = null;
  st.lastEventMessage = 'Hiding Time! Paint & blend into the environment.';
  assignTeamsForMatch(room);

  st.players.forEach((p, idx) => {
    p.position = getSpawnPosition(st.settings.mapId, p.team, idx);
    p.rotationY = 0;
    p.animation = 'idle';
  });

  st.phase = 'hiding';
  st.phaseTotalTime = st.settings.hidingDuration;
  st.phaseTimeRemaining = st.settings.hidingDuration;
  room.lastForcedTauntAt = Date.now();

  broadcastRoom(room, { type: 'room_state', room: st });
}

function finishRoundOrMatch(room: InternalRoom, winner: RoomState['winnerTeam'], reason: string): void {
  const st = room.state;
  st.lastEventMessage = reason;

  // Award survival points to remaining hiders
  st.players.forEach((p) => {
    if (p.team === 'hider' && !p.found) {
      p.score += 150;
      if (st.settings.gameMode === 'team_battle') {
        st.squadScores[p.squad] += 150;
      }
    }
  });

  if (st.settings.gameMode === 'team_battle' && st.battleTurn === 1) {
    st.phase = 'round_end';
    st.winnerTeam = winner;
    st.phaseTotalTime = 7;
    st.phaseTimeRemaining = 7;
    broadcastRoom(room, { type: 'room_state', room: st });
    return;
  }

  if (st.settings.gameMode === 'team_battle') {
    if (st.squadScores[0] > st.squadScores[1]) st.winnerTeam = 'squad_0';
    else if (st.squadScores[1] > st.squadScores[0]) st.winnerTeam = 'squad_1';
    else st.winnerTeam = 'draw';
  } else {
    st.winnerTeam = winner;
  }

  st.phase = 'match_results';
  st.phaseTimeRemaining = 0;
  broadcastRoom(room, { type: 'room_state', room: st });
}

// Authoritative 1Hz timer & game mode progression loop
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    const st = room.state;
    const elapsedSec = (now - room.lastTickAt) / 1000;
    room.lastTickAt = now;

    if (st.players.length === 0) {
      rooms.delete(roomId);
      continue;
    }

    if (st.phase === 'hiding') {
      st.phaseTimeRemaining = Math.max(0, st.phaseTimeRemaining - elapsedSec);
      if (st.phaseTimeRemaining <= 0) {
        if (st.settings.gameMode === 'reverse_chicken') {
          // Observation Phase: line hiders up for seekers to inspect
          st.phase = 'observation';
          st.phaseTotalTime = 10;
          st.phaseTimeRemaining = 10;
          st.lastEventMessage = 'Observation Phase! Memorize the hiders!';
          let hIdx = 0;
          st.players.forEach((p) => {
            if (p.team === 'hider') {
              p.position = { x: (hIdx - 1.5) * 1.8, y: 0.1, z: 2.5 };
              p.rotationY = 0;
              hIdx++;
            }
          });
        } else {
          // Transition directly to Seeking
          if (st.settings.gameMode === 'double') {
            st.players.forEach((p) => {
              p.team = 'seeker';
              p.found = false;
            });
            st.lastEventMessage = 'Double Mode! Everyone is now a Seeker!';
          } else {
            st.lastEventMessage = 'Seekers Released! Find the camouflaged hiders!';
          }
          st.phase = 'seeking';
          st.phaseTotalTime = st.settings.roundDuration;
          st.phaseTimeRemaining = st.settings.roundDuration;
        }
        broadcastRoom(room, { type: 'room_state', room: st });
      } else {
        broadcastRoom(room, { type: 'room_state', room: st });
      }
    } else if (st.phase === 'observation') {
      st.phaseTimeRemaining = Math.max(0, st.phaseTimeRemaining - elapsedSec);
      if (st.phaseTimeRemaining <= 0) {
        st.phase = 'seeking';
        st.phaseTotalTime = st.settings.roundDuration;
        st.phaseTimeRemaining = st.settings.roundDuration;
        st.lastEventMessage = 'Seeking Time! Identify the real chameleons!';
        // Scatter hiders back to hide positions
        let hIdx = 0;
        st.players.forEach((p) => {
          if (p.team === 'hider') {
            p.position = getSpawnPosition(st.settings.mapId, 'hider', hIdx++);
          }
        });
      }
      broadcastRoom(room, { type: 'room_state', room: st });
    } else if (st.phase === 'seeking') {
      st.phaseTimeRemaining = Math.max(0, st.phaseTimeRemaining - elapsedSec);

      // Increment survival time & score for active hiders
      st.players.forEach((p) => {
        if (p.team === 'hider' && !p.found) {
          p.survivedSeconds += elapsedSec;
          p.score += Math.round(elapsedSec * 2);
          if (st.settings.gameMode === 'team_battle') {
            st.squadScores[p.squad] += Math.round(elapsedSec * 2);
          }
        }
      });

      // Forced Taunt Mechanic
      if (
        st.settings.forcedTauntInterval > 0 &&
        now - room.lastForcedTauntAt >= st.settings.forcedTauntInterval * 1000
      ) {
        room.lastForcedTauntAt = now;
        const activeHiders = st.players.filter((p) => p.team === 'hider' && !p.found);
        activeHiders.forEach((h, i) => {
          const taunt: TauntPulse = {
            id: makeId('TN'),
            playerId: h.id,
            playerName: h.name,
            position: h.position,
            variant: i % 3,
            timestamp: now,
          };
          broadcastRoom(room, { type: 'taunt_event', taunt });
        });
      }

      // Check win condition
      const remainingHiders = st.players.filter((p) => p.team === 'hider' && !p.found);
      if (st.settings.gameMode === 'double') {
        const alive = st.players.filter((p) => !p.found);
        if (alive.length <= 1 && st.players.length >= 2) {
          finishRoundOrMatch(room, 'seekers', `${alive[0]?.name || 'Champion'} wins Double Hunt!`);
          continue;
        }
      } else if (remainingHiders.length === 0 && st.players.some((p) => p.team === 'seeker')) {
        finishRoundOrMatch(room, 'seekers', 'All Hiders were discovered! Seekers win!');
        continue;
      }

      if (st.phaseTimeRemaining <= 0) {
        finishRoundOrMatch(room, 'hiders', 'Time expired! Camouflaged Hiders survived!');
        continue;
      }

      broadcastRoom(room, { type: 'room_state', room: st });
    } else if (st.phase === 'round_end') {
      st.phaseTimeRemaining = Math.max(0, st.phaseTimeRemaining - elapsedSec);
      if (st.phaseTimeRemaining <= 0) {
        st.battleTurn = 2;
        startRound(room, false);
      } else {
        broadcastRoom(room, { type: 'room_state', room: st });
      }
    }
  }
}, 1000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  // UDP LAN Discovery Socket (Port 41234)
  const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  udpSocket.on('error', () => {
    // Non-fatal in restricted sandbox environments
  });
  udpSocket.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.app === 'MECCHA_CHAMELEON' && data.room) {
        const r = data.room as Omit<DiscoveredRoom, 'hostIp' | 'lastSeen'>;
        discoveredLanRooms.set(r.roomId, {
          ...r,
          hostIp: rinfo.address,
          lastSeen: Date.now(),
        });
      }
    } catch {
      // Ignore malformed UDP packets
    }
  });
  try {
    udpSocket.bind(LAN_DISCOVERY_PORT, () => {
      try {
        udpSocket.setBroadcast(true);
      } catch {
        // Ignore
      }
    });
  } catch {
    // Ignore if port bound
  }

  // Broadcast local rooms over LAN UDP every 1.5 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [id, dr] of discoveredLanRooms.entries()) {
      if (now - dr.lastSeen > 5000) discoveredLanRooms.delete(id);
    }

    for (const room of rooms.values()) {
      const st = room.state;
      const packet = JSON.stringify({
        app: 'MECCHA_CHAMELEON',
        room: {
          roomId: st.roomId,
          roomName: st.settings.roomName,
          port: PORT,
          mapId: st.settings.mapId,
          gameMode: st.settings.gameMode,
          playerCount: st.players.length,
          maxPlayers: st.settings.maxPlayers,
          phase: st.phase,
        },
      });
      try {
        udpSocket.send(packet, LAN_DISCOVERY_PORT, '255.255.255.255');
      } catch {
        // Ignore broadcast errors in offline/restricted interfaces
      }
    }
  }, 1500);

  // REST API for LAN Discovery & Local IP Address Info
  app.get('/api/lan-info', (_req, res) => {
    const localRooms: DiscoveredRoom[] = [];
    const ips = getLocalIPv4Addresses();
    const primaryIp = ips[0] || '127.0.0.1';

    for (const room of rooms.values()) {
      localRooms.push({
        roomId: room.state.roomId,
        roomName: room.state.settings.roomName,
        hostIp: primaryIp,
        port: PORT,
        mapId: room.state.settings.mapId,
        gameMode: room.state.settings.gameMode,
        playerCount: room.state.players.length,
        maxPlayers: room.state.settings.maxPlayers,
        phase: room.state.phase,
        lastSeen: Date.now(),
      });
    }

    const merged = new Map<string, DiscoveredRoom>();
    for (const r of discoveredLanRooms.values()) merged.set(r.roomId, r);
    for (const r of localRooms) merged.set(r.roomId, r);

    res.json({
      localIps: ips,
      port: PORT,
      rooms: Array.from(merged.values()),
    });
  });

  // WebSocket Multiplayer Connection Handler
  wss.on('connection', (ws) => {
    let currentRoomId: string | null = null;
    let currentPlayerId: string | null = null;

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        sendToSocket(ws, { type: 'pong', sentAt: msg.sentAt, serverTime: Date.now() });
        return;
      }

      if (msg.type === 'create_room') {
        const roomId = makeId('RM-');
        const playerId = makeId('P-');
        const token = makeId('TK-');
        const settings: RoomSettings = { ...DEFAULT_SETTINGS, ...msg.settings };

        const hostPlayer: PlayerState = {
          id: playerId,
          name: (msg.playerName || 'Host').slice(0, 18),
          isHost: true,
          ready: true,
          connected: true,
          team: 'hider',
          squad: 0,
          found: false,
          position: { x: 0, y: 0.05, z: 0 },
          rotationY: 0,
          animation: 'idle',
          appearance: msg.appearance || DEFAULT_APPEARANCE,
          score: 0,
          captures: 0,
          survivedSeconds: 0,
          clonesRemaining: settings.maxClonesPerHider,
          lastTauntAt: 0,
        };

        const roomState: RoomState = {
          roomId,
          hostId: playerId,
          phase: 'lobby',
          phaseTimeRemaining: 0,
          phaseTotalTime: 0,
          battleTurn: 1,
          squadScores: [0, 0],
          settings,
          players: [hostPlayer],
          clones: [],
          winnerTeam: null,
          lastEventMessage: 'Room created on local LAN.',
        };

        const room: InternalRoom = {
          state: roomState,
          sockets: new Map([[playerId, ws]]),
          reconnectTokens: new Map([[token, playerId]]),
          lastForcedTauntAt: Date.now(),
          lastTickAt: Date.now(),
        };
        rooms.set(roomId, room);
        currentRoomId = roomId;
        currentPlayerId = playerId;

        sendToSocket(ws, {
          type: 'welcome',
          playerId,
          reconnectToken: token,
          room: roomState,
        });
        return;
      }

      if (msg.type === 'join_room') {
        // Join specific roomId or first available room on this LAN host
        const targetRoom = msg.roomId
          ? rooms.get(msg.roomId)
          : Array.from(rooms.values())[0];

        if (!targetRoom) {
          sendToSocket(ws, {
            type: 'error',
            message: 'No active LAN room found on this host. Ask host to create a room first.',
          });
          return;
        }

        // Check reconnection token
        if (msg.reconnectToken && targetRoom.reconnectTokens.has(msg.reconnectToken)) {
          const existingId = targetRoom.reconnectTokens.get(msg.reconnectToken)!;
          const existing = targetRoom.state.players.find((p) => p.id === existingId);
          if (existing) {
            existing.connected = true;
            targetRoom.sockets.set(existingId, ws);
            currentRoomId = targetRoom.state.roomId;
            currentPlayerId = existingId;
            sendToSocket(ws, {
              type: 'welcome',
              playerId: existingId,
              reconnectToken: msg.reconnectToken,
              room: targetRoom.state,
            });
            broadcastRoom(targetRoom, { type: 'room_state', room: targetRoom.state });
            return;
          }
        }

        if (targetRoom.state.players.length >= targetRoom.state.settings.maxPlayers) {
          sendToSocket(ws, { type: 'error', message: 'Room is full.' });
          return;
        }

        const playerId = makeId('P-');
        const token = makeId('TK-');
        const idx = targetRoom.state.players.length;
        const joinPlayer: PlayerState = {
          id: playerId,
          name: (msg.playerName || `Player${idx + 1}`).slice(0, 18),
          isHost: false,
          ready: false,
          connected: true,
          team: idx % 2 === 0 ? 'hider' : 'seeker',
          squad: (idx % 2) as 0 | 1,
          found: targetRoom.state.phase === 'seeking',
          position: getSpawnPosition(targetRoom.state.settings.mapId, 'hider', idx),
          rotationY: 0,
          animation: 'idle',
          appearance: msg.appearance || DEFAULT_APPEARANCE,
          score: 0,
          captures: 0,
          survivedSeconds: 0,
          clonesRemaining: targetRoom.state.settings.maxClonesPerHider,
          lastTauntAt: 0,
        };

        targetRoom.state.players.push(joinPlayer);
        targetRoom.sockets.set(playerId, ws);
        targetRoom.reconnectTokens.set(token, playerId);
        currentRoomId = targetRoom.state.roomId;
        currentPlayerId = playerId;

        sendToSocket(ws, {
          type: 'welcome',
          playerId,
          reconnectToken: token,
          room: targetRoom.state,
        });
        broadcastRoom(targetRoom, { type: 'room_state', room: targetRoom.state });
        return;
      }

      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;
      const player = room.state.players.find((p) => p.id === currentPlayerId);
      if (!player) return;

      switch (msg.type) {
        case 'toggle_ready':
          player.ready = msg.ready;
          broadcastRoom(room, { type: 'room_state', room: room.state });
          break;

        case 'update_settings':
          if (player.isHost) {
            room.state.settings = { ...room.state.settings, ...msg.settings };
            broadcastRoom(room, { type: 'room_state', room: room.state });
          }
          break;

        case 'assign_team':
          if (player.isHost) {
            const target = room.state.players.find((p) => p.id === msg.targetPlayerId);
            if (target) {
              target.team = msg.team;
              target.squad = msg.team === 'hider' ? 0 : 1;
              broadcastRoom(room, { type: 'room_state', room: room.state });
            }
          }
          break;

        case 'start_match':
          if (player.isHost && room.state.players.length >= 1) {
            startRound(room, true);
          }
          break;

        case 'end_match':
          if (player.isHost) {
            finishRoundOrMatch(room, 'draw', 'Host ended the match.');
          }
          break;

        case 'return_to_lobby':
          if (player.isHost) {
            room.state.phase = 'lobby';
            room.state.clones = [];
            room.state.winnerTeam = null;
            room.state.players.forEach((p) => {
              p.found = false;
              p.ready = p.isHost;
            });
            broadcastRoom(room, { type: 'room_state', room: room.state });
          }
          break;

        case 'player_transform':
          player.position = msg.position;
          player.rotationY = msg.rotationY;
          player.aimPitch = msg.aimPitch;
          player.animation = msg.animation;
          broadcastRoom(
            room,
            {
              type: 'player_delta',
              id: player.id,
              position: msg.position,
              rotationY: msg.rotationY,
              aimPitch: msg.aimPitch,
              animation: msg.animation,
            },
            player.id,
          );
          break;

        case 'seeker_action':
          if (
            player.team === 'seeker' &&
            msg.event.action !== 'shoot' &&
            msg.event.action !== 'reload'
          ) {
            broadcastRoom(
              room,
              {
                type: 'seeker_action_event',
                event: { ...msg.event, playerId: player.id },
              },
              player.id,
            );
          }
          break;

        case 'update_appearance':
          player.appearance = msg.appearance;
          broadcastRoom(room, { type: 'room_state', room: room.state });
          break;

        case 'place_clone': {
          if (player.team !== 'hider' || player.found || player.clonesRemaining <= 0) break;
          const now = Date.now();
          const latestClone = room.state.clones
            .filter((c) => c.ownerId === player.id)
            .sort((a, b) => b.createdAt - a.createdAt)[0];
          if (
            latestClone &&
            now - latestClone.createdAt < room.state.settings.cloneCooldown * 1000
          ) {
            sendToSocket(ws, { type: 'error', message: 'Clone ability is cooling down.' });
            break;
          }
          player.clonesRemaining -= 1;
          const clone: CloneState = {
            id: makeId('CL-'),
            ownerId: player.id,
            position: msg.position,
            rotationY: msg.rotationY,
            appearance: { ...player.appearance },
            createdAt: now,
          };
          room.state.clones.push(clone);
          broadcastRoom(room, { type: 'room_state', room: room.state });
          break;
        }

        case 'attempt_capture': {
          // Keep LAN play focused on non-ranged, close-range game interactions.
          if (msg.weaponHit) break;
          if (room.state.phase !== 'seeking') break;
          if (player.team !== 'seeker' || player.found) break;

          if (msg.isClone) {
            const cIdx = room.state.clones.findIndex((c) => c.id === msg.targetId);
            if (cIdx !== -1) {
              room.state.clones.splice(cIdx, 1);
              if (room.state.settings.gameMode === 'reverse_chicken') {
                player.score = Math.max(0, player.score - 35);
              }
              const alert: DiscoveryAlert = {
                id: makeId('AL-'),
                seekerName: player.name,
                targetName: 'Decoy Clone',
                wasClone: true,
                timestamp: Date.now(),
              };
              broadcastRoom(room, { type: 'discovery_event', alert });
              broadcastRoom(room, { type: 'room_state', room: room.state });
            }
            break;
          }

          const target = room.state.players.find((p) => p.id === msg.targetId);
          if (!target || target.id === player.id || target.found) break;
          if (room.state.settings.gameMode !== 'double' && target.team !== 'hider') break;

          // Distance validation (blaster ranged shot up to 22m or close tag 4.2m)
          const dx = target.position.x - player.position.x;
          const dy = target.position.y - player.position.y;
          const dz = target.position.z - player.position.z;
          const maxRange = msg.weaponHit ? 22.0 : 4.2;
          if (Math.hypot(dx, dy, dz) > maxRange) break;

          player.captures += 1;
          const bonus = room.state.settings.gameMode === 'reverse_chicken' ? 150 : 100;
          player.score += bonus;
          if (room.state.settings.gameMode === 'team_battle') {
            room.state.squadScores[player.squad] += bonus;
          }

          if (room.state.settings.gameMode === 'infection') {
            target.team = 'seeker';
            target.found = false;
            room.state.lastEventMessage = `${target.name} was infected by ${player.name}!`;
          } else {
            target.found = true;
            target.team = 'spectator';
            room.state.lastEventMessage = `${player.name} discovered ${target.name}!`;
          }

          const alert: DiscoveryAlert = {
            id: makeId('AL-'),
            seekerName: player.name,
            targetName: target.name,
            wasClone: false,
            timestamp: Date.now(),
          };
          broadcastRoom(room, { type: 'discovery_event', alert });

          // Check immediate win condition
          if (room.state.settings.gameMode === 'double') {
            const alive = room.state.players.filter((p) => !p.found);
            if (alive.length <= 1 && room.state.players.length >= 2) {
              finishRoundOrMatch(room, 'seekers', `${player.name} wins Double Hunt!`);
              break;
            }
          } else {
            const remainingHiders = room.state.players.filter(
              (p) => p.team === 'hider' && !p.found,
            );
            if (remainingHiders.length === 0) {
              finishRoundOrMatch(room, 'seekers', 'All Hiders discovered! Seekers win!');
              break;
            }
          }

          broadcastRoom(room, { type: 'room_state', room: room.state });
          break;
        }

        case 'trigger_taunt': {
          const now = Date.now();
          if (now - player.lastTauntAt < 2000) break;
          player.lastTauntAt = now;
          const taunt: TauntPulse = {
            id: makeId('TN-'),
            playerId: player.id,
            playerName: player.name,
            position: player.position,
            variant: msg.variant,
            timestamp: now,
          };
          broadcastRoom(room, { type: 'taunt_event', taunt });
          break;
        }

        case 'leave_room':
          handleDisconnect();
          break;
      }
    });

    const handleDisconnect = () => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;
      room.sockets.delete(currentPlayerId);
      const pIdx = room.state.players.findIndex((p) => p.id === currentPlayerId);
      if (pIdx !== -1) {
        const wasHost = room.state.players[pIdx].isHost;
        room.state.players.splice(pIdx, 1);
        if (room.state.players.length === 0) {
          rooms.delete(currentRoomId);
        } else {
          if (wasHost) {
            room.state.players[0].isHost = true;
            room.state.hostId = room.state.players[0].id;
          }
          broadcastRoom(room, { type: 'room_state', room: room.state });
        }
      }
      currentRoomId = null;
      currentPlayerId = null;
    };

    ws.on('close', handleDisconnect);
  });

  // In the Android app, Capacitor serves the UI and this embedded process
  // provides only the local HTTP/WebSocket LAN service.
  if (process.env.MOBILE_LAN_SERVER !== '1') {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(
        express.static(distPath, {
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('manifest.json')) {
              res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
            } else if (filePath.endsWith('sw.js')) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        }),
      );
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPv4Addresses();
    console.log(`Meccha Chameleon LAN Server listening on http://0.0.0.0:${PORT}`);
    console.log(`Local Wi-Fi / Hotspot IPs: ${ips.join(', ')}`);
  });
}

startServer();
