import { useState, useEffect, useCallback, useRef } from "react";
import { EngineLine } from "@/types";

export function useStockfish() {
    const workerRef = useRef<Worker | null>(null);
    const [lines, setLines] = useState<EngineLine[]>([]);
    const [depth, setDepth] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [multiPV, setMultiPVState] = useState(3);
    
    const currentFenRef = useRef<string>("");
    const isThinkingRef = useRef(false);
    const multiPVRef = useRef(3);

    useEffect(() => {
        try {
            const worker = new Worker('/stockfish/stockfish-17-lite-single.js');
            workerRef.current = worker;

            worker.onmessage = (e) => {
                const msg = e.data;
                if (msg === 'uciok') {
                    worker.postMessage('setoption name UCI_Chess960 value true');
                    worker.postMessage(`setoption name MultiPV value ${multiPVRef.current}`);
                    worker.postMessage('isready');
                }
                if (msg === 'readyok') setIsReady(true);

                if (typeof msg === 'string') {
                    if (msg.startsWith('info depth')) {
                        const depthMatch = msg.match(/info depth (\d+)/);
                        if (depthMatch) setDepth(parseInt(depthMatch[1]));

                        const match = msg.match(/info depth (\d+).*?multipv (\d+).*?score (cp|mate) (-?\d+).*?pv (.+)/);
                        if (match) {
                            const multipv = parseInt(match[2]);
                            const scoreType = match[3];
                            const scoreVal = parseInt(match[4]);
                            const pv = match[5].split(' ').filter(m => m.length >= 4);
                            
                            // Only accept lines within current multiPV setting
                            if (multipv > multiPVRef.current) return;

                            setLines(prev => {
                                const newLines = [...prev].slice(0, multiPVRef.current);
                                // Ensure array is large enough
                                while (newLines.length < multipv) newLines.push({ moves: "", eval: 0 });

                                newLines[multipv - 1] = {
                                    moves: pv.join(' '),
                                    eval: scoreType === 'cp' ? scoreVal / 100 : 0,
                                    mate: scoreType === 'mate' ? scoreVal : null,
                                };
                                return newLines;
                            });
                        }
                    }
                    if (msg.startsWith('bestmove')) {
                        setIsThinking(false);
                        isThinkingRef.current = false;
                    }
                }
            };

            worker.postMessage('uci');

            return () => { worker.terminate(); };
        } catch (err) {
            console.error('Stockfish init error:', err);
        }
    }, []);

    // Custom setMultiPV that also restarts analysis
    const setMultiPV = useCallback((value: number) => {
        multiPVRef.current = value;
        setMultiPVState(value);
        
        if (workerRef.current && isReady) {
            workerRef.current.postMessage('stop');
            workerRef.current.postMessage(`setoption name MultiPV value ${value}`);
            
            // Clear lines and restart if we have a position
            setLines([]);
            setDepth(0);
            
            if (currentFenRef.current) {
                setIsThinking(true);
                isThinkingRef.current = true;
                setTimeout(() => {
                    workerRef.current?.postMessage(`position fen ${currentFenRef.current}`);
                    workerRef.current?.postMessage('go depth 22');
                }, 100);
            }
        }
    }, [isReady]);

    const analyze = useCallback((fen: string) => {
        if (workerRef.current && isReady) {
            currentFenRef.current = fen;
            setLines([]);
            setDepth(0);
            setIsThinking(true);
            isThinkingRef.current = true;
            workerRef.current.postMessage('stop');
            setTimeout(() => {
                workerRef.current?.postMessage(`position fen ${fen}`);
                workerRef.current?.postMessage('go depth 22');
            }, 50);
        }
    }, [isReady]);

    const stop = useCallback(() => {
        workerRef.current?.postMessage('stop');
        setIsThinking(false);
        isThinkingRef.current = false;
    }, []);

    return {
        lines,
        depth,
        analyze,
        stop,
        isReady,
        isThinking,
        multiPV,
        setMultiPV
    };
}
