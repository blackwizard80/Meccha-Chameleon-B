export type MapId = 'mansion' | 'indoor_country' | 'sewer';

export type GameMode =
  | 'infection'
  | 'double'
  | 'reverse_chicken'
  | 'team_battle';

export type TeamRole = 'hider' | 'seeker' | 'spectator';

export type CharacterShape =
  | 'normal'
  | 'blobby'
  | 'cubic'
  | 'macho'
  | 'octopus'
  | 'polygonal';

export type CharacterSize = 'petite' | 'normal' | 'plump';

export type CharacterPose =
  | 'standing'
  | 'sitting'
  | 'lying'
  | 'crouching'
  | 'curled'
  | 'leaning'
  | 'statue';

export type AnimationState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'land'
  | 'crouch'
  | 'sit'
  | 'lie'
  | 'curl'
  | 'look'
  | 'sneak'
  | 'victory'
  | 'defeat'
  | 'aim'
  | 'shoot'
  | 'reload'
  | 'inspect'
  | 'search';

export type SeekerTheme = 'cyan' | 'amber' | 'emerald';

export type SeekerAbilityType = 'scanner' | 'pulse' | 'boost';

export type BodyPartId =
  | 'head'
  | 'face'
  | 'neck'
  | 'chest'
  | 'back'
  | 'leftArm'
  | 'rightArm'
  | 'leftHand'
  | 'rightHand'
  | 'leftLeg'
  | 'rightLeg'
  | 'leftFoot'
  | 'rightFoot';

export type RoundPhase =
  | 'lobby'
  | 'team_select'
  | 'hiding'
  | 'observation'
  | 'seeking'
  | 'round_end'
  | 'match_results';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type PaintTool =
  | 'brush'
  | 'eraser'
  | 'eyedropper'
  | 'fill_part'
  | 'full_body';

export type PaintPattern = 'solid' | 'wood' | 'tile' | 'concrete' | 'speckle';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerAppearance {
  shape: CharacterShape;
  size: CharacterSize;
  pose: CharacterPose;
  /** Compact PNG/WebP data URL of the 256x256 or 512x512 painted UV atlas */
  textureDataUrl: string | null;
  /** Primary dominant color hex for UI badges & quick fallback */
  accentColor: string;
  /** Optional Seeker visor/energy accent theme */
  seekerTheme?: SeekerTheme;
}

export interface PlayerState {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  team: TeamRole;
  /** Team Battle persistent squad index: 0 = Squad Alpha, 1 = Squad Beta */
  squad: 0 | 1;
  found: boolean;
  position: Vec3;
  rotationY: number;
  aimPitch?: number;
  animation: AnimationState;
  appearance: PlayerAppearance;
  score: number;
  captures: number;
  survivedSeconds: number;
  clonesRemaining: number;
  lastTauntAt: number;
}

export interface CloneState {
  id: string;
  ownerId: string;
  position: Vec3;
  rotationY: number;
  appearance: PlayerAppearance;
  createdAt: number;
}

export interface RoomSettings {
  roomName: string;
  mapId: MapId;
  gameMode: GameMode;
  maxPlayers: number;
  hidingDuration: number; // seconds
  roundDuration: number; // seconds
  autoTeams: boolean;
  forcedTauntInterval: number; // 0 = off, else seconds
  maxClonesPerHider: number;
  cloneCooldown: number; // seconds
}

export interface RoomState {
  roomId: string;
  hostId: string;
  phase: RoundPhase;
  phaseTimeRemaining: number;
  phaseTotalTime: number;
  battleTurn: 1 | 2;
  squadScores: [number, number];
  settings: RoomSettings;
  players: PlayerState[];
  clones: CloneState[];
  winnerTeam: 'hiders' | 'seekers' | 'squad_0' | 'squad_1' | 'draw' | null;
  lastEventMessage: string | null;
}

export interface DiscoveredRoom {
  roomId: string;
  roomName: string;
  hostIp: string;
  port: number;
  mapId: MapId;
  gameMode: GameMode;
  playerCount: number;
  maxPlayers: number;
  phase: RoundPhase;
  lastSeen: number;
}

export interface GameSettings {
  playerName: string;
  graphicsQuality: GraphicsQuality;
  cameraSensitivity: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  invertY: boolean;
}

export interface PaintSample {
  hex: string;
  pattern: PaintPattern;
  label: string;
}

export interface DiscoveryAlert {
  id: string;
  seekerName: string;
  targetName: string;
  wasClone: boolean;
  timestamp: number;
}

export interface TauntPulse {
  id: string;
  playerId: string;
  playerName: string;
  position: Vec3;
  variant: number;
  timestamp: number;
}

export interface SeekerActionEvent {
  playerId: string;
  action: 'shoot' | 'reload' | 'scanner' | 'pulse' | 'boost';
  origin?: Vec3;
  target?: Vec3;
  hitConfirmed?: boolean;
}

// WebSocket Client -> Server Messages
export type ClientMessage =
  | {
      type: 'create_room';
      playerName: string;
      settings: Partial<RoomSettings>;
      appearance: PlayerAppearance;
    }
  | {
      type: 'join_room';
      roomId?: string;
      playerName: string;
      reconnectToken?: string;
      appearance: PlayerAppearance;
    }
  | { type: 'leave_room' }
  | { type: 'toggle_ready'; ready: boolean }
  | { type: 'update_settings'; settings: Partial<RoomSettings> }
  | { type: 'assign_team'; targetPlayerId: string; team: TeamRole }
  | { type: 'start_match' }
  | { type: 'end_match' }
  | { type: 'return_to_lobby' }
  | {
      type: 'player_transform';
      position: Vec3;
      rotationY: number;
      aimPitch?: number;
      animation: AnimationState;
    }
  | { type: 'update_appearance'; appearance: PlayerAppearance }
  | { type: 'place_clone'; position: Vec3; rotationY: number }
  | { type: 'attempt_capture'; targetId: string; isClone: boolean; weaponHit?: boolean }
  | { type: 'seeker_action'; event: Omit<SeekerActionEvent, 'playerId'> }
  | { type: 'trigger_taunt'; variant: number }
  | { type: 'ping'; sentAt: number };

// WebSocket Server -> Client Messages
export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      reconnectToken: string;
      room: RoomState;
    }
  | { type: 'room_state'; room: RoomState }
  | {
      type: 'player_delta';
      id: string;
      position: Vec3;
      rotationY: number;
      aimPitch?: number;
      animation: AnimationState;
    }
  | { type: 'seeker_action_event'; event: SeekerActionEvent }
  | { type: 'discovery_event'; alert: DiscoveryAlert }
  | { type: 'taunt_event'; taunt: TauntPulse }
  | { type: 'error'; message: string }
  | { type: 'pong'; sentAt: number; serverTime: number };
