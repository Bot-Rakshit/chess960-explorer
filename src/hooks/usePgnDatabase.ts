"use client";

import { useState, useEffect, useCallback } from "react";
import { GMGame } from "@/types";

interface ParsedGame {
  pgn: string;
  fen: string;
  white: string;
  black: string;
  event: string;
  date: string;
  result: string;
  whiteElo?: number;
  blackElo?: number;
}

let cachedGames: ParsedGame[] | null = null;
let loadingPromise: Promise<ParsedGame[]> | null = null;

function parseGamesFromPgn(text: string): ParsedGame[] {
  const games: ParsedGame[] = [];
  const gameTexts = text.split(/(?=\[Event\s+")/);

  for (const gameText of gameTexts) {
    if (!gameText.trim()) continue;

    const getHeader = (header: string): string => {
      const match = gameText.match(new RegExp(`\\[${header}\\s+"([^"]+)"\\]`));
      return match ? match[1] : "";
    };

    const fen = getHeader("FEN");
    if (!fen) continue;

    const whiteEloStr = getHeader("WhiteElo");
    const blackEloStr = getHeader("BlackElo");

    games.push({
      pgn: gameText,
      fen,
      white: getHeader("White"),
      black: getHeader("Black"),
      event: getHeader("Event"),
      date: getHeader("Date"),
      result: getHeader("Result"),
      whiteElo: whiteEloStr ? parseInt(whiteEloStr) : undefined,
      blackElo: blackEloStr ? parseInt(blackEloStr) : undefined,
    });
  }

  return games;
}

async function loadGames(): Promise<ParsedGame[]> {
  if (cachedGames) return cachedGames;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch("/data/chess960_all_games.pgn")
    .then((res) => res.text())
    .then((text) => {
      cachedGames = parseGamesFromPgn(text);
      return cachedGames;
    });

  return loadingPromise;
}

// Preload the database immediately when this module loads
if (typeof window !== "undefined") {
  loadGames();
}

// Normalize FEN for comparison - only compare board position (first part)
// Castling rights notation differs between Chess960 formats (KQkq vs KFkf etc)
function normalizeFen(fen: string): string {
  const parts = fen.split(" ");
  // Only use board position - ignore castling, en passant, move counters
  return parts[0];
}

export function usePgnDatabase() {
  const [games, setGames] = useState<ParsedGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames().then((g) => {
      setGames(g);
      setLoading(false);
    });
  }, []);

  const getGamesForFen = useCallback(
    (fen: string): GMGame[] => {
      const normalizedTarget = normalizeFen(fen);
      return games
        .filter((g) => normalizeFen(g.fen) === normalizedTarget)
        .map((g) => ({
          event: g.event,
          date: g.date,
          white: g.white,
          black: g.black,
          result: g.result,
          whiteElo: g.whiteElo,
          blackElo: g.blackElo,
        }));
    },
    [games]
  );

  const getPgnForGame = useCallback(
    (game: GMGame): string | null => {
      const found = games.find(
        (g) =>
          g.white === game.white &&
          g.black === game.black &&
          g.date === game.date &&
          g.result === game.result
      );
      return found?.pgn || null;
    },
    [games]
  );

  const getGameStats = useCallback(
    (fen: string) => {
      const matchingGames = games.filter(
        (g) => normalizeFen(g.fen) === normalizeFen(fen)
      );
      if (matchingGames.length === 0) return null;

      const whiteWins = matchingGames.filter((g) => g.result === "1-0").length;
      const blackWins = matchingGames.filter((g) => g.result === "0-1").length;
      const draws = matchingGames.filter((g) => g.result === "1/2-1/2").length;
      const total = matchingGames.length;

      const players = new Set<string>();
      matchingGames.forEach((g) => {
        if (g.white) players.add(g.white.split(",")[0]);
        if (g.black) players.add(g.black.split(",")[0]);
      });

      return {
        totalGames: total,
        whiteWins,
        blackWins,
        draws,
        whiteWinRate: Math.round((whiteWins / total) * 100),
        blackWinRate: Math.round((blackWins / total) * 100),
        drawRate: Math.round((draws / total) * 100),
        topPlayers: Array.from(players).slice(0, 8),
        recentGames: matchingGames
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map((g) => ({
            event: g.event,
            date: g.date,
            white: g.white,
            black: g.black,
            result: g.result,
            whiteElo: g.whiteElo,
            blackElo: g.blackElo,
          })),
      };
    },
    [games]
  );

  return {
    games,
    loading,
    getGamesForFen,
    getPgnForGame,
    getGameStats,
  };
}
