import { CharacterPose, CharacterShape, CharacterSize, GameSettings } from '../types/game';

const SETTINGS_KEY = 'meccha_chameleon_settings_v1';
const PROFILE_KEY = 'meccha_chameleon_profile_v1';

export interface SavedProfile {
  shape: CharacterShape;
  size: CharacterSize;
  pose: CharacterPose;
  textureDataUrl: string | null;
  accentColor: string;
}

const DEFAULT_SETTINGS: GameSettings = {
  playerName: `Chameleon${Math.floor(100 + Math.random() * 899)}`,
  graphicsQuality: 'high',
  cameraSensitivity: 1.0,
  masterVolume: 0.8,
  musicVolume: 0.45,
  sfxVolume: 0.85,
  invertY: false,
};

const DEFAULT_PROFILE: SavedProfile = {
  shape: 'normal',
  size: 'normal',
  pose: 'standing',
  textureDataUrl: null,
  accentColor: '#F8FAFC',
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadProfile(): SavedProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile: SavedProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota issues
  }
}
