"use client";

import { useState, useEffect, useMemo } from "react";
import ChessBoard from "@/components/ChessBoard";
import { Position } from "@/types";

// Simplified generator just in case data fetch fails or before it loads
function generate960Fen(): string {
  // ... (keeping the local generator as fallback is good, but we can simplify for brevity if unused mostly)
  // For now, I will just return a standard start string or one I know is 960.
  // Actually let's keep the previous one as a good fallback.
  const pieceArr = new Array(8).fill(null);
  const darkSquares = [0, 2, 4, 6];
  const lightSquares = [1, 3, 5, 7];
  const b1Pos = darkSquares[Math.floor(Math.random() * darkSquares.length)];
  const b2Pos = lightSquares[Math.floor(Math.random() * lightSquares.length)];
  pieceArr[b1Pos] = 'b';
  pieceArr[b2Pos] = 'b';
  let empty = pieceArr.map((p, i) => p === null ? i : -1).filter(i => i !== -1);
  const qPos = empty[Math.floor(Math.random() * empty.length)];
  pieceArr[qPos] = 'q';
  empty = pieceArr.map((p, i) => p === null ? i : -1).filter(i => i !== -1);
  const n1Pos = empty[Math.floor(Math.random() * empty.length)];
  pieceArr[n1Pos] = 'n';
  empty = pieceArr.map((p, i) => p === null ? i : -1).filter(i => i !== -1);
  const n2Pos = empty[Math.floor(Math.random() * empty.length)];
  pieceArr[n2Pos] = 'n';
  empty = pieceArr.map((p, i) => p === null ? i : -1).filter(i => i !== -1);
  pieceArr[empty[0]] = 'r';
  pieceArr[empty[1]] = 'k';
  pieceArr[empty[2]] = 'r';
  const backRank = pieceArr.join('').toUpperCase();
  const fen = `${backRank.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${backRank} w KQkq - 0 1`;
  return fen;
}

export default function HeroInteractive() {
  const [mounted, setMounted] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [currentPos, setCurrentPos] = useState<Position | null>(null);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [ChessClass, setChessClass] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    setMounted(true);
    
    // Fetch real data
    fetch("/data/chess960.json")
      .then(r => r.json())
      .then(d => {
        if (d.positions && d.positions.length > 0) {
          setPositions(d.positions);
          // Set initial random position from data
          const randomPos = d.positions[Math.floor(Math.random() * d.positions.length)];
          setCurrentPos(randomPos);
          setFen(randomPos.fen);
        }
      })
      .catch(() => {
        // Fallback
        setFen(generate960Fen());
      });
    
    import("chess.js").then((module) => {
        setChessClass(() => module.Chess);
    });
  }, []);

  // Auto-rotation effect
  useEffect(() => {
    if (positions.length === 0) return;

    const interval = setInterval(() => {
      const randomPos = positions[Math.floor(Math.random() * positions.length)];
      setCurrentPos(randomPos);
      setFen(randomPos.fen);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [positions]);

  const handleDrop = (sourceSquare: string, targetSquare: string) => {
    if (!ChessClass) return false;
    try {
        const game = new ChessClass(fen);
        const move = game.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: "q",
        });
        
        if (move === null) return false;
        
        setFen(game.fen());
        return true;
    } catch {
        return false;
    }
  };

  // Calculate score for display
  const evalScore = useMemo(() => {
    if (!currentPos?.eval?.pvs?.[0]) return null;
    const score = currentPos.eval.pvs[0].eval;
    return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
  }, [currentPos]);

  return (
    <div className="relative flex justify-center items-center -translate-y-8">
        <div className="relative w-[750px] h-[750px] flex items-center justify-center">
            {/* Reactor Rings - Keep these as they look cool but subtly adjusted */}
            <div className="absolute inset-0 border border-creme/5 rounded-full animate-spin-slow" />
            <div className="absolute inset-12 border border-dashed border-creme/5 rounded-full animate-reverse-spin" />

            {/* The Core (Board) - Increased Size */}
            <div className="relative z-10 w-[560px] h-[560px] bg-black/40 backdrop-blur-sm border border-white/5 p-6 shadow-2xl shadow-black/50 rounded-sm">
                {mounted && (
                  <div className="w-full h-full relative">
                    <div className="w-full h-full">
                        <ChessBoard
                        fen={fen}
                        arePiecesDraggable={true}
                        onPieceDrop={handleDrop}
                        />
                    </div>
                  </div>
                )}

                {/* Floating Stats - Clean & Beautiful - MOVED INSIDE and ALIGNED */}
                {currentPos && (
                    <div className="absolute top-[102%] inset-x-0 flex flex-row items-center justify-between gap-2">
                        
                        {/* Slot Machine ID & Eval Group */}
                        <div className="flex gap-2">
                            <div className="glass px-3 py-2 rounded-lg border border-white/10 shadow-lg backdrop-blur-md flex flex-col items-center min-w-[70px]">
                                <div className="text-[8px] text-creme-muted uppercase tracking-widest mb-0.5">Pos</div>
                                <div className="flex gap-0.5 text-lg font-mono font-bold text-creme">
                                {currentPos.id.toString().padStart(3, '0').split('').map((d, i) => (
                                        <div key={i} className="bg-black/20 px-1 rounded border border-white/5">
                                            {d}
                                        </div>
                                ))}
                                </div>
                            </div>

                            <div className="glass px-3 py-2 rounded-lg border border-white/10 shadow-lg backdrop-blur-md flex flex-col items-center min-w-[70px]">
                                <div className="text-[8px] text-creme-muted uppercase tracking-widest mb-0.5">Eval</div>
                                <div className={`text-lg font-mono font-bold transition-colors ${parseFloat(evalScore || "0") > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {evalScore || "0.00"}
                                </div>
                            </div>
                        </div>

                        {/* Tags Panel - Inline & Right Aligned */}
                        <div className="flex items-center justify-end gap-1.5 flex-wrap flex-1">
                            {currentPos.tags?.slice(0, 2).map((tag, i) => {
                                const colors = [
                                    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
                                    "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20",
                                ];
                                const colorClass = colors[i % colors.length];
                                
                                return (
                                    <span 
                                        key={i} 
                                        className={`px-2 py-1 rounded border text-[9px] uppercase tracking-wider font-medium shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all cursor-default whitespace-nowrap ${colorClass}`}
                                        style={{ animationDelay: `${i * 100 + 200}ms` }}
                                    >
                                        {tag}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Floating Stats - Removed from outer container */}
        </div>
    </div>
  );
}
