"use client";

import { useMemo } from "react";
import { Position } from "@/types";

const tagStyles: Record<string, string> = {
  'long diagonal': 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  'long diagonal bishop': 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  'kingside king': 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  'queenside king': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  'central knights': 'bg-green-500/10 border-green-500/30 text-green-400',
  'corner knights': 'bg-lime-500/10 border-lime-500/30 text-lime-400',
  'can castle move 1': 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  'hypermodern': 'bg-violet-500/10 border-violet-500/30 text-violet-400',
  'flank play': 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  'central play': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  'symmetrical': 'bg-slate-500/10 border-slate-500/30 text-slate-400',
  'asymmetrical': 'bg-pink-500/10 border-pink-500/30 text-pink-400',
  'open': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  'closed': 'bg-stone-500/10 border-stone-500/30 text-stone-400',
  'tactical': 'bg-red-500/10 border-red-500/30 text-red-400',
  'positional': 'bg-teal-500/10 border-teal-500/30 text-teal-400',
  'fianchetto': 'bg-sky-500/10 border-sky-500/30 text-sky-400',
  'gambit': 'bg-rose-500/10 border-rose-500/30 text-rose-400',
};

const defaultTagColors = [
  'bg-purple-500/10 border-purple-500/30 text-purple-400',
  'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400',
  'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
];

function getTagStyle(tag: string, index: number = 0): string {
  return tagStyles[tag.toLowerCase()] || defaultTagColors[index % defaultTagColors.length];
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
}: PositionListProps) {

  const filtered = useMemo(() => {
    let list = positions;
    if (search) {
      const n = parseInt(search);
      if (!isNaN(n)) list = list.filter(p => p.id.toString().includes(search));
    }
    if (filterHasGames) list = list.filter(p => p.gmStats && p.gmStats.totalGames > 0);
    if (filterTags.length) list = list.filter(p => filterTags.some(t => p.tags?.includes(t)));

    return [...list].sort((a, b) => {
      switch (sortMode) {
        case 'games': return (b.gmStats?.totalGames || 0) - (a.gmStats?.totalGames || 0);
        case 'eval-white': return (b.eval?.pvs?.[0]?.eval || 0) - (a.eval?.pvs?.[0]?.eval || 0);
        case 'eval-black': return (a.eval?.pvs?.[0]?.eval || 0) - (b.eval?.pvs?.[0]?.eval || 0);
        case 'balanced': return Math.abs(a.eval?.pvs?.[0]?.eval || 0) - Math.abs(b.eval?.pvs?.[0]?.eval || 0);
        default: return a.id - b.id;
      }
    });
  }, [positions, search, sortMode, filterTags, filterHasGames]);

  return (
    <div className="flex flex-col h-full bg-surface border-r border-white/5 overflow-hidden">
      {/* Fixed Header - Search & Sort */}
      <div className="flex-shrink-0 p-3 space-y-3 border-b border-white/5 bg-surface">
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
            className="flex-1 h-8 px-2 rounded-lg bg-background border border-white/10 text-xs text-creme-muted focus:outline-none cursor-pointer"
          >
            <option value="id">Sort: Position #</option>
            <option value="games">Sort: Most Games</option>
            <option value="eval-white">Sort: White Advantage</option>
            <option value="eval-black">Sort: Black Advantage</option>
            <option value="balanced">Sort: Most Balanced</option>
          </select>

          <button
            onClick={() => onFilterHasGamesChange(!filterHasGames)}
            className={`px-3 rounded-lg border text-xs font-medium ${
              filterHasGames
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-background border-white/10 text-creme-muted hover:border-white/20'
            }`}
          >
            GM
          </button>
        </div>

        {/* Tags - Compact with horizontal scroll */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] text-creme-muted/70 uppercase tracking-wider">Tags</div>
            {filterTags.length > 0 && (
              <button 
                onClick={() => onFilterTagsChange([])}
                className="text-[9px] text-accent hover:text-accent/80"
              >
                Clear ({filterTags.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag, i) => {
              const isSelected = filterTags.includes(tag);
              const baseStyle = getTagStyle(tag, i);
              return (
                <button
                  key={tag}
                  onClick={() => onFilterTagsChange(isSelected ? filterTags.filter(t => t !== tag) : [...filterTags, tag])}
                  className={`px-1.5 py-0.5 rounded text-[9px] border font-medium transition-all ${
                    isSelected 
                      ? `${baseStyle}` 
                      : `bg-background/50 border-white/10 text-creme-muted/60 hover:text-creme-muted`
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
      <div className="flex-shrink-0 px-3 py-2 text-[10px] text-creme-muted border-b border-white/5 flex justify-between bg-surface">
        <span>{filtered.length} positions</span>
        <span>Eval</span>
      </div>

      {/* Scrollable List - Single scroll area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {filtered.slice(0, 150).map(p => {
          const isSelected = p.id === currentId;
          const evalData = p.eval?.pvs?.[0];
          const score = evalData?.eval || 0;
          const isMate = !!evalData?.mate;

          let scoreColor = 'text-creme-muted';
          if (isMate) scoreColor = evalData.mate! > 0 ? 'text-emerald-400' : 'text-rose-400';
          else if (score > 0.5) scoreColor = 'text-emerald-400';
          else if (score < -0.5) scoreColor = 'text-rose-400';

          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full px-3 py-2.5 text-left border-b border-white/5 ${
                isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-white/5 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm ${isSelected ? 'text-accent font-bold' : 'text-creme-muted'}`}>
                    #{p.id}
                  </span>
                  {p.gmStats && p.gmStats.totalGames > 0 && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-creme-muted/60">
                      {p.gmStats.totalGames}g
                    </span>
                  )}
                </div>
                <span className={`font-mono text-xs font-medium ${scoreColor}`}>
                  {isMate ? `M${Math.abs(evalData.mate!)}` : (score > 0 ? '+' : '') + score.toFixed(2)}
                </span>
              </div>
              {p.tags && p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {p.tags.slice(0, 2).map((tag, i) => (
                    <span 
                      key={i} 
                      className={`px-1 py-0.5 rounded text-[8px] border ${getTagStyle(tag, i)}`}
                    >
                      {tag}
                    </span>
                  ))}
                  {p.tags.length > 2 && (
                    <span className="px-1 py-0.5 rounded text-[8px] text-creme-muted/40">
                      +{p.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
        {filtered.length > 150 && (
          <div className="px-4 py-3 text-center text-xs text-creme-muted/50">
            Showing first 150 matches...
          </div>
        )}
      </div>
    </div>
  );
}
