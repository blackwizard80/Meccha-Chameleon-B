import * as THREE from 'three';
import { PaintPattern } from '../types/game';

export interface ProceduralMaterialSpec {
  id: string;
  baseColor: string;
  pattern: PaintPattern;
  label: string;
  roughness: number;
  metalness: number;
  repeat?: [number, number];
}

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  repeat: [number, number] = [1, 1],
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createWoodMaterial(
  baseHex: string,
  grainHex: string,
  label: string,
  repeat: [number, number] = [2, 2],
  roughness = 0.65,
  anisotropy = 4,
): THREE.MeshStandardMaterial {
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Plank seams & wood grain
  for (let p = 0; p < 4; p++) {
    const y0 = p * 64;
    ctx.fillStyle = p % 2 === 0 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, y0, 256, 64);

    ctx.strokeStyle = grainHex;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.14 + (i % 3) * 0.06;
      ctx.beginPath();
      const y = y0 + 4 + (i * 4.2);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(85, y + Math.sin(i + p) * 4, 170, y - Math.cos(i) * 4, 256, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#1e130c';
    ctx.fillRect(0, y0 + 62, 256, 2);
  }
  ctx.globalAlpha = 1;

  const map = configureTexture(canvas, repeat, anisotropy);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness,
    metalness: 0.04,
  });
  mat.userData = {
    paintColor: baseHex,
    paintPattern: 'wood' as PaintPattern,
    paintLabel: label,
    sourceCanvas: canvas,
  };
  return mat;
}

export function createTileMaterial(
  colorA: string,
  colorB: string,
  groutHex: string,
  label: string,
  repeat: [number, number] = [4, 4],
  roughness = 0.38,
  anisotropy = 4,
): THREE.MeshStandardMaterial {
  const [canvas, ctx] = makeCanvas(256);
  const cell = 64;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(c * cell, r * cell, cell, cell);
      // Subtle specular sheen variation
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(c * cell + 3, r * cell + 3, cell - 6, 8);
    }
  }
  ctx.strokeStyle = groutHex;
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(256, i * cell);
    ctx.stroke();
  }

  const map = configureTexture(canvas, repeat, anisotropy);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness,
    metalness: 0.06,
  });
  mat.userData = {
    paintColor: colorA,
    paintPattern: 'tile' as PaintPattern,
    paintLabel: label,
    sourceCanvas: canvas,
  };
  return mat;
}

export function createConcreteMaterial(
  baseHex: string,
  speckHex: string,
  label: string,
  repeat: [number, number] = [3, 3],
  roughness = 0.88,
  anisotropy = 4,
): THREE.MeshStandardMaterial {
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Deterministic pseudo-random speckle & subtle grime streaks
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 1600; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const s = 1 + rand() * 3;
    ctx.fillStyle = speckHex;
    ctx.globalAlpha = 0.08 + rand() * 0.15;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 8);
  ctx.fillRect(0, 128, 256, 2);
  ctx.globalAlpha = 1;

  const map = configureTexture(canvas, repeat, anisotropy);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness,
    metalness: 0.05,
  });
  mat.userData = {
    paintColor: baseHex,
    paintPattern: 'concrete' as PaintPattern,
    paintLabel: label,
    sourceCanvas: canvas,
  };
  return mat;
}

export function createMetalMaterial(
  baseHex: string,
  label: string,
  roughness = 0.32,
  metalness = 0.82,
  grate = false,
  anisotropy = 4,
): THREE.MeshStandardMaterial {
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  if (grate) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 4;
    for (let i = -256; i < 512; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
  } else {
    // Brushed streaks
    for (let y = 0; y < 256; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, y, 256, 1);
    }
  }

  const map = configureTexture(canvas, grate ? [4, 4] : [1, 1], anisotropy);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness,
    metalness,
  });
  mat.userData = {
    paintColor: baseHex,
    paintPattern: grate ? ('tile' as PaintPattern) : ('solid' as PaintPattern),
    paintLabel: label,
    sourceCanvas: canvas,
  };
  return mat;
}

export function createWallpaperMaterial(
  baseHex: string,
  stripeHex: string,
  label: string,
  repeat: [number, number] = [6, 2],
  anisotropy = 4,
): THREE.MeshStandardMaterial {
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = stripeHex;
  ctx.globalAlpha = 0.22;
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 0, 12, 256);
  }
  ctx.globalAlpha = 0.28;
  // Wainscoting chair rail at bottom
  ctx.fillStyle = '#e2d9c8';
  ctx.fillRect(0, 200, 256, 56);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 198, 256, 4);
  ctx.globalAlpha = 1;

  const map = configureTexture(canvas, repeat, anisotropy);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.78,
    metalness: 0.02,
  });
  mat.userData = {
    paintColor: baseHex,
    paintPattern: 'solid' as PaintPattern,
    paintLabel: label,
    sourceCanvas: canvas,
  };
  return mat;
}

export function createRugMaterial(
  primaryHex: string,
  borderHex: string,
  accentHex: string,
  label: string,
  anisotropy = 4,
): THREE.MeshStandardMaterial {
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 18;
  ctx.strokeRect(16, 16, 224, 224);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, 184, 184);

  // Center diamond medallion
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.moveTo(128, 68);
  ctx.lineTo(188, 128);
  ctx.lineTo(128, 188);
  ctx.lineTo(68, 128);
  ctx.closePath();
  ctx.fill();

  const map = configureTexture(canvas, [1, 1], anisotropy);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.92,
    metalness: 0.0,
  });
  mat.userData = {
    paintColor: primaryHex,
    paintPattern: 'speckle' as PaintPattern,
    paintLabel: label,
    sourceCanvas: canvas,
  };
  return mat;
}

export function createFabricMaterial(
  baseHex: string,
  label: string,
  roughness = 0.88,
): THREE.MeshStandardMaterial {
  const [canvas, ctx] = makeCanvas(128);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < 128; y += 4) {
    ctx.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 4) {
    ctx.fillRect(x, 0, 1, 128);
  }
  const map = configureTexture(canvas, [3, 3], 2);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness,
    metalness: 0.02,
  });
  mat.userData = {
    paintColor: baseHex,
    paintPattern: 'speckle' as PaintPattern,
    paintLabel: label,
    sourceCanvas: canvas,
  };
  return mat;
}

export function createHazardStripeMaterial(label = 'Hazard Trim'): THREE.MeshStandardMaterial {
  const [canvas, ctx] = makeCanvas(128);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#1e293b';
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 144, 128);
    ctx.lineTo(i + 128, 128);
    ctx.closePath();
    ctx.fill();
  }
  const map = configureTexture(canvas, [4, 1], 4);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.55,
    metalness: 0.25,
  });
  mat.userData = {
    paintColor: '#eab308',
    paintPattern: 'tile' as PaintPattern,
    paintLabel: label,
    sourceCanvas: canvas,
  };
  return mat;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128);
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
