import * as THREE from 'three';
import { BodyPartId, PaintPattern, PaintSample } from '../types/game';

/**
 * UV Atlas Layout (512 x 512):
 * Each of the 13 paintable body parts owns a clean non-overlapping UV rectangle
 * on the character's CanvasTexture so raycast strokes and part-fill never bleed.
 */
export interface UVRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export const ATLAS_SIZE = 512;

export const BODY_PART_REGIONS: Record<BodyPartId, UVRegion> = {
  head: { x: 0, y: 0, w: 128, h: 128, label: 'Head' },
  face: { x: 128, y: 0, w: 128, h: 128, label: 'Face' },
  neck: { x: 256, y: 0, w: 128, h: 64, label: 'Neck' },
  chest: { x: 0, y: 128, w: 170, h: 160, label: 'Chest' },
  back: { x: 170, y: 128, w: 170, h: 160, label: 'Back' },
  leftArm: { x: 340, y: 128, w: 86, h: 128, label: 'L. Arm' },
  rightArm: { x: 426, y: 128, w: 86, h: 128, label: 'R. Arm' },
  leftHand: { x: 384, y: 0, w: 64, h: 64, label: 'L. Hand' },
  rightHand: { x: 448, y: 0, w: 64, h: 64, label: 'R. Hand' },
  leftLeg: { x: 0, y: 288, w: 128, h: 160, label: 'L. Leg' },
  rightLeg: { x: 128, y: 288, w: 128, h: 160, label: 'R. Leg' },
  leftFoot: { x: 256, y: 288, w: 128, h: 96, label: 'L. Foot' },
  rightFoot: { x: 384, y: 288, w: 128, h: 96, label: 'R. Foot' },
};

export const ALL_BODY_PARTS: BodyPartId[] = Object.keys(BODY_PART_REGIONS) as BodyPartId[];

export const DEFAULT_BASE_WHITE = '#F8FAFC';

export class CharacterPainter {
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;
  public readonly texture: THREE.CanvasTexture;

  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];
  private readonly maxHistory = 25;

  constructor(initialDataUrl?: string | null) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_SIZE;
    this.canvas.height = ATLAS_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.texture.flipY = true;

    this.resetToWhite(false);
    if (initialDataUrl) {
      this.loadFromDataUrl(initialDataUrl);
    }
  }

  public resetToWhite(recordHistory = true): void {
    if (recordHistory) this.pushHistory();
    this.ctx.fillStyle = DEFAULT_BASE_WHITE;
    this.ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    this.texture.needsUpdate = true;
  }

  public pushHistory(): void {
    const snap = this.ctx.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.ctx.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE));
    this.ctx.putImageData(prev, 0, 0);
    this.texture.needsUpdate = true;
    return true;
  }

  public redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.ctx.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE));
    this.ctx.putImageData(next, 0, 0);
    this.texture.needsUpdate = true;
    return true;
  }

  /**
   * Paint directly at UV coordinates (u in [0,1], v in [0,1] Three.js convention where v=1 is top)
   */
  public paintAtUV(
    u: number,
    v: number,
    colorHex: string,
    radiusPx: number,
    pattern: PaintPattern = 'solid',
    erase = false,
  ): void {
    const px = u * ATLAS_SIZE;
    const py = (1 - v) * ATLAS_SIZE;
    const fillHex = erase ? DEFAULT_BASE_WHITE : colorHex;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(px, py, radiusPx, 0, Math.PI * 2);
    this.ctx.clip();

    this.ctx.fillStyle = fillHex;
    this.ctx.fillRect(px - radiusPx - 1, py - radiusPx - 1, radiusPx * 2 + 2, radiusPx * 2 + 2);

    if (!erase && pattern !== 'solid') {
      this.drawPatternOverlay(
        px - radiusPx,
        py - radiusPx,
        radiusPx * 2,
        radiusPx * 2,
        fillHex,
        pattern,
      );
    }
    this.ctx.restore();
    this.texture.needsUpdate = true;
  }

  public fillBodyPart(
    part: BodyPartId,
    colorHex: string,
    pattern: PaintPattern = 'solid',
    recordHistory = true,
  ): void {
    if (recordHistory) this.pushHistory();
    const r = BODY_PART_REGIONS[part];
    this.ctx.fillStyle = colorHex;
    this.ctx.fillRect(r.x, r.y, r.w, r.h);
    if (pattern !== 'solid') {
      this.drawPatternOverlay(r.x, r.y, r.w, r.h, colorHex, pattern);
    }
    this.texture.needsUpdate = true;
  }

  public fillFullBody(
    colorHex: string,
    pattern: PaintPattern = 'solid',
    recordHistory = true,
  ): void {
    if (recordHistory) this.pushHistory();
    this.ctx.fillStyle = colorHex;
    this.ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    if (pattern !== 'solid') {
      this.drawPatternOverlay(0, 0, ATLAS_SIZE, ATLAS_SIZE, colorHex, pattern);
    }
    this.texture.needsUpdate = true;
  }

  private drawPatternOverlay(
    x: number,
    y: number,
    w: number,
    h: number,
    baseHex: string,
    pattern: PaintPattern,
  ): void {
    const base = new THREE.Color(baseHex);
    const darker = base.clone().multiplyScalar(0.76);
    const lighter = base.clone().lerp(new THREE.Color('#ffffff'), 0.22);

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();

    if (pattern === 'wood') {
      this.ctx.strokeStyle = `#${darker.getHexString()}`;
      this.ctx.lineWidth = 2;
      for (let py = Math.floor(y / 10) * 10; py < y + h; py += 10) {
        this.ctx.globalAlpha = 0.32;
        this.ctx.beginPath();
        this.ctx.moveTo(x, py);
        this.ctx.bezierCurveTo(
          x + w * 0.33,
          py + Math.sin(py) * 4,
          x + w * 0.66,
          py - Math.cos(py) * 4,
          x + w,
          py,
        );
        this.ctx.stroke();
      }
    } else if (pattern === 'tile') {
      this.ctx.strokeStyle = `#${darker.getHexString()}`;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.45;
      const step = 24;
      for (let gx = Math.floor(x / step) * step; gx < x + w; gx += step) {
        this.ctx.beginPath();
        this.ctx.moveTo(gx, y);
        this.ctx.lineTo(gx, y + h);
        this.ctx.stroke();
      }
      for (let gy = Math.floor(y / step) * step; gy < y + h; gy += step) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, gy);
        this.ctx.lineTo(x + w, gy);
        this.ctx.stroke();
      }
    } else if (pattern === 'concrete' || pattern === 'speckle') {
      const count = Math.min(220, Math.max(24, Math.floor((w * h) / 45)));
      for (let i = 0; i < count; i++) {
        const sx = x + ((i * 73 + 19) % Math.max(1, Math.floor(w)));
        const sy = y + ((i * 137 + 41) % Math.max(1, Math.floor(h)));
        this.ctx.fillStyle = i % 2 === 0 ? `#${darker.getHexString()}` : `#${lighter.getHexString()}`;
        this.ctx.globalAlpha = pattern === 'concrete' ? 0.25 : 0.35;
        this.ctx.fillRect(sx, sy, pattern === 'speckle' ? 4 : 2, pattern === 'speckle' ? 4 : 2);
      }
    }

    this.ctx.restore();
  }

  /**
   * Compute dominant color for UI swatch & quick preview
   */
  public getDominantColorHex(): string {
    const sample = this.ctx.getImageData(64, 190, 1, 1).data;
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(sample[0])}${toHex(sample[1])}${toHex(sample[2])}`;
  }

  /**
   * Export compact 256x256 texture data URL for LAN synchronization
   */
  public exportSyncDataUrl(): string {
    const tmp = document.createElement('canvas');
    tmp.width = 256;
    tmp.height = 256;
    const tctx = tmp.getContext('2d')!;
    tctx.drawImage(this.canvas, 0, 0, 256, 256);
    return tmp.toDataURL('image/webp', 0.78);
  }

  public loadFromDataUrl(dataUrl: string | null): void {
    if (!dataUrl) {
      this.resetToWhite(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      this.ctx.drawImage(img, 0, 0, ATLAS_SIZE, ATLAS_SIZE);
      this.texture.needsUpdate = true;
    };
    img.src = dataUrl;
  }

  public dispose(): void {
    this.texture.dispose();
  }
}

/**
 * Sample actual color & pattern from a Three.js Raycaster intersection on a world object
 */
export function sampleWorldIntersection(hit: THREE.Intersection): PaintSample {
  const mesh = hit.object as THREE.Mesh;
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

  let hex = '#d6d3d1';
  let pattern: PaintPattern = 'solid';
  let label = 'Surface';

  if (mat && mat.userData) {
    if (mat.userData.paintColor) hex = mat.userData.paintColor;
    if (mat.userData.paintPattern) pattern = mat.userData.paintPattern;
    if (mat.userData.paintLabel) label = mat.userData.paintLabel;

    // Sample exact pixel from procedural sourceCanvas using hit.uv!
    const srcCanvas = mat.userData.sourceCanvas as HTMLCanvasElement | undefined;
    if (srcCanvas && hit.uv) {
      const ctx = srcCanvas.getContext('2d');
      if (ctx) {
        const repeat = (mat as THREE.MeshStandardMaterial).map?.repeat ?? new THREE.Vector2(1, 1);
        const u = ((hit.uv.x * repeat.x) % 1 + 1) % 1;
        const v = ((hit.uv.y * repeat.y) % 1 + 1) % 1;
        const px = Math.min(srcCanvas.width - 1, Math.floor(u * srcCanvas.width));
        const py = Math.min(srcCanvas.height - 1, Math.floor((1 - v) * srcCanvas.height));
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        hex = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;
      }
    }
  } else if (mat && 'color' in mat && (mat as THREE.MeshStandardMaterial).color) {
    hex = `#${(mat as THREE.MeshStandardMaterial).color.getHexString()}`;
  }

  return { hex, pattern, label };
}
