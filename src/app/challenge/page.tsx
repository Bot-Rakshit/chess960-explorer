"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import ChessBoard from "@/components/ChessBoard";
import Header from "@/components/Header";
import Loader from "@/components/Loader";

interface GameData {
  pgn: string;
  fen: string;
  white: string;
  black: string;
  event: string;
  date: string;
  result: string;
  whiteElo: number | null;
  blackElo: number | null;
}

interface GamesDB {
  games: GameData[];
  gamesByBoard: Record<string, GameData[]>;
}

interface Position {
  id: number;
  fen: string;
}

interface Challenge {
  game: GameData;
  positionAfterMoves: string;
  moveCount: number;
  correctPosition: Position;
  options: Position[];
}

function extractMoves(pgn: string): string[] {
  const movesSection = pgn.split(/\n\n/)[1] || pgn;
  const cleaned = movesSection
    .replace(/\{[^}]*\}/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\d+\.\s*/g, " ")
    .replace(/1-0|0-1|1\/2-1\/2|\*/g, "")
    .trim();
  return cleaned.split(/\s+/).filter((m) => m && m !== "...");
}

function playMoves(startFen: string, moves: string[], count: number): string | null {
  try {
    const setup = parseFen(startFen);
    if (!setup.isOk) return null;
    const game = Chess.fromSetup(setup.value);
    if (!game.isOk) return null;
    const chess = game.value;

    const movesToPlay = moves.slice(0, count);
    for (const san of movesToPlay) {
      const move = parseSan(chess, san);
      if (!move) return null;
      chess.play(move);
    }
    return makeFen(chess.toSetup());
  } catch {
    return null;
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getPlayerSurname(name: string): string {
  if (!name) return "Unknown";
  const parts = name.split(",");
  return parts[0].trim();
}

export default function ChallengePage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [gamesDb, setGamesDb] = useState<GamesDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);

  // Load best streak from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("chess960-challenge-best");
    if (saved) {
      setBestStreak(parseInt(saved, 10));
    }
  }, []);

  // Save best streak to localStorage
  useEffect(() => {
    if (bestStreak > 0) {
      localStorage.setItem("chess960-challenge-best", bestStreak.toString());
    }
  }, [bestStreak]);

  useEffect(() => {
    Promise.all([
      fetch("/data/chess960.json").then((r) => r.json()),
      fetch("/data/games_db.json").then((r) => r.json()),
    ]).then(([posData, gamesData]) => {
      setPositions(posData.positions);
      setGamesDb(gamesData);
      setLoading(false);
    });
  }, []);

  const generateChallenge = useCallback(() => {
    if (!gamesDb || positions.length === 0) return;

    const validGames = gamesDb.games.filter((g) => {
      const moves = extractMoves(g.pgn);
      return moves.length >= 20;
    });

    if (validGames.length === 0) return;

    let attempts = 0;
    while (attempts < 50) {
      attempts++;
      const game = validGames[Math.floor(Math.random() * validGames.length)];
      const moves = extractMoves(game.pgn);
      const moveCount = 20 + Math.floor(Math.random() * 6); // 20-25 moves

      const positionAfterMoves = playMoves(game.fen, moves, moveCount);
      if (!positionAfterMoves) continue;

      const correctPos = positions.find(
        (p) => p.fen.split(" ")[0] === game.fen.split(" ")[0]
      );
      if (!correctPos) continue;

      const wrongOptions = shuffleArray(
        positions.filter((p) => p.id !== correctPos.id)
      ).slice(0, 2);

      const options = shuffleArray([correctPos, ...wrongOptions]);

      setChallenge({
        game,
        positionAfterMoves,
        moveCount,
        correctPosition: correctPos,
        options,
      });
      setSelected(null);
      setRevealed(false);
      return;
    }
  }, [gamesDb, positions]);

  useEffect(() => {
    if (!loading && gamesDb && positions.length > 0 && !challenge) {
      generateChallenge();
    }
  }, [loading, gamesDb, positions, challenge, generateChallenge]);

  const handleSelect = (posId: number) => {
    if (revealed) return;
    setSelected(posId);
  };

  const handleReveal = () => {
    if (selected === null || !challenge) return;
    setRevealed(true);
    setTotalPlayed((p) => p + 1);

    if (selected === challenge.correctPosition.id) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const newStreak = s + 1;
        setBestStreak((b) => Math.max(b, newStreak));
        return newStreak;
      });
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    generateChallenge();
  };

  if (loading) {
    return <Loader fullScreen text="Loading challenge..." />;
  }

  return (
    <div className="min-h-screen bg-background text-creme">
      <Header />

      <main className="min-h-[calc(100vh-57px)] lg:h-[calc(100vh-57px)] lg:overflow-hidden">
        <div className="h-full flex flex-col lg:flex-row">
          {/* Main Game Area */}
          <div className="flex-1 flex items-center justify-center p-3 sm:p-4 lg:p-6 overflow-y-auto">
            {challenge && (
              <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-[480px] lg:max-w-none lg:flex-row lg:gap-10">
                {/* Current Position */}
                <div className="flex flex-col items-center w-full lg:w-auto">
                  <div className="text-center mb-3 sm:mb-4">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-surface border border-white/10 mb-1.5 sm:mb-2">
                      <span className="font-semibold text-sm sm:text-base">{getPlayerSurname(challenge.game.white)}</span>
                      <span className="text-creme-muted/60 text-sm">vs</span>
                      <span className="font-semibold text-sm sm:text-base">{getPlayerSurname(challenge.game.black)}</span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-creme-muted/60">
                      {challenge.game.event} • {challenge.game.date}
                    </div>
                  </div>
                  <div className="w-full max-w-[280px] sm:max-w-[320px] lg:w-[380px] xl:w-[440px]">
                    <div className="aspect-square rounded-xl overflow-hidden border border-white/10">
                      <ChessBoard
                        fen={challenge.positionAfterMoves}
                        arePiecesDraggable={false}
                        id="current-position"
                      />
                    </div>
                    <div className="text-center mt-2 sm:mt-3 text-xs sm:text-sm text-creme-muted">
                      After <span className="text-accent font-semibold">{challenge.moveCount}</span> moves
                    </div>
                  </div>
                </div>

                {/* Options Panel */}
                <div className="flex flex-col items-center w-full lg:w-auto">
                  <div className="text-xs sm:text-sm text-creme-muted mb-3 sm:mb-4">Which starting position?</div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-[320px] lg:flex lg:flex-col lg:max-w-none lg:w-auto">
                    {challenge.options.map((option, idx) => {
                      const isSelected = selected === option.id;
                      const isCorrect = option.id === challenge.correctPosition.id;
                      const showCorrect = revealed && isCorrect;
                      const showWrong = revealed && isSelected && !isCorrect;
                      
                      const boardColors = [
                        { light: "#e8dfd4", dark: "#99805d" },
                        { light: "#d4e8d8", dark: "#5d9970" },
                        { light: "#e8d4df", dark: "#995d7a" },
                      ];
                      const colors = boardColors[idx % 3];

                      return (
                        <button
                          key={option.id}
                          onClick={() => handleSelect(option.id)}
                          disabled={revealed}
                          className={`relative group transition-all duration-200 flex flex-col lg:flex-row items-center gap-1.5 lg:gap-3 p-1.5 sm:p-2 rounded-lg ${
                            revealed ? "cursor-default" : "cursor-pointer active:scale-95 lg:hover:bg-[#1a1a1a]"
                          } ${isSelected && !revealed ? "bg-[#1a1a1a] ring-2 ring-amber-500/70" : ""}`}
                        >
                          <div
                            className={`w-full lg:w-[120px] xl:w-[140px] aspect-square rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                              showCorrect
                                ? "border-green-500"
                                : showWrong
                                ? "border-red-500"
                                : isSelected
                                ? "border-amber-500"
                                : "border-[#2a2a2a]"
                            }`}
                          >
                            <ChessBoard
                              fen={option.fen}
                              arePiecesDraggable={false}
                              id={`option-${option.id}`}
                              lightSquareColor={colors.light}
                              darkSquareColor={colors.dark}
                            />
                          </div>
                          <div
                            className={`text-xs sm:text-sm font-medium transition-colors ${
                              showCorrect
                                ? "text-green-500"
                                : showWrong
                                ? "text-red-500"
                                : isSelected
                                ? "text-amber-500"
                                : "text-[#888]"
                            }`}
                          >
                            #{option.id}
                          </div>
                          {showCorrect && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {showWrong && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500 flex items-center justify-center">
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Message - Mobile */}
                  {revealed && challenge && (
                    <div className="lg:hidden mt-3 w-full max-w-[320px]">
                      {selected === challenge.correctPosition.id ? (
                        <div className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-500 text-sm font-medium">Correct!</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-red-500 text-sm font-medium">
                            It was #{challenge.correctPosition.id}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="flex justify-center mt-4 sm:mt-5 w-full">
                    {!revealed ? (
                      <button
                        onClick={handleReveal}
                        disabled={selected === null}
                        className={`w-full max-w-[280px] sm:w-auto px-8 py-3 sm:py-2.5 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                          selected === null
                            ? "bg-[#1a1a1a] text-[#666] cursor-not-allowed"
                            : "bg-amber-500 text-black active:bg-amber-600 sm:hover:bg-amber-400"
                        }`}
                      >
                        Check Answer
                      </button>
                    ) : (
                      <button
                        onClick={handleNext}
                        className="w-full max-w-[280px] sm:w-auto px-8 py-3 sm:py-2.5 rounded-lg font-semibold bg-amber-500 text-black active:bg-amber-600 sm:hover:bg-amber-400 transition-colors text-sm sm:text-base"
                      >
                        Next Challenge →
                      </button>
                    )}
                  </div>

                  {/* Explore Link - Mobile */}
                  {revealed && challenge && (
                    <Link
                      href={`/explore?position=${challenge.correctPosition.id}`}
                      className="lg:hidden mt-2 text-center text-xs sm:text-sm text-[#888] hover:text-amber-500 active:text-amber-500 transition-colors"
                    >
                      Explore Position →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats Panel - Fixed at bottom on mobile */}
          <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-[#2a2a2a] bg-[#0f0f0f] p-3 sm:p-4 lg:p-5 flex flex-row lg:flex-col gap-2 sm:gap-4 lg:gap-5 justify-center lg:justify-start">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 lg:grid-cols-2 gap-1.5 sm:gap-3 w-full">
              <div className="text-center p-2 sm:p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold">{score}</div>
                <div className="text-[8px] sm:text-[10px] text-[#666] uppercase tracking-wide">Correct</div>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-lg bg-[#1a1a1a] border border-amber-500/30">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-500">{streak}</div>
                <div className="text-[8px] sm:text-[10px] text-[#666] uppercase tracking-wide">Streak</div>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#888]">{bestStreak}</div>
                <div className="text-[8px] sm:text-[10px] text-[#666] uppercase tracking-wide">Best</div>
              </div>
              <div className="text-center p-2 sm:p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#888]">
                  {totalPlayed > 0 ? Math.round((score / totalPlayed) * 100) : 0}%
                </div>
                <div className="text-[8px] sm:text-[10px] text-[#666] uppercase tracking-wide">Accuracy</div>
              </div>
            </div>

            {/* Feedback Message - Desktop */}
            {revealed && challenge && (
              <div className="hidden lg:block">
                {selected === challenge.correctPosition.id ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-500 text-sm">Correct!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-red-500 text-sm">
                      It was #{challenge.correctPosition.id}
                    </span>
                  </div>
                )}
                <Link
                  href={`/explore?position=${challenge.correctPosition.id}`}
                  className="mt-3 block text-center text-sm text-[#888] hover:text-amber-500 transition-colors"
                >
                  Explore Position →
                </Link>
              </div>
            )}

            {/* Instructions */}
            <div className="hidden lg:block text-sm text-[#666] leading-relaxed">
              <p className="mb-2 font-medium text-[#888]">How to play:</p>
              <p>Identify the starting position from the game state shown.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
