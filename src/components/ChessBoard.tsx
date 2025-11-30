"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { parseSquare, makeSquare } from "chessops/util";
import type { Square, PromotionPieceOption, Piece } from "react-chessboard/dist/chessboard/types";

type PieceSet = "alpha" | "chessiro" | "companion" | "merida" | "maestro" | "cases";

interface ChessBoardProps {
  fen: string;
  onPieceDrop?: (sourceSquare: string, targetSquare: string, piece: string) => boolean;
  arePiecesDraggable?: boolean;
  orientation?: "white" | "black";
  id?: string;
  lastMove?: { from: string; to: string } | null;
  highlightSquares?: string[];
  pieceSet?: PieceSet;
}

// Helper to create a Chess960 game from FEN
function createGame(fen: string): Chess | null {
  try {
    const setup = parseFen(fen);
    if (setup.isOk) {
      const game = Chess.fromSetup(setup.value);
      if (game.isOk) return game.value;
    }
  } catch {}
  return null;
}

// Get legal moves for a specific square
function getLegalMovesFrom(game: Chess, fromSq: number): number[] {
  const moves: number[] = [];
  const legalDests = game.allDests();
  const dests = legalDests.get(fromSq);
  if (dests) {
    for (const to of dests) {
      moves.push(to);
    }
  }
  return moves;
}

// Get piece at square
function getPieceAt(game: Chess, sq: number): { color: 'w' | 'b'; type: string } | null {
  const piece = game.board.get(sq);
  if (!piece) return null;
  return {
    color: piece.color === 'white' ? 'w' : 'b',
    type: piece.role[0] // 'pawn' -> 'p', 'knight' -> 'n', etc.
  };
}

export default function ChessBoard({
  fen,
  onPieceDrop,
  arePiecesDraggable = false,
  orientation = "white",
  id = "chess-board",
  lastMove = null,
  highlightSquares = [],
  pieceSet = "alpha"
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: Square; to: Square } | null>(null);

  const customPieces = useMemo(() => {
    const pieces: Record<string, ({ squareWidth }: { squareWidth: number }) => React.ReactElement> = {};
    const pieceTypes: Piece[] = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
    
    pieceTypes.forEach((piece) => {
      const color = piece[0].toLowerCase();
      const type = piece[1].toLowerCase();
      pieces[piece] = ({ squareWidth }: { squareWidth: number }) => (
        <img
          src={`/pieces/${pieceSet}/${color}${type}.svg`}
          alt={piece}
          style={{ width: squareWidth, height: squareWidth }}
        />
      );
    });
    
    return pieces;
  }, [pieceSet]);

  // Get legal moves for a square using chessops
  const getLegalMovesForSquare = useCallback((square: Square, currentFen: string): Square[] => {
    const game = createGame(currentFen);
    if (!game) return [];
    
    const sqNum = parseSquare(square);
    if (sqNum === undefined) return [];
    
    const moveNums = getLegalMovesFrom(game, sqNum);
    return moveNums.map(n => makeSquare(n) as Square);
  }, []);

  // Check if a move is a promotion
  const isPromotionMove = useCallback((from: Square, to: Square, currentFen: string): boolean => {
    const game = createGame(currentFen);
    if (!game) return false;
    
    const fromSq = parseSquare(from);
    if (fromSq === undefined) return false;
    
    const piece = getPieceAt(game, fromSq);
    if (!piece || piece.type !== 'p') return false;
    
    const toRank = to[1];
    return (piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1');
  }, []);

  // Check if there's a piece at square
  const hasPieceAt = useCallback((square: Square, currentFen: string): boolean => {
    const game = createGame(currentFen);
    if (!game) return false;
    
    const sqNum = parseSquare(square);
    if (sqNum === undefined) return false;
    
    return game.board.get(sqNum) !== undefined;
  }, []);

  // Handle square click for click-to-move
  const handleSquareClick = useCallback((square: Square) => {
    if (!arePiecesDraggable || !onPieceDrop) return;

    // If clicking on a legal move square, make the move
    if (selectedSquare && legalMoves.includes(square)) {
      // Check for promotion
      if (isPromotionMove(selectedSquare, square, fen)) {
        setPendingMove({ from: selectedSquare, to: square });
        setPromotionSquare(square);
        return;
      }
      
      // Get the piece for the callback
      const game = createGame(fen);
      if (game) {
        const fromSq = parseSquare(selectedSquare);
        if (fromSq !== undefined) {
          const piece = getPieceAt(game, fromSq);
          if (piece) {
            const pieceStr = `${piece.color}${piece.type.toUpperCase()}`;
            onPieceDrop(selectedSquare, square, pieceStr);
          }
        }
      }
      
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // If clicking on own piece, select it
    const game = createGame(fen);
    if (!game) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    const sqNum = parseSquare(square);
    if (sqNum === undefined) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    const piece = getPieceAt(game, sqNum);
    const turn = game.turn;
    const turnColor = turn === 'white' ? 'w' : 'b';
    
    if (piece && piece.color === turnColor) {
      setSelectedSquare(square);
      setLegalMoves(getLegalMovesForSquare(square, fen));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [selectedSquare, legalMoves, fen, arePiecesDraggable, onPieceDrop, getLegalMovesForSquare, isPromotionMove]);

  // Handle piece click (when clicking directly on a piece)
  const handlePieceClick = useCallback((piece: Piece, square: Square) => {
    handleSquareClick(square);
  }, [handleSquareClick]);

  // Handle drag begin - show legal moves
  const handlePieceDragBegin = useCallback((piece: Piece, sourceSquare: Square) => {
    if (!arePiecesDraggable) return;
    setSelectedSquare(sourceSquare);
    setLegalMoves(getLegalMovesForSquare(sourceSquare, fen));
  }, [arePiecesDraggable, fen, getLegalMovesForSquare]);

  // Handle drag end - clear highlights
  const handlePieceDragEnd = useCallback(() => {
    setTimeout(() => {
      setSelectedSquare(null);
      setLegalMoves([]);
    }, 100);
  }, []);

  // Handle piece drop (drag and drop)
  const handlePieceDrop = useCallback((sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
    if (isPromotionMove(sourceSquare, targetSquare, fen)) {
      setPendingMove({ from: sourceSquare, to: targetSquare });
      setPromotionSquare(targetSquare);
      return false;
    }
    
    const result = onPieceDrop ? onPieceDrop(sourceSquare, targetSquare, piece) : false;
    
    if (result) {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
    
    return result;
  }, [fen, onPieceDrop, isPromotionMove]);

  // Handle promotion piece selection
  const handlePromotionPieceSelect = useCallback((piece?: PromotionPieceOption): boolean => {
    if (piece && pendingMove && onPieceDrop) {
      const result = onPieceDrop(pendingMove.from, pendingMove.to, `${piece[0]}P`);
      setPendingMove(null);
      setPromotionSquare(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      return result;
    }
    setPendingMove(null);
    setPromotionSquare(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    return false;
  }, [pendingMove, onPieceDrop]);

  // Build custom square styles
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    
    // Last move highlight
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(180, 150, 90, 0.5)' };
      styles[lastMove.to] = { backgroundColor: 'rgba(180, 150, 90, 0.6)' };
    }
    
    // Selected square highlight
    if (selectedSquare) {
      styles[selectedSquare] = { 
        ...styles[selectedSquare],
        backgroundColor: 'rgba(255, 255, 0, 0.4)' 
      };
    }
    
    // Legal move highlights with dots
    legalMoves.forEach(sq => {
      const hasCapture = hasPieceAt(sq, fen);
      if (hasCapture) {
        // Capture square - ring highlight
        styles[sq] = { 
          ...styles[sq],
          background: 'radial-gradient(transparent 0%, transparent 79%, rgba(0,0,0,0.3) 80%)',
          borderRadius: '50%'
        };
      } else {
        // Empty square - dot
        styles[sq] = { 
          ...styles[sq],
          background: 'radial-gradient(rgba(0,0,0,0.25) 20%, transparent 20%)',
        };
      }
    });
    
    // Custom highlights
    highlightSquares.forEach(sq => {
      styles[sq] = { 
        ...styles[sq],
        boxShadow: 'inset 0 0 0 3px rgba(240, 230, 210, 0.6)' 
      };
    });
    
    return styles;
  }, [lastMove, selectedSquare, legalMoves, highlightSquares, fen, hasPieceAt]);

  return (
    <div className="w-full h-full">
      <Chessboard
        id={id}
        position={fen}
        onPieceDrop={handlePieceDrop}
        onSquareClick={handleSquareClick}
        onPieceClick={handlePieceClick}
        onPieceDragBegin={handlePieceDragBegin}
        onPieceDragEnd={handlePieceDragEnd}
        arePiecesDraggable={arePiecesDraggable}
        boardOrientation={orientation}
        customDarkSquareStyle={{ backgroundColor: '#5d7a99' }}
        customLightSquareStyle={{ backgroundColor: '#d4dde8' }}
        customBoardStyle={{
          borderRadius: '4px',
        }}
        customSquareStyles={customSquareStyles}
        customPieces={customPieces}
        animationDuration={150}
        showPromotionDialog={!!promotionSquare}
        promotionToSquare={promotionSquare}
        onPromotionPieceSelect={handlePromotionPieceSelect}
        onPromotionCheck={() => false}
      />
    </div>
  );
}
