import { Capacitor } from '@capacitor/core';
import {
  AnimationState,
  ClientMessage,
  DiscoveredRoom,
  DiscoveryAlert,
  PlayerAppearance,
  RoomSettings,
  RoomState,
  SeekerActionEvent,
  ServerMessage,
  TauntPulse,
  TeamRole,
  Vec3,
} from '../types/game';

export interface LanInfoResponse {
  localIps: string[];
  port: number;
  rooms: DiscoveredRoom[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LanClientCallbacks {
  onStatusChange?: (status: ConnectionStatus, error?: string) => void;
  onRoomState?: (room: RoomState) => void;
  onPlayerDelta?: (
    id: string,
    position: Vec3,
    rotationY: number,
    animation: AnimationState,
    aimPitch?: number,
  ) => void;
  onSeekerAction?: (event: SeekerActionEvent) => void;
  onDiscovery?: (alert: DiscoveryAlert) => void;
  onTaunt?: (taunt: TauntPulse) => void;
  onLatency?: (ms: number) => void;
  onError?: (message: string) => void;
}

export class LanClient {
  private ws: WebSocket | null = null;
  private reconnectToken: string | null = null;
  private pingTimer: number | null = null;
  private lastUrl = '';
  public playerId: string | null = null;
  public status: ConnectionStatus = 'disconnected';
  private callbacks: LanClientCallbacks = {};

  public setCallbacks(cb: LanClientCallbacks): void {
    this.callbacks = cb;
  }

  public async fetchLanInfo(hostBaseUrl = ''): Promise<LanInfoResponse> {
    const baseUrl =
      hostBaseUrl || (Capacitor.isNativePlatform() ? 'http://127.0.0.1:3000' : '');
    const url = baseUrl ? `${baseUrl}/api/lan-info` : '/api/lan-info';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Unable to reach LAN server');
    return res.json();
  }

  public connect(wsUrl?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      const targetUrl =
        wsUrl ||
        (Capacitor.isNativePlatform()
          ? 'ws://127.0.0.1:3000'
          : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`);
      this.lastUrl = targetUrl;
      this.setStatus('connecting');

      const ws = new WebSocket(targetUrl);
      this.ws = ws;

      const timeout = window.setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          this.setStatus('error', 'Connection timed out');
          reject(new Error('Connection timed out'));
        }
      }, 12000);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.setStatus('connected');
        this.startPing();
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        this.setStatus('error', 'Failed to reach LAN host');
        reject(new Error('Failed to reach LAN host'));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        this.stopPing();
        if (this.status === 'connected') {
          this.setStatus('disconnected');
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as ServerMessage;
          this.handleMessage(msg);
        } catch {
          // Ignore malformed packet
        }
      };
    });
  }

  private setStatus(status: ConnectionStatus, error?: string): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status, error);
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.reconnectToken = msg.reconnectToken;
        this.callbacks.onRoomState?.(msg.room);
        break;
      case 'room_state':
        this.callbacks.onRoomState?.(msg.room);
        break;
      case 'player_delta':
        this.callbacks.onPlayerDelta?.(
          msg.id,
          msg.position,
          msg.rotationY,
          msg.animation,
          msg.aimPitch,
        );
        break;
      case 'seeker_action_event':
        this.callbacks.onSeekerAction?.(msg.event);
        break;
      case 'discovery_event':
        this.callbacks.onDiscovery?.(msg.alert);
        break;
      case 'taunt_event':
        this.callbacks.onTaunt?.(msg.taunt);
        break;
      case 'pong':
        this.callbacks.onLatency?.(Math.max(1, Date.now() - msg.sentAt));
        break;
      case 'error':
        this.callbacks.onError?.(msg.message);
        break;
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      this.send({ type: 'ping', sentAt: Date.now() });
    }, 3000);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public async hostRoom(
    playerName: string,
    settings: Partial<RoomSettings>,
    appearance: PlayerAppearance,
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    this.send({ type: 'create_room', playerName, settings, appearance });
  }

  public async joinRoom(
    hostAddress: string,
    playerName: string,
    appearance: PlayerAppearance,
    roomId?: string,
  ): Promise<void> {
    let wsUrl: string | undefined;
    let trimmed = hostAddress.trim();
    if (trimmed) {
      // Accept a bare IP, IP:port, or an http(s)/ws(s) URL pasted by the user.
      while (trimmed.endsWith('/')) trimmed = trimmed.slice(0, -1);
      if (trimmed.startsWith('https://')) trimmed = trimmed.slice(8);
      else if (trimmed.startsWith('http://')) trimmed = trimmed.slice(7);
      else if (trimmed.startsWith('wss://')) trimmed = trimmed.slice(6);
      else if (trimmed.startsWith('ws://')) trimmed = trimmed.slice(5);
      if (trimmed.includes('/')) trimmed = trimmed.split('/')[0];
      const hostPort = trimmed.includes(':') ? trimmed : `${trimmed}:3000`;
      wsUrl = `ws://${hostPort}`;
    }
    await this.connect(wsUrl);
    this.send({
      type: 'join_room',
      roomId,
      playerName,
      reconnectToken: this.reconnectToken || undefined,
      appearance,
    });
  }

  public getLastUrl(): string {
    return this.lastUrl;
  }

  public leaveRoom(): void {
    this.send({ type: 'leave_room' });
    this.disconnect();
  }

  public updateTransform(
    position: Vec3,
    rotationY: number,
    animation: AnimationState,
    aimPitch?: number,
  ): void {
    this.send({ type: 'player_transform', position, rotationY, animation, aimPitch });
  }

  public sendSeekerAction(event: Omit<SeekerActionEvent, 'playerId'>): void {
    this.send({ type: 'seeker_action', event });
  }

  public updateAppearance(appearance: PlayerAppearance): void {
    this.send({ type: 'update_appearance', appearance });
  }

  public placeClone(position: Vec3, rotationY: number): void {
    this.send({ type: 'place_clone', position, rotationY });
  }

  public attemptCapture(targetId: string, isClone: boolean, weaponHit = false): void {
    this.send({ type: 'attempt_capture', targetId, isClone, weaponHit });
  }

  public triggerTaunt(variant: number): void {
    this.send({ type: 'trigger_taunt', variant });
  }

  public assignTeam(targetPlayerId: string, team: TeamRole): void {
    this.send({ type: 'assign_team', targetPlayerId, team });
  }

  public disconnect(): void {
    this.stopPing();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.playerId = null;
    this.setStatus('disconnected');
  }
}

export const lanClient = new LanClient();
