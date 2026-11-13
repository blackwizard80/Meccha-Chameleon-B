import React from 'react';
import { Award, RotateCcw, Trophy, Users } from 'lucide-react';
import { lanClient } from '../network/LanClient';
import { RoomState } from '../types/game';

interface ResultsScreenProps {
  room: RoomState;
  localPlayerId: string;
  onLeaveToMenu: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  room,
  localPlayerId,
  onLeaveToMenu,
}) => {
  const localPlayer = room.players.find((p) => p.id === localPlayerId);
  const isHost = Boolean(localPlayer?.isHost);
  const ranked = [...room.players].sort((a, b) => b.score - a.score);

  const winnerLabel =
    room.winnerTeam === 'hiders'
      ? 'Hiders Win!'
      : room.winnerTeam === 'seekers'
        ? 'Seekers Win!'
        : room.winnerTeam === 'squad_0'
          ? 'Squad Alpha Wins!'
          : room.winnerTeam === 'squad_1'
            ? 'Squad Beta Wins!'
            : 'Match Complete';

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/92 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Winner Banner */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-white leading-tight">
                {winnerLabel}
              </h1>
              <p className="text-xs text-slate-300">
                {room.lastEventMessage || 'Final Match Rankings'}
              </p>
            </div>
          </div>

          {room.settings.gameMode === 'team_battle' && (
            <div className="text-right font-mono-tabular text-xs">
              <div className="text-emerald-400">Alpha: {room.squadScores[0]} pts</div>
              <div className="text-sky-400">Beta: {room.squadScores[1]} pts</div>
            </div>
          )}
        </div>

        {/* Rankings Table */}
        <div className="flex-1 overflow-y-auto custom-scroll p-4">
          <div className="grid grid-cols-12 text-[11px] font-semibold text-slate-400 px-3 pb-2 border-b border-slate-800">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-2 text-right">Survived</div>
            <div className="col-span-2 text-right">Tags</div>
            <div className="col-span-2 text-right">Score</div>
          </div>

          <div className="divide-y divide-slate-800/70">
            {ranked.map((p, idx) => (
              <div
                key={p.id}
                className={`grid grid-cols-12 items-center px-3 py-2.5 text-xs ${
                  p.id === localPlayerId ? 'bg-emerald-500/10 rounded-lg' : ''
                }`}
              >
                <div className="col-span-1 font-mono-tabular font-bold text-amber-400">
                  {idx === 0 ? <Award className="w-4 h-4 text-amber-400" /> : `${idx + 1}`}
                </div>
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  <span
                    className="w-4 h-4 rounded border border-white/25 shrink-0"
                    style={{ backgroundColor: p.appearance.accentColor }}
                  />
                  <span className="font-semibold text-white truncate">
                    {p.name} {p.id === localPlayerId ? '(You)' : ''}
                  </span>
                </div>
                <div className="col-span-2 text-right font-mono-tabular text-slate-300">
                  {Math.round(p.survivedSeconds)}s
                </div>
                <div className="col-span-2 text-right font-mono-tabular text-slate-300">
                  {p.captures}
                </div>
                <div className="col-span-2 text-right font-mono-tabular font-bold text-emerald-400">
                  {p.score}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onLeaveToMenu}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
          >
            Main Menu
          </button>

          {isHost ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => lanClient.send({ type: 'return_to_lobby' })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Return to Lobby</span>
              </button>
              <button
                onClick={() => lanClient.send({ type: 'start_match' })}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Play Rematch</span>
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Waiting for host to start rematch...</span>
          )}
        </div>
      </div>
    </div>
  );
};
