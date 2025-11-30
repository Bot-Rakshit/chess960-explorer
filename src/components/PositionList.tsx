"use client";

import { useMemo } from "react";
import { Position } from "@/types";

const tagStyles: Record<string, string> = {
  'long diagonal': 'bg-amber-900/30 text-amber-300',
  'long diagonal bishop': 'bg-amber-900/30 text-amber-300',
  'kingside king': 'bg-blue-900/30 text-blue-300',
  'queenside king': 'bg-indigo-900/30 text-indigo-300',
  'central knights': 'bg-emerald-900/30 text-emerald-300',
  'corner knights': 'bg-lime-900/30 text-lime-300',
  'can castle move 1': 'bg-cyan-900/30 text-cyan-300',
  'hypermodern': 'bg-violet-900/30 text-violet-300',
  'flank play': 'bg-orange-900/30 text-orange-300',
  'central play': 'bg-yellow-900/30 text-yellow-300',
  'symmetrical': 'bg-slate-700/30 text-slate-300',
  'asymmetrical': 'bg-pink-900/30 text-pink-300',
  'open': 'bg-emerald-900/30 text-emerald-300',
  'closed': 'bg-stone-700/30 text-stone-300',
  'tactical': 'bg-red-900/30 text-red-300',
  'positional': 'bg-teal-900/30 text-teal-300',
  'fianchetto': 'bg-sky-900/30 text-sky-300',
  'gambit': 'bg-rose-900/30 text-rose-300',
};

const defaultTagColors = [
  'bg-purple-900/30 text-purple-300',
  'bg-fuchsia-900/30 text-fuchsia-300',
  'bg-cyan-900/30 text-cyan-300',
  'bg-indigo-900/30 text-indigo-300',
];

function getTagStyle(tag: string, index: number = 0): string {
  return tagStyles[tag.toLowerCase()] || defaultTagColors[index % defaultTagColors.length];
}

interface SharpnessData {
  [key: string]: { sharpness: number };
}

interface PositionListProps {
  positions: Position[];
  currentId: number;
  onSelect: (id: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: string;
  onSortModeChange: (value: string) => void;
  filterTags: string[];
  onFilterTagsChange: (tags: string[]) => void;
  filterHasGames: boolean;
  onFilterHasGamesChange: (value: boolean) => void;
  allTags: string[];
  sharpnessData?: SharpnessData;
  meanSharpness?: number;
}

export default function PositionList({
  positions,
  currentId,
  onSelect,
  search,
  onSearchChange,
  sortMode,
  onSortModeChange,
  filterTags,
  onFilterTagsChange,
  filterHasGames,
  onFilterHasGamesChange,
  allTags,
  sharpnessData = {},
  meanSharpness = 0,
}: PositionListProps) {

  const filtered = useMemo(() => {
    let list = positions;
    if (search) {
      const n = parseInt(search);
      if (!isNaN(n)) list = list.filter(p => p.id.toString().includes(search));
    }
    if (filterHasGames) list = list.filter(p => p.gmStats && p.gmStats.totalGames > 0);
    if (filterTags.length) list = list.filter(p => filterTags.every(t => p.tags?.includes(t)));

    return [...list].sort((a, b) => {
      const getSharpness = (id: number) => sharpnessData[id.toString()]?.sharpness ?? meanSharpness;
      switch (sortMode) {
        case 'games': return (b.gmStats?.totalGames || 0) - (a.gmStats?.totalGames || 0);
        case 'eval-white': return (b.eval?.pvs?.[0]?.eval || 0) - (a.eval?.pvs?.[0]?.eval || 0);
        case 'eval-black': return (a.eval?.pvs?.[0]?.eval || 0) - (b.eval?.pvs?.[0]?.eval || 0);
        case 'balanced': return Math.abs(a.eval?.pvs?.[0]?.eval || 0) - Math.abs(b.eval?.pvs?.[0]?.eval || 0);
        case 'sharp-high': return getSharpness(b.id) - getSharpness(a.id);
        case 'sharp-low': return getSharpness(a.id) - getSharpness(b.id);
        default: return a.id - b.id;
      }
    });
  }, [positions, search, sortMode, filterTags, filterHasGames, sharpnessData, meanSharpness]);

  return (
    <div className="flex flex-col h-full bg-surface border-r border-white/5 overflow-hidden">
      {/* Fixed Header - Search & Sort */}
      <div className="flex-shrink-0 p-3 space-y-3 border-b border-white/5">
        <input
          type="text"
          placeholder="Search position #..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full h-9 px-3 rounded-lg bg-background border border-white/10 text-sm text-creme placeholder-creme-muted/50 focus:outline-none focus:border-accent/50"
        />

        <div className="flex gap-2">
          <select
            value={sortMode}
            onChange={e => onSortModeChange(e.target.value)}
            className="flex-1 h-8 px-2 rounded-lg bg-background border border-white/10 text-sm text-creme-muted focus:outline-none cursor-pointer"
          >
            <option value="id">Position #</option>
            <option value="games">Most Games</option>
            <option value="eval-white">White Advantage</option>
            <option value="eval-black">Black Advantage</option>
            <option value="balanced">Most Balanced</option>
            <option value="sharp-high">Most Sharp</option>
            <option value="sharp-low">Least Sharp</option>
          </select>

          <button
            onClick={() => onFilterHasGamesChange(!filterHasGames)}
            className={`px-3 rounded-lg text-sm font-medium transition-colors ${
              filterHasGames
                ? 'bg-accent/20 text-accent'
                : 'bg-background border border-white/10 text-creme-muted hover:text-creme'
            }`}
          >
            GM
          </button>
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-creme-muted">Tags</div>
            {filterTags.length > 0 && (
              <button 
                onClick={() => onFilterTagsChange([])}
                className="text-xs text-accent hover:text-accent/80"
              >
                Clear ({filterTags.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag, i) => {
              const isSelected = filterTags.includes(tag);
              const baseStyle = getTagStyle(tag, i);
              return (
                <button
                  key={tag}
                  onClick={() => onFilterTagsChange(isSelected ? filterTags.filter(t => t !== tag) : [...filterTags, tag])}
                  className={`px-2 py-1 rounded text-xs transition-all ${
                    isSelected 
                      ? baseStyle
                      : 'bg-white/5 text-creme-muted/70 hover:text-creme-muted hover:bg-white/10'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* List Header */}
      <div className="flex-shrink-0 px-3 py-2 text-xs text-creme-muted border-b border-white/5 flex justify-between">
        <span>{filtered.length} positions</span>
        <div className="flex gap-4">
          <span>Sharp</span>
          <span>Eval</span>
        </div>
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.slice(0, 150).map(p => {
          const isSelected = p.id === currentId;
          const evalData = p.eval?.pvs?.[0];
          const score = evalData?.eval || 0;
          const isMate = !!evalData?.mate;
          
          const sharpness = sharpnessData[p.id.toString()]?.sharpness ?? meanSharpness;
          const sharpColor = sharpness > 1.2 ? 'text-rose-400' : sharpness > 0.9 ? 'text-amber-400' : 'text-blue-400';

          let scoreColor = 'text-creme-muted';
          if (isMate) scoreColor = evalData.mate! > 0 ? 'text-emerald-400' : 'text-rose-400';
          else if (score > 0.5) scoreColor = 'text-emerald-400';
          else if (score < -0.5) scoreColor = 'text-rose-400';

          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full px-3 py-3 text-left border-b border-white/5 transition-colors ${
                isSelected 
                  ? 'bg-accent/10 border-l-2 border-l-accent' 
                  : 'hover:bg-white/5 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm ${isSelected ? 'text-accent font-semibold' : 'text-creme'}`}>
                    #{p.id}
                  </span>
                  {p.gmStats && p.gmStats.totalGames > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-creme-muted">
                      {p.gmStats.totalGames}g
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-xs ${sharpColor}`}>
                    {sharpness.toFixed(2)}
                  </span>
                  <span className={`font-mono text-sm w-12 text-right ${scoreColor}`}>
                    {isMate ? `M${Math.abs(evalData.mate!)}` : (score > 0 ? '+' : '') + score.toFixed(2)}
                  </span>
                </div>
              </div>
              {p.tags && p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(() => {
                    const selectedTags = p.tags.filter(t => filterTags.includes(t));
                    const otherTags = p.tags.filter(t => !filterTags.includes(t));
                    const maxOtherTags = Math.max(0, 2 - selectedTags.length);
                    const displayTags = [...selectedTags, ...otherTags.slice(0, maxOtherTags)];
                    const hiddenCount = p.tags.length - displayTags.length;
                    
                    return (
                      <>
                        {displayTags.map((tag, i) => (
                          <span 
                            key={i} 
                            className={`px-1.5 py-0.5 rounded text-[10px] ${getTagStyle(tag, i)}`}
                          >
                            {tag}
                          </span>
                        ))}
                        {hiddenCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] text-creme-muted/50">
                            +{hiddenCount}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </button>
          );
        })}
        {filtered.length > 150 && (
          <div className="px-4 py-3 text-center text-sm text-creme-muted/50">
            Showing first 150 matches...
          </div>
        )}
      </div>
    </div>
  );
}
