import React from 'react';
import { Check, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  CharacterPose,
  CharacterShape,
  CharacterSize,
  PlayerAppearance,
} from '../types/game';
import { CharacterPreviewCanvas } from './CharacterPreviewCanvas';

interface CustomizationModalProps {
  appearance: PlayerAppearance;
  onChange: (next: PlayerAppearance) => void;
  onClose: () => void;
}

const SHAPES: { id: CharacterShape; label: string; desc: string }[] = [
  { id: 'normal', label: 'Normal', desc: 'Balanced humanoid' },
  { id: 'blobby', label: 'Blobby', desc: 'Soft rounded silhouette' },
  { id: 'cubic', label: 'Cubic', desc: 'Chamfered block figure' },
  { id: 'macho', label: 'Macho', desc: 'Broad muscular frame' },
  { id: 'octopus', label: 'Octopus', desc: 'Flared tentacle limbs' },
  { id: 'polygonal', label: 'Polygonal', desc: 'Faceted low-poly form' },
];

const SIZES: { id: CharacterSize; label: string }[] = [
  { id: 'petite', label: 'Petite' },
  { id: 'normal', label: 'Normal' },
  { id: 'plump', label: 'Plump' },
];

const POSES: { id: CharacterPose; label: string }[] = [
  { id: 'standing', label: 'Standing' },
  { id: 'crouching', label: 'Crouching' },
  { id: 'sitting', label: 'Sitting' },
  { id: 'lying', label: 'Lying' },
  { id: 'curled', label: 'Curled Up' },
  { id: 'leaning', label: 'Leaning' },
  { id: 'statue', label: 'Statue' },
];

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  appearance,
  onChange,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/90 flex items-center justify-center p-3">
      <div className="w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Left: Live 3D Character Preview */}
        <div className="w-[44%] relative bg-gradient-to-b from-slate-800 to-slate-950 border-r border-slate-800 flex flex-col">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/80">
            <div>
              <h2 className="font-display text-base font-bold text-white">Character Studio</h2>
              <p className="text-xs text-slate-400">Drag character to rotate 360°</p>
            </div>
            <button
              onClick={() =>
                onChange({
                  ...appearance,
                  textureDataUrl: null,
                  accentColor: '#F8FAFC',
                })
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset White</span>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <CharacterPreviewCanvas
              shape={appearance.shape}
              size={appearance.size}
              pose={appearance.pose}
              textureDataUrl={appearance.textureDataUrl}
              autoRotate={false}
            />
          </div>
        </div>

        {/* Right: Shape, Size & Pose Controls */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Shapes & sizes sync across all LAN players</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4">
            {/* Body Shapes */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 mb-2">Body Shape</h3>
              <div className="grid grid-cols-3 gap-2">
                {SHAPES.map((s) => {
                  const active = appearance.shape === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onChange({ ...appearance, shape: s.id })}
                      className={`text-left p-2.5 rounded-xl border transition-colors ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">{s.label}</span>
                        {active && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{s.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body Size */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 mb-2">Body Size</h3>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map((sz) => {
                  const active = appearance.size === sz.id;
                  return (
                    <button
                      key={sz.id}
                      onClick={() => onChange({ ...appearance, size: sz.id })}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800/70 border-slate-700/70 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {sz.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview Pose */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 mb-2">Hiding Pose Preview</h3>
              <div className="flex flex-wrap gap-1.5">
                {POSES.map((p) => {
                  const active = appearance.pose === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onChange({ ...appearance, pose: p.id })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
            >
              Save Character
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
