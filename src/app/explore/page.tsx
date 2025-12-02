"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseUci } from "chessops/util";
import { makeSan } from "chessops/san";

import { Position, GMGame } from "@/types";
import { useStockfish } from "@/hooks/useStockfish";
import { usePgnDatabase } from "@/hooks/usePgnDatabase";
import ChessBoard from "@/components/ChessBoard";
import PositionList from "@/components/PositionList";
import AnalysisPanel from "@/components/AnalysisPanel";
import StatsPanel from "@/components/StatsPanel";
import GameViewer from "@/components/GameViewer";
import BotGame from "@/components/BotGame";
import Loader from "@/components/Loader";
import { useSound } from "@/hooks/useSound";

function createGame(fen: string): Chess | null {
  try {
    const setup = parseFen(fen);
    if (setup.isOk) return Chess.fromSetup(setup.value).unwrap();
  } catch {}
  return null;
}

function getFen(game: Chess): string {
  return makeFen(game.toSetup());
}

function tryMove(game: Chess, from: string, to: string, promotion?: string): { san: string; newGame: Chess } | null {
  try {
    const uciStr = from + to + (promotion || '');
    const move = parseUci(uciStr);
    if (move && game.isLegal(move)) {
      const san = makeSan(game, move);
      const newGame = game.clone();
      newGame.play(move);
      return { san, newGame };
    }
  } catch {}
  return null;
}

function convertPvToSan(fen: string, pvUci: string): string[] {
  const game = createGame(fen);
  if (!game) return [];
  const moves = pvUci.split(' ');
  const sanMoves: string[] = [];
  for (const uci of moves) {
    try {
      const move = parseUci(uci);
      if (!move || !game.isLegal(move)) break;
      sanMoves.push(makeSan(game, move));
      game.play(move);
    } catch { break; }
  }
  return sanMoves;
}

function SlotDigit({ value, spinning }: { value: string; spinning: boolean }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (spinning) {
      const interval = setInterval(() => setDisplay(String(Math.floor(Math.random() * 10))), 50);
      const timeout = setTimeout(() => { clearInterval(interval); setDisplay(value); }, 400);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
    setDisplay(value);
  }, [value, spinning]);

  return (
    <div className={`w-10 h-14 rounded-lg bg-surface border ${spinning ? 'border-accent' : 'border-white/10'} flex items-center justify-center`}>
      <span className={`font-mono text-2xl font-bold ${spinning ? 'text-accent' : 'text-creme'}`}>{display}</span>
    </div>
  );
}

interface PgnViewerProps {
  game: GMGame | null;
  startFen: string;
  onClose: () => void;
}

function PgnViewer({ game, startFen, onClose }: PgnViewerProps) {
  const [currentMove, setCurrentMove] = useState(0);
  const [boardFen, setBoardFen] = useState(startFen);
  const gameRef = useRef<Chess | null>(null);
  const movesRef = useRef<{ san: string; fen: string }[]>([]);

  useEffect(() => {
    if (!game) return;
    const chess = createGame(startFen);
    if (!chess) return;
    gameRef.current = chess;
    movesRef.current = [{ san: 'Start', fen: startFen }];
    setBoardFen(startFen);
    setCurrentMove(0);
  }, [game, startFen]);

  const goTo = (idx: number) => {
    if (idx >= 0 && idx < movesRef.current.length) {
      setCurrentMove(idx);
      setBoardFen(movesRef.current[idx].fen);
    }
  };

  if (!game) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl bg-surface rounded-xl border border-white/10 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-lg text-creme font-medium">{game.white} vs {game.black}</div>
            <div className="text-sm text-creme-muted">{game.event} - {game.date}</div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-sm font-mono px-3 py-1 rounded ${
              game.result === '1-0' ? 'bg-white/10 text-creme' : 
              game.result === '0-1' ? 'bg-black/30 text-creme-muted' : 'bg-white/5 text-creme-muted'
            }`}>{game.result}</span>
            <button onClick={onClose} className="text-creme-muted hover:text-creme text-xl">x</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-background rounded-lg p-2">
            <ChessBoard fen={boardFen} />
          </div>
          
          <div className="flex flex-col">
            <div className="flex-1 bg-background rounded-lg p-4 mb-4 overflow-y-auto max-h-[400px]">
              <div className="text-xs text-creme-muted mb-3">Game Moves</div>
              <div className="flex flex-wrap gap-1">
                {movesRef.current.slice(1).map((m, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i + 1)}
                    className={`px-2 py-1 rounded text-sm font-mono ${
                      currentMove === i + 1 ? 'bg-accent text-background' : 'text-creme-muted hover:bg-white/5'
                    }`}
                  >
                    {i % 2 === 0 ? `${Math.floor(i/2)+1}.` : ''}{m.san}
                  </button>
                ))}
                {movesRef.current.length <= 1 && (
                  <div className="text-creme-muted/50 text-sm italic">
                    Move data not available for this game. The database contains game metadata but not full move lists.
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-center gap-2">
              <button onClick={() => goTo(0)} className="px-4 py-2 rounded bg-surface border border-white/10 text-creme-muted hover:text-creme text-sm">Start</button>
              <button onClick={() => goTo(currentMove - 1)} className="px-4 py-2 rounded bg-surface border border-white/10 text-creme-muted hover:text-creme text-sm">Prev</button>
              <button onClick={() => goTo(currentMove + 1)} className="px-4 py-2 rounded bg-surface border border-white/10 text-creme-muted hover:text-creme text-sm">Next</button>
              <button onClick={() => goTo(movesRef.current.length - 1)} className="px-4 py-2 rounded bg-surface border border-white/10 text-creme-muted hover:text-creme text-sm">End</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SharpnessData {
  [key: string]: {
    sharpness: number;
    wdl: { w: number; d: number; l: number };
  };
}

export default function ExplorePage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [currentId, setCurrentId] = useState(() => Math.floor(Math.random() * 960));
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [sharpnessData, setSharpnessData] = useState<SharpnessData>({});
  const [meanSharpness, setMeanSharpness] = useState(0);
  
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState('id');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterHasGames, setFilterHasGames] = useState(false);
  
  const [analyzing, setAnalyzing] = useState(false);
  const [currentFen, setCurrentFen] = useState("");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<'board' | 'positions' | 'analysis'>('board');
  const gameRef = useRef<Chess | null>(null);
  const historyRef = useRef<Chess[]>([]);

  const [selectedGame, setSelectedGame] = useState<{ game: GMGame; pgn: string } | null>(null);
  const [playingBot, setPlayingBot] = useState(false);
  
  const { lines: engineLines, depth: engineDepth, analyze: runEngine, stop: stopEngine, isReady: engineReady, isThinking, multiPV, setMultiPV } = useStockfish();
  const { getGamesForFen, getPgnForGame, getGameStats, getFreestyleBoards, loading: pgnLoading } = usePgnDatabase();
  const { play: playSound } = useSound();

  // Compute which positions have freestyle games
  const freestylePositionIds = useMemo(() => {
    if (pgnLoading || positions.length === 0) return new Set<number>();
    const freestyleBoards = getFreestyleBoards();
    const ids = new Set<number>();
    for (const p of positions) {
      const board = p.fen.split(" ")[0];
      if (freestyleBoards.has(board)) {
        ids.add(p.id);
      }
    }
    return ids;
  }, [positions, pgnLoading, getFreestyleBoards]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    Promise.all([
      fetch("/data/chess960.json").then(r => r.json()),
      fetch("/data/chess960_sharpness.json").then(r => r.json()).catch(() => ({}))
    ]).then(([posData, sharpData]) => {
      setPositions(posData.positions?.sort((a: Position, b: Position) => a.id - b.id) || []);
      setSharpnessData(sharpData || {});
      
      // Calculate mean sharpness
      const values = Object.values(sharpData || {}) as { sharpness: number }[];
      if (values.length > 0) {
        const sum = values.reduce((acc, v) => acc + (v.sharpness || 0), 0);
        setMeanSharpness(Math.round((sum / values.length) * 100) / 100);
      }
      
      setLoading(false);
      if (params.get("random") === "true") goRandom();
    }).catch(() => setLoading(false));
  }, []);

  const pos = useMemo(() => positions.find(p => p.id === currentId), [positions, currentId]);
  
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    positions.forEach(p => p.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [positions]);

  // Get games and stats from PGN database for current position
  const pgnGames = useMemo(() => {
    if (!pos || pgnLoading) return [];
    return getGamesForFen(pos.fen);
  }, [pos, pgnLoading, getGamesForFen]);

  const pgnStats = useMemo(() => {
    if (!pos || pgnLoading) return null;
    return getGameStats(pos.fen);
  }, [pos, pgnLoading, getGameStats]);

  useEffect(() => {
    if (pos) {
      const game = createGame(pos.fen);
      gameRef.current = game;
      historyRef.current = game ? [game.clone()] : [];
      setCurrentFen(pos.fen);
      setMoveHistory([]);
      setLastMove(null);
    }
  }, [pos]);

  useEffect(() => {
    if (analyzing && currentFen && engineReady) runEngine(currentFen);
  }, [analyzing, currentFen, engineReady, runEngine]);

  useEffect(() => {
    if (!analyzing) stopEngine();
  }, [analyzing, stopEngine]);

  const handleDrop = useCallback((src: string, tgt: string, piece: string) => {
    if (!gameRef.current) return false;
    const promotion = piece[1]?.toLowerCase() === 'p' && (tgt[1] === '8' || tgt[1] === '1') ? 'q' : undefined;
    const result = tryMove(gameRef.current, src, tgt, promotion);
    if (result) {
      historyRef.current.push(gameRef.current.clone());
      gameRef.current = result.newGame;
      setCurrentFen(getFen(result.newGame));
      setMoveHistory(prev => [...prev, result.san]);
      setLastMove({ from: src, to: tgt });
      
      // Play sound based on move type
      const san = result.san;
      const isCheck = result.newGame.isCheck();
      const isCapture = san.includes('x');
      const isCastle = san === 'O-O' || san === 'O-O-O';
      const isPromotion = san.includes('=');
      
      if (isCheck) {
        playSound('check');
      } else if (isPromotion) {
        playSound('promote');
      } else if (isCastle) {
        playSound('castle');
      } else if (isCapture) {
        playSound('capture');
      } else {
        playSound('move');
      }
      
      return true;
    }
    return false;
  }, [playSound]);

  const handleUndo = () => {
    if (historyRef.current.length > 1) {
      historyRef.current.pop();
      const prev = historyRef.current[historyRef.current.length - 1];
      gameRef.current = prev.clone();
      setCurrentFen(getFen(prev));
      setMoveHistory(m => m.slice(0, -1));
      setLastMove(null);
    }
  };

  const handleReset = () => {
    if (pos) {
      const game = createGame(pos.fen);
      gameRef.current = game;
      historyRef.current = game ? [game.clone()] : [];
      setCurrentFen(pos.fen);
      setMoveHistory([]);
      setLastMove(null);
    }
  };

  const goToPosition = (id: number) => {
    setSpinning(true);
    setAnalyzing(false);
    setTimeout(() => { setCurrentId(id); setSpinning(false); }, 400);
  };

  const goRandom = () => {
    setSpinning(true);
    setAnalyzing(false);
    setTimeout(() => { setCurrentId(Math.floor(Math.random() * 960)); setSpinning(false); }, 400);
  };

  if (loading) return <Loader fullScreen text="Loading positions..." />;

  // --- Game Viewer Mode ---
  if (selectedGame) {
    return (
      <GameViewer 
        game={selectedGame.game} 
        pgn={selectedGame.pgn} 
        onBack={() => setSelectedGame(null)} 
      />
    );
  }

  // --- Bot Game Mode ---
  if (playingBot && pos) {
    return (
      <BotGame
        startFen={pos.fen}
        positionId={pos.id}
        onBack={() => setPlayingBot(false)}
      />
    );
  }

  const digits = currentId.toString().padStart(3, '0').split('');

  const displayLines = analyzing && engineLines.length > 0
    ? engineLines.map(l => ({
        depth: engineDepth,
        score: l.eval,
        mate: l.mate,
        pv: convertPvToSan(currentFen, l.moves)
      }))
    : pos?.eval?.pvs?.slice(0, 3).map(pv => ({
        depth: pos?.eval?.depth || 0,
        score: pv.eval || 0,
        mate: pv.mate || null,
        pv: convertPvToSan(pos?.fen || '', pv.moves)
      })) || [];

  return (
    <div className="h-screen bg-background text-creme flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 flex-shrink-0 border-b border-white/5 flex items-center justify-between px-4 bg-surface">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-background font-bold text-xs">960</span>
          </div>
          <span className="font-semibold hidden sm:block">Chess960 Explorer</span>
        </Link>
        
        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6">
          <span className="text-sm text-accent font-medium">Explore</span>
          <Link href="/challenge" className="text-sm text-creme-muted hover:text-creme transition-colors">Challenge</Link>
        </nav>
        
        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden items-center gap-1 bg-background rounded-lg p-1">
          <button 
            onClick={() => setMobileTab('positions')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mobileTab === 'positions' ? 'bg-accent text-background' : 'text-creme-muted'}`}
          >
            List
          </button>
          <button 
            onClick={() => setMobileTab('board')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mobileTab === 'board' ? 'bg-accent text-background' : 'text-creme-muted'}`}
          >
            Board
          </button>
          <button 
            onClick={() => setMobileTab('analysis')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mobileTab === 'analysis' ? 'bg-accent text-background' : 'text-creme-muted'}`}
          >
            Analysis
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Position List */}
        <aside className={`${mobileTab === 'positions' ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 flex-shrink-0 h-full overflow-hidden`}>
          <PositionList
            positions={positions}
            currentId={currentId}
            onSelect={goToPosition}
            search={search}
            onSearchChange={setSearch}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            filterTags={filterTags}
            onFilterTagsChange={setFilterTags}
            filterHasGames={filterHasGames}
            onFilterHasGamesChange={setFilterHasGames}
            allTags={allTags}
            sharpnessData={sharpnessData}
            meanSharpness={meanSharpness}
            freestylePositionIds={freestylePositionIds}
          />
        </aside>

        {/* Center - Board */}
        <main className={`${mobileTab === 'board' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col h-full overflow-hidden p-2 sm:p-4`}>
          <div className="max-w-lg mx-auto w-full flex flex-col h-full gap-3">
            {/* Position Selector */}
            <div className="flex items-center justify-center gap-3 flex-shrink-0">
              <button 
                onClick={() => goToPosition((currentId - 1 + 960) % 960)} 
                className="w-9 h-9 rounded-lg bg-surface border border-white/10 text-creme-muted hover:text-creme hover:border-white/20 flex items-center justify-center"
              >
                {"<"}
              </button>
              
              <div className="flex items-center gap-1 px-3 py-1.5 bg-surface rounded-xl border border-white/5">
                <span className="text-creme-muted text-lg mr-1">#</span>
                {digits.map((d, i) => <SlotDigit key={i} value={d} spinning={spinning} />)}
              </div>
              
              <button 
                onClick={() => goToPosition((currentId + 1) % 960)} 
                className="w-9 h-9 rounded-lg bg-surface border border-white/10 text-creme-muted hover:text-creme hover:border-white/20 flex items-center justify-center"
              >
                {">"}
              </button>
              
              <button 
                onClick={goRandom} 
                className="px-4 py-2 rounded-lg bg-accent text-background font-medium text-sm hover:opacity-90"
              >
                Random
              </button>
              <button 
                onClick={() => setPlayingBot(true)} 
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-500 transition-colors"
              >
                Play Bot
              </button>
            </div>

            {/* Board - Takes remaining space */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="bg-surface rounded-lg p-2 border border-white/5 w-full max-w-[min(100%,calc(100vh-220px))] aspect-square">
                <ChessBoard
                  fen={currentFen}
                  onPieceDrop={handleDrop}
                  arePiecesDraggable={true}
                  lastMove={lastMove}
                />
              </div>
            </div>

            {/* Controls - Fixed at bottom */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={handleUndo} disabled={!moveHistory.length} className="text-sm text-creme-muted hover:text-creme disabled:opacity-30 disabled:hover:text-creme-muted transition-colors">Undo</button>
              <button onClick={handleReset} className="text-sm text-creme-muted hover:text-creme transition-colors">Reset</button>
              
              {moveHistory.length > 0 && (
                <div className="flex-1 px-3 py-1.5 rounded-lg bg-surface text-sm text-creme-muted font-mono truncate">
                  {moveHistory.map((m, i) => (
                    <span key={i} className={i % 2 === 0 ? "text-creme" : "text-creme-muted ml-1 mr-2"}>
                      {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''} {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right Panel - Analysis & Stats */}
        <aside className={`${mobileTab === 'analysis' ? 'flex flex-col' : 'hidden'} lg:flex lg:flex-col w-full lg:w-80 xl:w-96 flex-shrink-0 h-full overflow-y-auto overflow-x-hidden custom-scrollbar lg:border-l border-white/5 bg-surface/50 p-4 lg:p-5 space-y-4 lg:space-y-5`}>
          
          {/* Position Info */}
          {pos && (
            <div className="space-y-4">
              {/* Strategic Plan - Hero Card */}
              {pos.plan && (
                <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-surface to-surface">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDIiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50" />
                  <div className="relative p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-400/70 uppercase tracking-widest font-semibold">Strategic Plan</div>
                        <div className="text-[10px] text-creme-muted/50">Position #{pos.id}</div>
                      </div>
                    </div>
                    <p className="text-sm text-creme/90 leading-relaxed pl-11">{pos.plan}</p>
                  </div>
                </div>
              )}

              {/* Tags Section */}
              {pos.tags && pos.tags.length > 0 && (
                <div className="p-4 rounded-xl bg-surface border border-white/5">
                  <div className="text-[10px] text-creme-muted/50 uppercase tracking-widest mb-3 font-medium">Position Characteristics</div>
                  <div className="flex flex-wrap gap-2">
                    {pos.tags.map((t, i) => {
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
                      const defaultColors = [
                        'bg-purple-500/10 border-purple-500/30 text-purple-400',
                        'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400',
                        'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
                        'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
                      ];
                      const style = tagStyles[t.toLowerCase()] || defaultColors[i % defaultColors.length];
                      return (
                        <span key={i} className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold ${style}`}>
                          {t}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stockfish Evaluation Bar */}
              {pos.eval && pos.eval.pvs && pos.eval.pvs.length > 0 && (() => {
                const pv = pos.eval.pvs[0];
                const evalNum = pv.mate ? (pv.mate > 0 ? 10 : -10) : pv.eval;
                const evalScore = pv.mate ? `M${Math.abs(pv.mate)}` : (pv.eval >= 0 ? `+${pv.eval.toFixed(2)}` : pv.eval.toFixed(2));
                const whitePercent = Math.min(100, Math.max(0, 50 + evalNum * 10));
                return (
                  <div className="p-4 rounded-xl bg-surface border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] text-creme-muted/50 uppercase tracking-widest font-medium">Stockfish Eval</div>
                      <div className="text-[10px] text-creme-muted/40">depth {pos.eval.depth}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-6 rounded overflow-hidden flex">
                        <div className="bg-white transition-all duration-300" style={{ width: `${whitePercent}%` }} />
                        <div className="bg-zinc-800 flex-1" />
                      </div>
                      <div className={`w-16 text-center py-1 rounded text-sm font-bold ${evalNum >= 0 ? 'text-white' : 'text-zinc-400'}`}>
                        {evalScore}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Sharpness */}
              {(() => {
                const sharp = sharpnessData[pos.id.toString()];
                const sharpValue = sharp?.sharpness ?? meanSharpness;
                const isEstimated = !sharp;
                const sharpPercent = Math.min(100, (sharpValue / 2) * 100);
                return (
                  <div className="p-4 rounded-xl bg-surface border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-creme-muted uppercase tracking-wider">Sharpness</div>
                      {isEstimated && <div className="text-[10px] text-creme-muted/50">estimated</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full overflow-hidden bg-background">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 to-rose-400 transition-all duration-300" 
                          style={{ width: `${sharpPercent}%` }} 
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-medium text-creme">
                        {sharpValue.toFixed(2)}
                      </div>
                    </div>
                    {sharp?.wdl && (
                      <div className="flex justify-between mt-3 text-xs text-creme-muted/70">
                        <span>W: {(sharp.wdl.w / 10).toFixed(1)}%</span>
                        <span>D: {(sharp.wdl.d / 10).toFixed(1)}%</span>
                        <span>L: {(sharp.wdl.l / 10).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          )}

          <AnalysisPanel
            lines={displayLines}
            isAnalyzing={analyzing}
            isThinking={isThinking}
            engineDepth={engineDepth}
            multiPV={multiPV}
            onMultiPVChange={setMultiPV}
            onAnalyzeToggle={() => setAnalyzing(!analyzing)}
          />

          <StatsPanel stats={pgnStats || undefined} />

          {/* Recent Games from PGN database */}
          {pgnGames.length > 0 && (
            <div className="p-5 rounded-xl bg-surface border border-white/5">
              <div className="text-xs text-creme-muted/70 uppercase tracking-wider mb-4">Tournament Games ({pgnGames.length})</div>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {pgnGames.slice(0, 10).map((g, i) => {
                  const handleClick = () => {
                    const pgn = getPgnForGame(g);
                    if (pgn) setSelectedGame({ game: g, pgn });
                  };
                  return (
                    <button
                      key={i}
                      onClick={handleClick}
                      className="w-full text-left p-3 rounded-lg bg-background/50 border border-white/5 hover:border-accent/30 hover:bg-background transition-all group"
                    >
                      <div className="flex justify-between text-[10px] text-creme-muted/60 mb-2 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {g.event.toLowerCase().includes("freestyle") && (
                            <div className="relative w-3 h-3 rounded-sm overflow-hidden shrink-0 opacity-80">
                              <Image src="/freestyle.jpeg" alt="Freestyle" fill className="object-cover" />
                            </div>
                          )}
                          <span className="truncate font-medium text-creme-muted group-hover:text-creme transition-colors">{g.event}</span>
                        </div>
                        <span className="font-mono shrink-0">{g.date}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm flex items-center gap-1 min-w-0 flex-1">
                          <span className={`truncate ${g.result === "1-0" ? "text-emerald-400 font-bold" : "text-creme"}`}>{g.white}</span>
                          <span className="text-creme-muted text-[10px] uppercase shrink-0">vs</span>
                          <span className={`truncate ${g.result === "0-1" ? "text-emerald-400 font-bold" : "text-creme"}`}>{g.black}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          g.result === '1-0' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                          g.result === '0-1' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                          'bg-white/5 text-creme-muted border border-white/10'
                        }`}>{g.result}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* PGN Viewer Modal Removed - Replaced by GameViewer condition above */}
    </div>
  );
}
