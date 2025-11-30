export interface GMGame {
    event: string;
    date: string;
    white: string;
    black: string;
    result: string;
    whiteElo?: number;
    blackElo?: number;
}

export interface GMStats {
    totalGames: number;
    whiteWins: number;
    blackWins: number;
    draws: number;
    whiteWinRate: number;
    blackWinRate: number;
    drawRate: number;
    topPlayers: string[];
    recentGames: GMGame[];
}

export interface EngineLine {
    moves: string;
    eval: number;
    mate?: number | null;
}

export interface PositionEval {
    fen: string;
    knodes: number;
    depth: number;
    pvs: EngineLine[];
}

export interface Position {
    id: number;
    fen: string;
    eval: PositionEval | null;
    plan?: string;
    tags?: string[];
    keySquares?: string[];
    pvSan?: string[];
    gmStats?: GMStats;
}
