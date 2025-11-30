"use client";

interface AnalysisLine {
  depth: number;
  score: number;
  mate?: number | null;
  pv: string[];
}

interface AnalysisPanelProps {
  lines: AnalysisLine[];
  isAnalyzing: boolean;
  isThinking: boolean;
  engineDepth: number;
  multiPV: number;
  onMultiPVChange: (n: number) => void;
  onAnalyzeToggle: () => void;
  embedded?: boolean;
}

export default function AnalysisPanel({
  lines,
  isAnalyzing,
  isThinking,
  engineDepth,
  multiPV,
  onMultiPVChange,
  onAnalyzeToggle,
  embedded = false
}: AnalysisPanelProps) {
  return (
    <div className={embedded ? "p-4" : "p-5 rounded-xl bg-surface border border-white/5"}>
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-creme-muted/70 uppercase tracking-wider">Engine Analysis</span>
          {!embedded && (
            <button
              onClick={onAnalyzeToggle}
              className={`px-3 py-1.5 rounded text-xs font-medium border ${
                isAnalyzing
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-white/5 text-creme-muted border-white/10 hover:text-creme hover:border-white/20'
              }`}
            >
              {isAnalyzing ? 'STOP' : 'START'}
            </button>
          )}
        </div>

        {isAnalyzing && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-creme-muted uppercase">Lines:</span>
              <div className="flex bg-background rounded-lg p-0.5 border border-white/5">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => onMultiPVChange(n)}
                    className={`w-6 h-5 text-[10px] rounded font-medium ${
                      multiPV === n
                        ? 'bg-accent text-background'
                        : 'text-creme-muted hover:text-creme'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {isThinking && (
              <span className="text-xs text-accent">
                depth {engineDepth}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-white/5">
              <span className={`font-mono text-sm font-bold min-w-[50px] pt-0.5 ${
                line.mate ? (line.mate > 0 ? 'text-emerald-400' : 'text-rose-400') :
                line.score > 0.5 ? 'text-emerald-400' : line.score < -0.5 ? 'text-rose-400' : 'text-creme-muted'
              }`}>
                {line.mate ? `M${Math.abs(line.mate)}` : (line.score >= 0 ? '+' : '') + line.score.toFixed(2)}
              </span>
              <div className="flex-1 flex flex-wrap gap-x-2 gap-y-1">
                {line.pv.slice(0, 8).map((move, j) => (
                  <span key={j} className={`text-sm font-mono ${j % 2 === 0 ? 'text-creme' : 'text-creme-muted'}`}>
                    {move}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-creme-muted text-center py-6 border border-dashed border-white/5 rounded-lg">
            {isAnalyzing ? 'Initializing engine...' : 'Pre-computed analysis shown above'}
          </div>
        )}
      </div>
    </div>
  );
}
