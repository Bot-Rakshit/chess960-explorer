"use client";

import { useState, useEffect, useCallback } from "react";
import { GMGame } from "@/types";

interface ParsedGame {
  pgn: string;
  fen: string;
  board: string;
  white: string;
  black: string;
  event: string;
  date: string;
  result: string;
  whiteElo: number | null;
  blackElo: number | null;
}

interface GamesDB {
  games: ParsedGame[];
  gamesByBoard: Record<string, ParsedGame[]>;
}

let cachedDB: GamesDB | null = null;
let loadingPromise: Promise<GamesDB> | null = null;

async function loadDB(): Promise<GamesDB> {
  if (cachedDB) return cachedDB;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch("/data/games_db.json")
    .then((res) => res.json())
    .then((data: GamesDB) => {
      cachedDB = data;
      return cachedDB;
    });

  return loadingPromise;
}

// Preload immediately
if (typeof window !== "undefined") {
  loadDB();
}

function getBoardPosition(fen: string): string {
  return fen.split(" ")[0];
}

export function usePgnDatabase() {
  const [db, setDb] = useState<GamesDB | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDB().then((data) => {
      setDb(data);
      setLoading(false);
    });
  }, []);

  const getGamesForFen = useCallback(
    (fen: string): GMGame[] => {
      if (!db) return [];
      const board = getBoardPosition(fen);
      const games = db.gamesByBoard[board] || [];
      return games.map((g) => ({
        event: g.event,
        date: g.date,
        white: g.white,
        black: g.black,
        result: g.result,
        whiteElo: g.whiteElo || undefined,
        blackElo: g.blackElo || undefined,
      }));
    },
    [db]
  );

  const getPgnForGame = useCallback(
    (game: GMGame): string | null => {
      if (!db) return null;
      const found = db.games.find(
        (g) =>
          g.white === game.white &&
          g.black === game.black &&
          g.date === game.date &&
          g.result === game.result
      );
      return found?.pgn || null;
    },
    [db]
  );

  const getGameStats = useCallback(
    (fen: string) => {
      if (!db) return null;
      const board = getBoardPosition(fen);
      const matchingGames = db.gamesByBoard[board] || [];
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
            whiteElo: g.whiteElo || undefined,
            blackElo: g.blackElo || undefined,
          })),
      };
    },
    [db]
  );

  return {
    loading,
    getGamesForFen,
    getPgnForGame,
    getGameStats,
  };
}
