import React, { useEffect, useRef, useState } from 'react';
import {
  Brush,
  Droplet,
  Eraser,
  PaintBucket,
  Palette,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { ALL_BODY_PARTS, BODY_PART_REGIONS } from '../engine/CharacterPainter';
import {
  BodyPartId,
  PaintPattern,
  PaintSample,
  PaintTool,
} from '../types/game';

interface PaintingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTool: PaintTool;
  onToolChange: (tool: PaintTool) => void;
  colorHex: string;
  onColorChange: (hex: string) => void;
  pattern: PaintPattern;
  onPatternChange: (pattern: PaintPattern) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  selectedPart: BodyPartId;
  onSelectPart: (part: BodyPartId) => void;
  onFillPart: (part: BodyPartId) => void;
  onFillFullBody: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetWhite: () => void;
  lastSample: PaintSample | null;
}

function hsvToHex(h: number, s: number, v: number): string {
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2) || 'ff', 16) / 255;
  const g = parseInt(clean.slice(2, 4) || 'ff', 16) / 255;
  const b = parseInt(clean.slice(4, 6) || 'ff', 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

const PATTERNS: { id: PaintPattern; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'wood', label: 'Wood' },
  { id: 'tile', label: 'Tile' },
  { id: 'concrete', label: 'Concrete' },
  { id: 'speckle', label: 'Speckle' },
];

export const PaintingPanel: React.FC<PaintingPanelProps> = ({
  isOpen,
  onClose,
  activeTool,
  onToolChange,
  colorHex,
  onColorChange,
  pattern,
  onPatternChange,
  brushSize,
  onBrushSizeChange,
  selectedPart,
  onSelectPart,
  onFillPart,
  onFillFullBody,
  onUndo,
  onRedo,
  onResetWhite,
  lastSample,
}) => {
  const wheelRef = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(colorHex));

  useEffect(() => {
    setHsv(hexToHsv(colorHex));
  }, [colorHex]);

  // Draw interactive HSV Color Wheel
  useEffect(() => {
    const canvas = wheelRef.current;
    if (!canvas || !isOpen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 2;

    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const idx = (y * size + x) * 4;
        if (dist <= radius) {
          const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
          const sat = (dist / radius) * 100;
          const hex = hsvToHex(angle, sat, hsv.v);
          img.data[idx] = parseInt(hex.slice(1, 3), 16);
          img.data[idx + 1] = parseInt(hex.slice(3, 5), 16);
          img.data[idx + 2] = parseInt(hex.slice(5, 7), 16);
          img.data[idx + 3] = 255;
        } else {
          img.data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [isOpen, hsv.v]);

  if (!isOpen) return null;

  const handleWheelPick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = e.clientX - rect.left - cx;
    const dy = e.clientY - rect.top - cy;
    const r = Math.min(cx, cy);
    const dist = Math.min(r, Math.hypot(dx, dy));
    const angle = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
    const sat = Math.round((dist / r) * 100);
    const next = { h: angle, s: sat, v: hsv.v };
    setHsv(next);
    onColorChange(hsvToHex(next.h, next.s, next.v));
  };

  const updateSlider = (key: 'h' | 's' | 'v', val: number) => {
    const next = { ...hsv, [key]: val };
    setHsv(next);
    onColorChange(hsvToHex(next.h, next.s, next.v));
  };

  return (
    <div className="fixed inset-y-2 left-2 z-30 w-[330px] max-w-[46vw] bg-slate-950/92 border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-emerald-400" />
          <span className="font-display text-sm font-bold text-slate-100 whitespace-nowrap">
            Camouflage Studio
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            title="Undo"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            title="Redo"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetWhite}
            title="Reset White"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white ml-1 transition-colors"
            title="Done Painting"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Tool & Color Controls */}
      <div className="flex-1 overflow-y-auto custom-scroll p-2.5 space-y-2.5">
        {/* Tool Bar */}
        <div className="grid grid-cols-5 gap-1">
          {[
            { id: 'brush' as PaintTool, label: 'Brush', Icon: Brush },
            { id: 'eyedropper' as PaintTool, label: 'Sample', Icon: Droplet },
            { id: 'eraser' as PaintTool, label: 'Erase', Icon: Eraser },
            { id: 'fill_part' as PaintTool, label: 'Part', Icon: PaintBucket },
            { id: 'full_body' as PaintTool, label: 'Full', Icon: Sparkles },
          ].map(({ id, label, Icon }) => {
            const active = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => {
                  onToolChange(id);
                  if (id === 'fill_part') onFillPart(selectedPart);
                  if (id === 'full_body') onFillFullBody();
                }}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-colors ${
                  active
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 mb-0.5" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Contextual Hint */}
        <div className="text-[11px] text-slate-300 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          {activeTool === 'eyedropper'
            ? 'Tap any wall, wood, tile, sofa, or barrel in the 3D map to sample its exact color & texture.'
            : activeTool === 'brush'
              ? 'Drag directly across your 3D character to paint camouflage.'
              : activeTool === 'eraser'
                ? 'Drag across your character to restore pure white.'
                : 'Select a body part below or tap Full to coat your entire body.'}
        </div>

        {/* Last Sampled World Surface */}
        {lastSample && (
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-4 h-4 rounded border border-white/25 shrink-0"
                style={{ backgroundColor: lastSample.hex }}
              />
              <span className="text-slate-200 truncate">{lastSample.label}</span>
            </div>
            <span className="font-mono-tabular text-[11px] text-emerald-400 shrink-0">
              {lastSample.pattern} · {lastSample.hex}
            </span>
          </div>
        )}

        {/* Color Wheel + HSV Sliders */}
        <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 rounded-lg p-2">
          <div className="relative shrink-0">
            <canvas
              ref={wheelRef}
              width={96}
              height={96}
              onPointerDown={handleWheelPick}
              onPointerMove={(e) => e.buttons === 1 && handleWheelPick(e)}
              className="w-24 h-24 rounded-full cursor-crosshair touch-none"
            />
            <div
              className="w-5 h-5 rounded-full border-2 border-white shadow absolute bottom-0 right-0"
              style={{ backgroundColor: colorHex }}
            />
          </div>

          <div className="flex-1 space-y-1.5 text-[11px]">
            <div>
              <div className="flex justify-between text-slate-400">
                <span>Hue</span>
                <span className="font-mono-tabular">{hsv.h}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={359}
                value={hsv.h}
                onChange={(e) => updateSlider('h', Number(e.target.value))}
                className="w-full accent-emerald-400 h-1.5"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400">
                <span>Saturation</span>
                <span className="font-mono-tabular">{hsv.s}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={hsv.s}
                onChange={(e) => updateSlider('s', Number(e.target.value))}
                className="w-full accent-emerald-400 h-1.5"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400">
                <span>Brightness</span>
                <span className="font-mono-tabular">{hsv.v}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={hsv.v}
                onChange={(e) => updateSlider('v', Number(e.target.value))}
                className="w-full accent-emerald-400 h-1.5"
              />
            </div>
          </div>
        </div>

        {/* Brush Size + Surface Pattern */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>Brush Size</span>
            <span className="font-mono-tabular text-emerald-400">{brushSize}px</span>
          </div>
          <input
            type="range"
            min={6}
            max={48}
            value={brushSize}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            className="w-full accent-emerald-400 h-1.5"
          />

          <div className="grid grid-cols-5 gap-1 pt-1">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                onClick={() => onPatternChange(p.id)}
                className={`py-1 px-1 rounded text-[10px] font-semibold transition-colors whitespace-nowrap ${
                  pattern === p.id
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 13 Paintable Body Parts Selector */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300">Body Part Paint</span>
            <button
              onClick={onFillFullBody}
              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Paint Full Body
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {ALL_BODY_PARTS.map((part) => {
              const selected = selectedPart === part;
              return (
                <button
                  key={part}
                  onClick={() => {
                    onSelectPart(part);
                    onFillPart(part);
                  }}
                  className={`py-1 px-1 rounded text-[10px] font-medium truncate transition-colors ${
                    selected
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {BODY_PART_REGIONS[part].label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
