import { useState, useEffect, useCallback, useRef } from "react";

export type BotDifficulty = "easy" | "medium" | "hard";

interface BotConfig {
    depth: number;
    skillLevel: number;
    moveTime: number;
    randomness: number;
}

const DIFFICULTY_CONFIG: Record<BotDifficulty, BotConfig> = {
    easy: { depth: 5, skillLevel: 3, moveTime: 500, randomness: 0.4 },
    medium: { depth: 10, skillLevel: 10, moveTime: 800, randomness: 0.15 },
    hard: { depth: 15, skillLevel: 18, moveTime: 1200, randomness: 0.05 },
};

export function useBot(difficulty: BotDifficulty = "medium") {
    const workerRef = useRef<Worker | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const currentFenRef = useRef<string>("");
    const moveCallbackRef = useRef<((move: string) => void) | null>(null);
    const candidateMovesRef = useRef<{ move: string; score: number }[]>([]);
    const configRef = useRef<BotConfig>(DIFFICULTY_CONFIG[difficulty]);

    useEffect(() => {
        configRef.current = DIFFICULTY_CONFIG[difficulty];
        if (workerRef.current && isReady) {
            workerRef.current.postMessage(`setoption name Skill Level value ${configRef.current.skillLevel}`);
        }
    }, [difficulty, isReady]);

    useEffect(() => {
        try {
            const worker = new Worker('/stockfish/stockfish-17-lite-single.js');
            workerRef.current = worker;

            worker.onmessage = (e) => {
                const msg = e.data;
                if (msg === 'uciok') {
                    worker.postMessage('setoption name UCI_Chess960 value true');
                    worker.postMessage(`setoption name Skill Level value ${configRef.current.skillLevel}`);
                    worker.postMessage('setoption name MultiPV value 5');
                    worker.postMessage('isready');
                }
                if (msg === 'readyok') setIsReady(true);

                if (typeof msg === 'string') {
                    const match = msg.match(/info depth (\d+).*?multipv (\d+).*?score (cp|mate) (-?\d+).*?pv (\S+)/);
                    if (match) {
                        const depth = parseInt(match[1]);
                        const multipv = parseInt(match[2]);
                        const scoreType = match[3];
                        const scoreVal = parseInt(match[4]);
                        const move = match[5];
                        
                        if (depth >= configRef.current.depth - 2) {
                            const score = scoreType === 'mate' 
                                ? (scoreVal > 0 ? 10000 - scoreVal : -10000 - scoreVal)
                                : scoreVal;
                            
                            if (multipv === 1) {
                                candidateMovesRef.current = [{ move, score }];
                            } else if (multipv <= 5) {
                                candidateMovesRef.current.push({ move, score });
                            }
                        }
                    }

                    if (msg.startsWith('bestmove')) {
                        const bestMatch = msg.match(/bestmove (\S+)/);
                        if (bestMatch && moveCallbackRef.current) {
                            const candidates = candidateMovesRef.current;
                            let selectedMove = bestMatch[1];
                            
                            if (candidates.length > 1 && Math.random() < configRef.current.randomness) {
                                const weights = candidates.map((c, i) => Math.exp(-i * 0.5));
                                const totalWeight = weights.reduce((a, b) => a + b, 0);
                                let rand = Math.random() * totalWeight;
                                for (let i = 0; i < candidates.length; i++) {
                                    rand -= weights[i];
                                    if (rand <= 0) {
                                        selectedMove = candidates[i].move;
                                        break;
                                    }
                                }
                            }
                            
                            const thinkDelay = configRef.current.moveTime * (0.5 + Math.random() * 0.5);
                            setTimeout(() => {
                                moveCallbackRef.current?.(selectedMove);
                                setIsThinking(false);
                            }, thinkDelay);
                        } else {
                            setIsThinking(false);
                        }
                    }
                }
            };

            worker.postMessage('uci');
            return () => { worker.terminate(); };
        } catch (err) {
            console.error('Bot init error:', err);
        }
    }, []);

    const getBotMove = useCallback((fen: string): Promise<string> => {
        return new Promise((resolve) => {
            if (!workerRef.current || !isReady) {
                resolve("");
                return;
            }

            currentFenRef.current = fen;
            candidateMovesRef.current = [];
            setIsThinking(true);
            moveCallbackRef.current = resolve;

            workerRef.current.postMessage('stop');
            setTimeout(() => {
                workerRef.current?.postMessage(`position fen ${fen}`);
                workerRef.current?.postMessage(`go depth ${configRef.current.depth}`);
            }, 50);
        });
    }, [isReady]);

    const stop = useCallback(() => {
        workerRef.current?.postMessage('stop');
        setIsThinking(false);
        moveCallbackRef.current = null;
    }, []);

    return {
        getBotMove,
        stop,
        isReady,
        isThinking,
        difficulty,
    };
}
