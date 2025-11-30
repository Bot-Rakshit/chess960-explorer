"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseSan, makeSan } from "chessops/san";
import ChessBoard from "@/components/ChessBoard";
import AnalysisPanel from "@/components/AnalysisPanel";
import { GMGame } from "@/types";
import { ChevronLeft, SkipBack, SkipForward, Cpu } from "lucide-react";
import { useStockfish } from "@/hooks/useStockfish";
import { parseUci } from "chessops/util";

interface GameViewerProps {
  game: GMGame;
  pgn: string;
  onBack: () => void;
}

interface MoveHistory {
  fen: string;
  san: string;
  from: string;
  to: string;
}

function convertPvToSan(fen: string, pvUci: string): string[] {
  try {
    const setup = parseFen(fen).unwrap();
    const game = Chess.fromSetup(setup).unwrap();
    const moves = pvUci.split(' ').filter(m => m.length >= 4);
    const sanMoves: string[] = [];
    for (const uci of moves) {
      const move = parseUci(uci);
      if (!move || !game.isLegal(move)) break;
      sanMoves.push(makeSan(game, move));
      game.play(move);
    }
    return sanMoves;
  } catch {
    return [];
  }
}

// Extract FEN from PGN headers
function extractFenFromPgn(pgn: string): string | null {
  const fenMatch = pgn.match(/\[FEN\s+"([^"]+)"\]/);
  return fenMatch ? fenMatch[1] : null;
}

// Parse moves from PGN and return history with from/to squares
function parsePgnMoves(pgn: string, startFen: string): MoveHistory[] {
  const history: MoveHistory[] = [];
  
  try {
    const setup = parseFen(startFen);
    if (!setup.isOk) return history;
    
    const game = Chess.fromSetup(setup.value);
    if (!game.isOk) return history;
    
    const chess = game.value;
    
    // Extract move text (remove headers and result)
    let moveText = pgn.replace(/\[.*?\]/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    moveText = moveText.replace(/(1-0|0-1|1\/2-1\/2|\*)$/, '').trim();
    
    // Split into tokens and filter move numbers
    const tokens = moveText.split(' ').filter(t => {
      if (!t) return false;
      if (/^\d+\.+$/.test(t)) return false; // "1." or "1..."
      if (t === '') return false;
      return true;
    });
    
    for (const token of tokens) {
      // Clean the token
      const cleanToken = token.replace(/[!?+#]+$/, '').trim();
      if (!cleanToken) continue;
      
      try {
        const move = parseSan(chess, cleanToken);
        if (move) {
          const san = makeSan(chess, move);
          let from = '';
          let to = '';
          if ('from' in move) {
            from = String.fromCharCode(97 + (move.from % 8)) + (Math.floor(move.from / 8) + 1);
          }
          to = String.fromCharCode(97 + (move.to % 8)) + (Math.floor(move.to / 8) + 1);
          
          chess.play(move);
          
          history.push({
            fen: makeFen(chess.toSetup()),
            san,
            from,
            to
          });
        }
      } catch {
        // Skip invalid moves
      }
    }
  } catch (e) {
    console.error('Error parsing PGN:', e);
  }
  
  return history;
}

export default function GameViewer({ game, pgn, onBack }: GameViewerProps) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  
  const { lines, depth, analyze, stop, isReady, isThinking, multiPV, setMultiPV } = useStockfish();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mobileView, setMobileView] = useState<'board' | 'moves'>('board');

  // Extract FEN from PGN (single source of truth)
  const gameFen = useMemo(() => extractFenFromPgn(pgn) || "", [pgn]);
  
  // Parse moves from PGN
  const history = useMemo(() => {
    if (!gameFen) return [];
    return parsePgnMoves(pgn, gameFen);
  }, [pgn, gameFen]);

  const currentDisplayFen = useMemo(() => {
    if (currentMoveIndex === -1) return gameFen;
    return history[currentMoveIndex]?.fen || gameFen;
  }, [currentMoveIndex, history, gameFen]);

  const lastMove = useMemo(() => {
    if (currentMoveIndex === -1 || !history[currentMoveIndex]) return null;
    const move = history[currentMoveIndex];
    return { from: move.from, to: move.to };
  }, [currentMoveIndex, history]);

  useEffect(() => {
    if (isAnalyzing && isReady) {
      analyze(currentDisplayFen);
    } else {
      stop();
    }
  }, [currentDisplayFen, isAnalyzing, isReady, analyze, stop]);

  const goTo = (index: number) => {
    if (index >= -1 && index < history.length) {
      setCurrentMoveIndex(index);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(currentMoveIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(currentMoveIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goTo(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        goTo(history.length - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex, history.length]);

  if (!gameFen) return <div className="h-full flex items-center justify-center text-rose-400">Invalid PGN data <button onClick={onBack} className="ml-4 underline">Back</button></div>;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-auto sm:h-14 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-6 py-2 sm:py-0 bg-surface gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <button onClick={onBack} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors text-creme-muted hover:text-creme">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 text-creme font-bold text-sm sm:text-lg truncate">
              <span className="truncate">{game.white}</span>
              <span className="text-creme-muted font-normal text-xs sm:text-sm shrink-0">vs</span>
              <span className="truncate">{game.black}</span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-creme-muted uppercase tracking-wider flex items-center gap-1 sm:gap-2 truncate">
              {game.event.toLowerCase().includes("freestyle") && (
                <div className="relative w-3 h-3 rounded-sm overflow-hidden shrink-0 opacity-80">
                  <Image src="/freestyle.jpeg" alt="Freestyle" fill className="object-cover" />
                </div>
              )}
              <span className="truncate">{game.event}</span>
              <span className="shrink-0">•</span>
              <span className="shrink-0">{game.date}</span>
              <span className="shrink-0">•</span>
              <span className={`shrink-0 ${game.result === "1-0" ? "text-emerald-400" : game.result === "0-1" ? "text-rose-400" : "text-creme"}`}>{game.result}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex sm:hidden items-center gap-1 bg-background rounded-lg p-1">
            <button 
              onClick={() => setMobileView('board')}
              className={`px-3 py-1 rounded text-xs font-medium ${mobileView === 'board' ? 'bg-accent text-background' : 'text-creme-muted'}`}
            >
              Board
            </button>
            <button 
              onClick={() => setMobileView('moves')}
              className={`px-3 py-1 rounded text-xs font-medium ${mobileView === 'moves' ? 'bg-accent text-background' : 'text-creme-muted'}`}
            >
              Moves
            </button>
          </div>
          
          <button 
            onClick={() => setIsAnalyzing(!isAnalyzing)}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all ${isAnalyzing ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-creme-muted border border-white/10 hover:bg-white/10'}`}
          >
            <Cpu size={12} className={isAnalyzing && isThinking ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{isAnalyzing ? "Engine On" : "Analyze"}</span>
            <span className="sm:hidden">{isAnalyzing ? "On" : "Off"}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Board */}
        <div className={`${mobileView === 'board' ? 'flex' : 'hidden'} sm:flex flex-1 items-start justify-center bg-black/20 p-2 sm:p-4 min-w-0 overflow-auto`}>
          <div className="w-full max-w-[500px] lg:max-w-[560px] aspect-square shadow-2xl shadow-black/50">
            <ChessBoard 
              fen={currentDisplayFen} 
              arePiecesDraggable={false}
              lastMove={lastMove}
            />
          </div>
        </div>

        {/* Tools Panel */}
        <div className={`${mobileView === 'moves' ? 'flex' : 'hidden'} sm:flex w-full sm:w-72 lg:w-96 flex-shrink-0 flex-col sm:border-l border-white/10 bg-surface overflow-hidden`}>
          
          {/* Engine Lines */}
          {isAnalyzing && (
            <div className="h-48 flex-shrink-0 border-b border-white/10 overflow-y-auto custom-scrollbar p-0">
              <AnalysisPanel 
                lines={lines.map(l => ({
                  depth: depth,
                  score: l.eval,
                  mate: l.mate,
                  pv: convertPvToSan(currentDisplayFen, l.moves)
                }))}
                isAnalyzing={isAnalyzing}
                isThinking={isThinking}
                engineDepth={depth}
                multiPV={multiPV}
                onMultiPVChange={setMultiPV}
                onAnalyzeToggle={() => {}}
                embedded={true}
              />
            </div>
          )}

          {/* Move Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface relative pb-16">
            {history.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface z-10 shadow-sm">
                  <tr className="text-[10px] uppercase tracking-widest text-creme-muted border-b border-white/5">
                    <th className="py-2 pl-4 font-medium w-12">#</th>
                    <th className="py-2 pl-2 font-medium">White</th>
                    <th className="py-2 pl-2 font-medium">Black</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                    const whiteMove = history[i * 2];
                    const blackMove = history[i * 2 + 1];
                    
                    return (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors text-sm font-mono">
                        <td className="py-1.5 pl-4 text-creme-muted/50 w-12">{i + 1}.</td>
                        <td className="py-1.5 pl-2">
                          {whiteMove && (
                            <button 
                              onClick={() => goTo(i * 2)}
                              className={`px-2 py-0.5 rounded hover:bg-white/10 transition-colors ${currentMoveIndex === i * 2 ? 'bg-accent text-background font-bold' : 'text-creme'}`}
                            >
                              {whiteMove.san}
                            </button>
                          )}
                        </td>
                        <td className="py-1.5 pl-2">
                          {blackMove && (
                            <button 
                              onClick={() => goTo(i * 2 + 1)}
                              className={`px-2 py-0.5 rounded hover:bg-white/10 transition-colors ${currentMoveIndex === i * 2 + 1 ? 'bg-accent text-background font-bold' : 'text-creme'}`}
                            >
                              {blackMove.san}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="text-creme-muted/50 text-sm mb-2">Move data not available</div>
                <div className="text-creme-muted/30 text-xs max-w-[250px]">
                  Game not found in database or moves could not be parsed. You can still view the starting position and use engine analysis.
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 h-14 border-t border-white/10 flex items-center justify-center gap-4 bg-surface z-20">
            <button onClick={() => goTo(-1)} className="p-2 rounded-lg hover:bg-white/10 text-creme-muted hover:text-creme transition-colors" title="Start (↑)"><SkipBack size={18} /></button>
            <button onClick={() => goTo(currentMoveIndex - 1)} className="p-2 rounded-lg hover:bg-white/10 text-creme-muted hover:text-creme transition-colors" title="Previous (←)"><ChevronLeft size={18} /></button>
            <button onClick={() => goTo(currentMoveIndex + 1)} className="p-2 rounded-lg hover:bg-white/10 text-creme-muted hover:text-creme transition-colors" title="Next (→)"><ChevronLeft size={18} className="rotate-180" /></button>
            <button onClick={() => goTo(history.length - 1)} className="p-2 rounded-lg hover:bg-white/10 text-creme-muted hover:text-creme transition-colors" title="End (↓)"><SkipForward size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
