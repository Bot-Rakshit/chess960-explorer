"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import ChessBoard from "@/components/ChessBoard";

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
      const moveCount = 14 + Math.floor(Math.random() * 4); // 14-17 moves

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-creme-muted">Loading challenge...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
              960
            </div>
            <span className="text-creme font-semibold hidden sm:block">Chess960 Explorer</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/explore" className="text-sm text-creme-muted hover:text-creme transition-colors">
              Explore
            </Link>
            <Link href="/challenge" className="text-sm text-amber-400 font-medium">
              Challenge
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        {/* Score Bar */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mb-6 sm:mb-10">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-creme">{score}</div>
            <div className="text-[10px] sm:text-xs text-creme-muted uppercase tracking-wider">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-amber-400">{streak}</div>
            <div className="text-[10px] sm:text-xs text-creme-muted uppercase tracking-wider">Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-creme-muted">{bestStreak}</div>
            <div className="text-[10px] sm:text-xs text-creme-muted uppercase tracking-wider">Best</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-creme-muted">
              {totalPlayed > 0 ? Math.round((score / totalPlayed) * 100) : 0}%
            </div>
            <div className="text-[10px] sm:text-xs text-creme-muted uppercase tracking-wider">Accuracy</div>
          </div>
        </div>

        {challenge && (
          <>
            {/* Game Info */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-white/10 mb-3">
                <span className="text-creme font-medium">{getPlayerSurname(challenge.game.white)}</span>
                <span className="text-creme-muted text-sm">vs</span>
                <span className="text-creme font-medium">{getPlayerSurname(challenge.game.black)}</span>
              </div>
              <div className="text-xs sm:text-sm text-creme-muted">
                {challenge.game.event} • {challenge.game.date}
              </div>
            </div>

            {/* Question */}
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl text-creme mb-2">
                Position after <span className="text-amber-400 font-bold">{challenge.moveCount}</span> moves
              </h2>
              <p className="text-xs sm:text-sm text-creme-muted">Which starting position did this game begin from?</p>
            </div>

            {/* Current Position Board */}
            <div className="flex justify-center mb-8 sm:mb-12">
              <div className="w-full max-w-[320px] sm:max-w-[400px]">
                <div className="aspect-square rounded-xl overflow-hidden border-2 border-amber-500/30 shadow-lg shadow-amber-500/10">
                  <ChessBoard
                    fen={challenge.positionAfterMoves}
                    arePiecesDraggable={false}
                    id="current-position"
                  />
                </div>
                <div className="text-center mt-2 text-xs text-creme-muted">Current Position</div>
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-4xl mx-auto mb-8">
              {challenge.options.map((option) => {
                const isSelected = selected === option.id;
                const isCorrect = option.id === challenge.correctPosition.id;
                const showCorrect = revealed && isCorrect;
                const showWrong = revealed && isSelected && !isCorrect;

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    disabled={revealed}
                    className={`relative group transition-all duration-200 ${
                      revealed ? "cursor-default" : "cursor-pointer hover:scale-[1.02]"
                    }`}
                  >
                    <div
                      className={`aspect-square rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                        showCorrect
                          ? "border-emerald-500 shadow-lg shadow-emerald-500/30"
                          : showWrong
                          ? "border-rose-500 shadow-lg shadow-rose-500/30"
                          : isSelected
                          ? "border-amber-500 shadow-lg shadow-amber-500/20"
                          : "border-white/10 group-hover:border-white/30"
                      }`}
                    >
                      <ChessBoard
                        fen={option.fen}
                        arePiecesDraggable={false}
                        id={`option-${option.id}`}
                      />
                    </div>
                    <div
                      className={`mt-2 text-xs sm:text-sm font-medium transition-colors ${
                        showCorrect
                          ? "text-emerald-400"
                          : showWrong
                          ? "text-rose-400"
                          : isSelected
                          ? "text-amber-400"
                          : "text-creme-muted group-hover:text-creme"
                      }`}
                    >
                      Position #{option.id}
                    </div>
                    {showCorrect && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {showWrong && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-rose-500 flex items-center justify-center">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              {!revealed ? (
                <button
                  onClick={handleReveal}
                  disabled={selected === null}
                  className={`px-6 sm:px-8 py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                    selected === null
                      ? "bg-white/5 text-creme-muted cursor-not-allowed"
                      : "bg-amber-500 text-black hover:bg-amber-400"
                  }`}
                >
                  Check Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-6 sm:px-8 py-3 rounded-xl font-semibold text-sm sm:text-base bg-amber-500 text-black hover:bg-amber-400 transition-all"
                >
                  Next Challenge →
                </button>
              )}
            </div>

            {/* Feedback Message */}
            {revealed && (
              <div className="mt-6 text-center">
                {selected === challenge.correctPosition.id ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400 font-medium">Correct! Well done!</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/20 border border-rose-500/30">
                    <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-rose-400 font-medium">
                      Wrong! It was Position #{challenge.correctPosition.id}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Link to Explore */}
            {revealed && (
              <div className="mt-4 text-center">
                <Link
                  href={`/explore?position=${challenge.correctPosition.id}`}
                  className="text-sm text-creme-muted hover:text-amber-400 transition-colors"
                >
                  Explore Position #{challenge.correctPosition.id} →
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
