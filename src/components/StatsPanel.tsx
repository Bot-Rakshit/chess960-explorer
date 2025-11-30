"use client";

import { GMStats } from "@/types";

interface StatsPanelProps {
  stats?: GMStats;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats || stats.totalGames === 0) return null;

  return (
    <div className="p-5 rounded-xl bg-surface border border-white/5">
      <div className="text-xs text-creme-muted/70 uppercase tracking-wider mb-4">Database Statistics</div>

      <div className="flex items-baseline gap-2 mb-4">
        <div className="text-3xl text-creme font-bold">{stats.totalGames}</div>
        <div className="text-sm text-creme-muted">games</div>
      </div>

      <div className="flex gap-4 text-xs mb-3">
        <span className="text-creme">White {stats.whiteWinRate}%</span>
        <span className="text-creme-muted">Draw {stats.drawRate}%</span>
        <span className="text-creme-muted/50">Black {stats.blackWinRate}%</span>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden border border-white/5 mb-4">
        <div className="bg-creme" style={{ width: `${stats.whiteWinRate}%` }} />
        <div className="bg-creme-muted" style={{ width: `${stats.drawRate}%` }} />
        <div className="bg-background" style={{ width: `${stats.blackWinRate}%` }} />
      </div>

      {stats.topPlayers.length > 0 && (
        <div className="text-xs text-creme-muted/70 leading-relaxed border-t border-white/5 pt-3 mt-3">
          <span className="text-creme-muted">Top Players:</span> {stats.topPlayers.slice(0, 4).join(', ')}
        </div>
      )}
    </div>
  );
}
