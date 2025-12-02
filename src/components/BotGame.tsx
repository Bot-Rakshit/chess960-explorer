"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chess } from "chessops/chess";
import { parseFen, makeFen } from "chessops/fen";
import { parseUci, makeSquare } from "chessops/util";
import { makeSan } from "chessops/san";
import ChessBoard from "@/components/ChessBoard";
import { useBot, BotDifficulty } from "@/hooks/useBot";
import { useSound } from "@/hooks/useSound";
import { ChevronLeft, RotateCcw, Flag, Handshake, Clock, Bot, User } from "lucide-react";

interface BotGameProps {
    startFen: string;
    positionId: number;
    onBack: () => void;
}

interface MoveRecord {
    san: string;
    fen: string;
    uci: string;
}

type GameResult = "playing" | "white_wins" | "black_wins" | "draw" | "white_resigned" | "black_resigned";

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getResultText(result: GameResult, playerColor: "white" | "black"): string {
    switch (result) {
        case "white_wins":
            return playerColor === "white" ? "You Win!" : "Bot Wins";
        case "black_wins":
            return playerColor === "black" ? "You Win!" : "Bot Wins";
        case "draw":
            return "Draw";
        case "white_resigned":
            return playerColor === "white" ? "You Resigned" : "Bot Resigned";
        case "black_resigned":
            return playerColor === "black" ? "You Resigned" : "Bot Resigned";
        default:
            return "";
    }
}

export default function BotGame({ startFen, positionId, onBack }: BotGameProps) {
    const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
    const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
    const [gameStarted, setGameStarted] = useState(false);
    const [currentFen, setCurrentFen] = useState(startFen);
    const [moves, setMoves] = useState<MoveRecord[]>([]);
    const [result, setResult] = useState<GameResult>("playing");
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [takebackUsed, setTakebackUsed] = useState(false);
    const [drawOffered, setDrawOffered] = useState(false);
    
    const [whiteTime, setWhiteTime] = useState(600);
    const [blackTime, setBlackTime] = useState(600);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    
    const gameRef = useRef<Chess | null>(null);
    const moveHistoryRef = useRef<Chess[]>([]);
    
    const { getBotMove, stop: stopBot, isReady: botReady, isThinking } = useBot(difficulty);
    const { play: playSound } = useSound();

    const currentTurn = useMemo(() => {
        return currentFen.includes(' w ') ? 'white' : 'black';
    }, [currentFen]);

    const isPlayerTurn = currentTurn === playerColor;

    useEffect(() => {
        try {
            const setup = parseFen(startFen);
            if (setup.isOk) {
                const game = Chess.fromSetup(setup.value);
                if (game.isOk) {
                    gameRef.current = game.value;
                    moveHistoryRef.current = [game.value.clone()];
                }
            }
        } catch (e) {
            console.error("Failed to parse starting FEN:", e);
        }
    }, [startFen]);

    useEffect(() => {
        if (!gameStarted || result !== "playing") {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            if (currentTurn === "white") {
                setWhiteTime(prev => {
                    if (prev <= 1) {
                        setResult("black_wins");
                        return 0;
                    }
                    return prev - 1;
                });
            } else {
                setBlackTime(prev => {
                    if (prev <= 1) {
                        setResult("white_wins");
                        return 0;
                    }
                    return prev - 1;
                });
            }
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameStarted, result, currentTurn]);

    const checkGameEnd = useCallback((game: Chess): GameResult => {
        if (game.isCheckmate()) {
            return game.turn === 'white' ? 'black_wins' : 'white_wins';
        }
        if (game.isStalemate() || game.isInsufficientMaterial()) {
            return 'draw';
        }
        return 'playing';
    }, []);

    const makeMove = useCallback((uci: string): boolean => {
        if (!gameRef.current || result !== "playing") return false;

        try {
            const move = parseUci(uci);
            if (!move || !gameRef.current.isLegal(move)) return false;

            const san = makeSan(gameRef.current, move);
            
            // Detect move type for sound
            const isCapture = san.includes('x');
            const isCastle = san === 'O-O' || san === 'O-O-O';
            const isPromotion = san.includes('=');
            
            // Check if move results in check
            const gameCopy = gameRef.current.clone();
            gameCopy.play(move);
            const isCheck = gameCopy.isCheck();
            
            moveHistoryRef.current.push(gameRef.current.clone());
            gameRef.current.play(move);

            const newFen = makeFen(gameRef.current.toSetup());
            setCurrentFen(newFen);
            setMoves(prev => [...prev, { san, fen: newFen, uci }]);
            
            if ('from' in move) {
                const from = makeSquare(move.from);
                const to = makeSquare(move.to);
                setLastMove({ from, to });
            }

            // Play sound based on move type
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

            const gameResult = checkGameEnd(gameRef.current);
            if (gameResult !== "playing") {
                setResult(gameResult);
            }

            return true;
        } catch {
            return false;
        }
    }, [result, checkGameEnd, playSound]);

    useEffect(() => {
        if (!gameStarted || result !== "playing" || !botReady) return;
        if (currentTurn === playerColor) return;

        const botTime = playerColor === "white" ? blackTime : whiteTime;
        
        const makeBotMove = async () => {
            const startTime = Date.now();
            const botMove = await getBotMove(currentFen);
            const thinkTime = Date.now() - startTime;
            
            if (botMove) {
                // Calculate human-like delay
                // Base delay: 1-5 seconds for normal moves
                // Shorter if low on time, longer for complex positions (more pieces)
                const pieceCount = currentFen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
                const isComplex = pieceCount > 20;
                const isEndgame = pieceCount < 12;
                const isLowTime = botTime < 60;
                const isCriticalTime = botTime < 30;
                
                let minDelay = 1000; // 1 second minimum
                let maxDelay = 8000; // 8 seconds base max
                
                if (isCriticalTime) {
                    minDelay = 200;
                    maxDelay = 1500;
                } else if (isLowTime) {
                    minDelay = 500;
                    maxDelay = 3000;
                } else if (isComplex) {
                    minDelay = 2000;
                    maxDelay = 15000;
                } else if (isEndgame) {
                    minDelay = 1500;
                    maxDelay = 10000;
                }
                
                // Add some randomness for natural feel
                const randomFactor = 0.5 + Math.random(); // 0.5 to 1.5
                let targetDelay = (minDelay + Math.random() * (maxDelay - minDelay)) * randomFactor;
                
                // Cap at 30 seconds
                targetDelay = Math.min(targetDelay, 30000);
                
                // Account for actual think time already elapsed
                const remainingDelay = Math.max(0, targetDelay - thinkTime);
                
                setTimeout(() => {
                    makeMove(botMove);
                }, remainingDelay);
            }
        };

        // Small initial delay before starting to "think"
        const delay = setTimeout(makeBotMove, 100);
        return () => clearTimeout(delay);
    }, [gameStarted, result, botReady, currentTurn, playerColor, currentFen, getBotMove, makeMove, whiteTime, blackTime]);

    const handleDrop = useCallback((src: string, tgt: string, piece: string): boolean => {
        if (!isPlayerTurn || result !== "playing" || !gameStarted) return false;

        const isPromotion = piece[1]?.toLowerCase() === 'p' && (tgt[1] === '8' || tgt[1] === '1');
        const uci = src + tgt + (isPromotion ? 'q' : '');
        
        return makeMove(uci);
    }, [isPlayerTurn, result, gameStarted, makeMove]);

    const handleStartGame = () => {
        setGameStarted(true);
        setResult("playing");
        setMoves([]);
        setTakebackUsed(false);
        setDrawOffered(false);
        setWhiteTime(600);
        setBlackTime(600);
        setCurrentFen(startFen);
        setLastMove(null);

        try {
            const setup = parseFen(startFen);
            if (setup.isOk) {
                const game = Chess.fromSetup(setup.value);
                if (game.isOk) {
                    gameRef.current = game.value;
                    moveHistoryRef.current = [game.value.clone()];
                }
            }
        } catch {}
    };

    const handleResign = () => {
        if (result !== "playing") return;
        setResult(playerColor === "white" ? "white_resigned" : "black_resigned");
        stopBot();
    };

    const handleOfferDraw = () => {
        if (result !== "playing" || drawOffered) return;
        setDrawOffered(true);
        const botAccepts = Math.random() < 0.3;
        if (botAccepts) {
            setResult("draw");
            stopBot();
        }
    };

    const handleTakeback = () => {
        if (result !== "playing" || takebackUsed || moves.length < 2) return;
        
        moveHistoryRef.current.pop();
        moveHistoryRef.current.pop();
        
        const prevGame = moveHistoryRef.current[moveHistoryRef.current.length - 1];
        if (prevGame) {
            gameRef.current = prevGame.clone();
            const newFen = makeFen(prevGame.toSetup());
            setCurrentFen(newFen);
            setMoves(prev => prev.slice(0, -2));
            setLastMove(null);
            setTakebackUsed(true);
        }
    };

    const handleNewGame = () => {
        setGameStarted(false);
        stopBot();
    };

    if (!gameStarted) {
        return (
            <div className="h-full flex flex-col bg-background">
                <div className="h-14 border-b border-white/10 flex items-center px-4 sm:px-6 bg-surface">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-creme-muted hover:text-creme">
                        <ChevronLeft size={18} />
                    </button>
                    <span className="ml-3 font-semibold text-creme">Play vs Bot - Position #{positionId}</span>
                </div>

                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-surface rounded-xl border border-white/10 p-6 space-y-6">
                        <div className="text-center">
                            <Bot className="w-12 h-12 mx-auto text-accent mb-3" />
                            <h2 className="text-xl font-bold text-creme mb-1">Play Against Bot</h2>
                            <p className="text-sm text-creme-muted">Position #{positionId}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-creme-muted uppercase tracking-wider mb-2">Difficulty</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(["easy", "medium", "hard"] as BotDifficulty[]).map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDifficulty(d)}
                                            className={`py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                                                difficulty === d
                                                    ? 'bg-accent text-background'
                                                    : 'bg-background border border-white/10 text-creme-muted hover:text-creme'
                                            }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-creme-muted uppercase tracking-wider mb-2">Play As</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setPlayerColor("white")}
                                        className={`py-3 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                            playerColor === "white"
                                                ? 'bg-white text-black'
                                                : 'bg-background border border-white/10 text-creme-muted hover:text-creme'
                                        }`}
                                    >
                                        <div className="w-4 h-4 rounded-full bg-white border border-gray-300" />
                                        White
                                    </button>
                                    <button
                                        onClick={() => setPlayerColor("black")}
                                        className={`py-3 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                            playerColor === "black"
                                                ? 'bg-zinc-800 text-white border border-white/20'
                                                : 'bg-background border border-white/10 text-creme-muted hover:text-creme'
                                        }`}
                                    >
                                        <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600" />
                                        Black
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <div className="flex items-center gap-2 text-sm text-creme-muted mb-3">
                                    <Clock size={14} />
                                    <span>10 minutes per side</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleStartGame}
                            disabled={!botReady}
                            className="w-full py-3 rounded-lg bg-accent text-background font-bold text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                        >
                            {botReady ? 'Start Game' : 'Loading Bot...'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const resultText = getResultText(result, playerColor);

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 sm:px-6 bg-surface">
                <div className="flex items-center">
                    <button onClick={handleNewGame} className="p-2 hover:bg-white/10 rounded-full transition-colors text-creme-muted hover:text-creme">
                        <ChevronLeft size={18} />
                    </button>
                    <span className="ml-3 font-semibold text-creme">Position #{positionId}</span>
                    <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium capitalize bg-white/10 text-creme-muted">
                        {difficulty}
                    </span>
                </div>
                {result !== "playing" && (
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                        resultText.includes("Win") ? 'bg-emerald-500/20 text-emerald-400' :
                        resultText.includes("Bot") ? 'bg-rose-500/20 text-rose-400' :
                        'bg-white/10 text-creme-muted'
                    }`}>
                        {resultText}
                    </span>
                )}
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 bg-black/20">
                    {/* Bot info bar */}
                    <div className={`w-full max-w-[320px] sm:max-w-[400px] mb-2 flex items-center justify-between px-3 py-2 rounded-lg ${
                        currentTurn !== playerColor ? 'bg-accent/20 border border-accent/30' : 'bg-surface border border-white/10'
                    }`}>
                        <div className="flex items-center gap-2">
                            <Bot size={16} className="text-creme-muted" />
                            <span className="text-sm font-medium text-creme">Bot</span>
                            {isThinking && result === "playing" && (
                                <span className="text-xs text-accent ml-2">thinking...</span>
                            )}
                        </div>
                        <div className={`font-mono text-sm font-bold ${
                            (playerColor === "white" ? blackTime : whiteTime) < 60 ? 'text-rose-400' : 'text-creme'
                        }`}>
                            {formatTime(playerColor === "white" ? blackTime : whiteTime)}
                        </div>
                    </div>

                    {/* Chess board */}
                    <div className="w-full max-w-[320px] sm:max-w-[400px] lg:max-w-[500px] aspect-square">
                        <ChessBoard
                            fen={currentFen}
                            onPieceDrop={handleDrop}
                            arePiecesDraggable={isPlayerTurn && result === "playing"}
                            orientation={playerColor}
                            lastMove={lastMove}
                        />
                    </div>

                    {/* Player info bar */}
                    <div className={`w-full max-w-[320px] sm:max-w-[400px] mt-2 flex items-center justify-between px-3 py-2 rounded-lg ${
                        currentTurn === playerColor ? 'bg-accent/20 border border-accent/30' : 'bg-surface border border-white/10'
                    }`}>
                        <div className="flex items-center gap-2">
                            <User size={16} className="text-creme-muted" />
                            <span className="text-sm font-medium text-creme">You</span>
                        </div>
                        <div className={`font-mono text-sm font-bold ${
                            (playerColor === "white" ? whiteTime : blackTime) < 60 ? 'text-rose-400' : 'text-creme'
                        }`}>
                            {formatTime(playerColor === "white" ? whiteTime : blackTime)}
                        </div>
                    </div>
                    
                    {/* Mobile controls */}
                    <div className="lg:hidden w-full max-w-[320px] sm:max-w-[400px] mt-4">
                        {result === "playing" ? (
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={handleResign}
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
                                >
                                    <Flag size={14} />
                                    <span className="text-xs">Resign</span>
                                </button>
                                <button
                                    onClick={handleOfferDraw}
                                    disabled={drawOffered}
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 text-creme-muted hover:text-creme transition-colors disabled:opacity-50"
                                >
                                    <Handshake size={14} />
                                    <span className="text-xs">{drawOffered ? 'Declined' : 'Draw'}</span>
                                </button>
                                <button
                                    onClick={handleTakeback}
                                    disabled={takebackUsed || moves.length < 2}
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 text-creme-muted hover:text-creme transition-colors disabled:opacity-50"
                                >
                                    <RotateCcw size={14} />
                                    <span className="text-xs">{takebackUsed ? 'Used' : 'Undo'}</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleNewGame}
                                className="w-full py-3 rounded-lg bg-accent text-background font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
                            >
                                New Game
                            </button>
                        )}
                    </div>
                </div>

                {/* Sidebar - hidden on mobile */}
                <div className="hidden lg:flex w-72 lg:w-80 flex-shrink-0 flex-col border-l border-white/10 bg-surface">

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <div className="text-xs text-creme-muted uppercase tracking-wider mb-3">Moves</div>
                        {moves.length > 0 ? (
                            <div className="space-y-1">
                                {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
                                    const whiteMove = moves[i * 2];
                                    const blackMove = moves[i * 2 + 1];
                                    return (
                                        <div key={i} className="flex items-center text-sm font-mono">
                                            <span className="w-8 text-creme-muted/50">{i + 1}.</span>
                                            <span className="w-16 text-creme">{whiteMove?.san || ''}</span>
                                            <span className="w-16 text-creme-muted">{blackMove?.san || ''}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-creme-muted/50 text-center py-8">
                                {currentTurn === playerColor ? "Your turn - make a move" : "Waiting for bot..."}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-white/10 space-y-2">
                        {result === "playing" ? (
                            <>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={handleResign}
                                        className="flex flex-col items-center gap-1 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
                                    >
                                        <Flag size={16} />
                                        <span className="text-[10px] uppercase">Resign</span>
                                    </button>
                                    <button
                                        onClick={handleOfferDraw}
                                        disabled={drawOffered}
                                        className="flex flex-col items-center gap-1 py-2 rounded-lg bg-white/5 border border-white/10 text-creme-muted hover:text-creme hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Handshake size={16} />
                                        <span className="text-[10px] uppercase">{drawOffered ? 'Declined' : 'Draw'}</span>
                                    </button>
                                    <button
                                        onClick={handleTakeback}
                                        disabled={takebackUsed || moves.length < 2}
                                        className="flex flex-col items-center gap-1 py-2 rounded-lg bg-white/5 border border-white/10 text-creme-muted hover:text-creme hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RotateCcw size={16} />
                                        <span className="text-[10px] uppercase">{takebackUsed ? 'Used' : 'Takeback'}</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button
                                onClick={handleNewGame}
                                className="w-full py-3 rounded-lg bg-accent text-background font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
                            >
                                New Game
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
