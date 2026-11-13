import { GameSettings } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicActive = false;
  private volumes = { master: 0.8, music: 0.45, sfx: 0.85 };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public updateSettings(settings: Pick<GameSettings, 'masterVolume' | 'musicVolume' | 'sfxVolume'>): void {
    this.volumes = {
      master: settings.masterVolume,
      music: settings.musicVolume,
      sfx: settings.sfxVolume,
    };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.volumes.master, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.volumes.music * 0.35, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx, now, 0.03);
  }

  public startMusic(mode: 'menu' | 'hide' | 'seek' = 'menu'): void {
    this.stopMusic();
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.musicActive = true;
    this.musicStep = 0;

    // Playful stealth marimba/synth groove
    const menuNotes = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 349.23];
    const hideNotes = [220.0, 261.63, 329.63, 293.66, 220.0, 246.94, 293.66, 329.63];
    const seekNotes = [196.0, 233.08, 293.66, 349.23, 392.0, 349.23, 293.66, 261.63];
    const scale = mode === 'hide' ? hideNotes : mode === 'seek' ? seekNotes : menuNotes;
    const tempoMs = mode === 'seek' ? 240 : mode === 'hide' ? 340 : 420;

    this.musicTimer = window.setInterval(() => {
      if (!this.musicActive || !this.ctx || !this.musicGain) return;
      if (this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const freq = scale[this.musicStep % scale.length];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = mode === 'seek' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (tempoMs / 1000) * 0.85);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + tempoMs / 1000);

      // Subtle bass pulse every 2 beats
      if (this.musicStep % 2 === 0) {
        const bass = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(freq * 0.5, now);
        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        bass.connect(bGain);
        bGain.connect(this.musicGain);
        bass.start(now);
        bass.stop(now + 0.28);
      }

      this.musicStep++;
    }, tempoMs);
  }

  public stopMusic(): void {
    this.musicActive = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.25,
    delay = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playButton(): void {
    this.playTone(540, 720, 0.06, 'triangle', 0.16);
  }

  public playFootstep(running = false): void {
    this.playTone(running ? 145 : 115, 55, running ? 0.07 : 0.09, 'sine', running ? 0.12 : 0.07);
  }

  public playJump(): void {
    this.playTone(220, 480, 0.16, 'triangle', 0.2);
  }

  public playLand(): void {
    this.playTone(130, 48, 0.12, 'sine', 0.22);
  }

  public playPaintStroke(): void {
    this.playTone(380 + Math.random() * 140, 320, 0.05, 'sine', 0.06);
  }

  public playEyedropper(): void {
    this.playTone(620, 980, 0.11, 'sine', 0.2);
    this.playTone(980, 1240, 0.09, 'triangle', 0.14, 0.07);
  }

  public playClone(): void {
    this.playTone(330, 660, 0.14, 'triangle', 0.2);
    this.playTone(495, 990, 0.16, 'sine', 0.16, 0.08);
  }

  public playDiscovery(): void {
    this.playTone(523.25, 783.99, 0.14, 'sawtooth', 0.18);
    this.playTone(783.99, 1046.5, 0.22, 'triangle', 0.24, 0.09);
  }

  public playCapture(): void {
    this.playTone(440, 880, 0.12, 'square', 0.18);
    this.playTone(660, 1320, 0.24, 'triangle', 0.22, 0.08);
  }

  public playTaunt(variant = 0): void {
    const v = Math.abs(variant) % 3;
    if (v === 0) {
      // Chirp whistle
      this.playTone(650, 1180, 0.14, 'sine', 0.25);
      this.playTone(1180, 740, 0.16, 'sine', 0.22, 0.15);
    } else if (v === 1) {
      // Party honk
      this.playTone(310, 340, 0.12, 'sawtooth', 0.18);
      this.playTone(340, 290, 0.18, 'sawtooth', 0.18, 0.14);
    } else {
      // Boing call
      this.playTone(260, 680, 0.22, 'triangle', 0.24);
    }
  }

  public playMatchStart(): void {
    this.playTone(392, 392, 0.14, 'triangle', 0.22, 0);
    this.playTone(523.25, 523.25, 0.14, 'triangle', 0.22, 0.15);
    this.playTone(659.25, 783.99, 0.3, 'triangle', 0.28, 0.3);
  }

  public playVictory(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((n, idx) => {
      this.playTone(n, n * 1.01, 0.24, 'triangle', 0.22, idx * 0.11);
    });
  }

  public playDefeat(): void {
    [392, 349.23, 311.13, 261.63].forEach((n, idx) => {
      this.playTone(n, n * 0.96, 0.26, 'sawtooth', 0.14, idx * 0.14);
    });
  }

  public playBlasterShot(): void {
    this.playTone(960, 210, 0.14, 'sawtooth', 0.18);
    this.playTone(1420, 420, 0.11, 'sine', 0.14, 0.01);
  }

  public playReload(): void {
    this.playTone(280, 180, 0.09, 'triangle', 0.16, 0);
    this.playTone(340, 760, 0.22, 'sine', 0.15, 0.25);
    this.playTone(880, 1120, 0.09, 'triangle', 0.18, 0.48);
  }

  public playHitConfirm(): void {
    this.playTone(880, 1320, 0.09, 'sine', 0.22, 0);
    this.playTone(1320, 1760, 0.14, 'triangle', 0.2, 0.06);
  }

  public playScanner(): void {
    this.playTone(420, 840, 0.35, 'sine', 0.15, 0);
    this.playTone(840, 520, 0.35, 'sine', 0.12, 0.35);
  }

  public playDetectionPulse(): void {
    this.playTone(640, 320, 0.38, 'sine', 0.22, 0);
    this.playTone(1280, 960, 0.26, 'triangle', 0.12, 0.05);
  }

  public playSpeedBoost(): void {
    this.playTone(220, 920, 0.28, 'sawtooth', 0.14, 0);
    this.playTone(330, 1100, 0.32, 'triangle', 0.16, 0.05);
  }
}

export const soundEngine = new SoundEngine();
