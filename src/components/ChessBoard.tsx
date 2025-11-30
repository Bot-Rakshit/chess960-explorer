"use client";

import { useState, useMemo } from "react";
import { Chessboard } from "react-chessboard";
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
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: Square; to: Square } | null>(null);

  const customPieces = useMemo(() => {
    const pieces: Record<string, ({ squareWidth }: { squareWidth: number }) => JSX.Element> = {};
    const pieceTypes: Piece[] = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
    
    pieceTypes.forEach((piece) => {
      const color = piece[0].toLowerCase();
      const type = piece[1].toLowerCase();
      pieces[piece] = ({ squareWidth }) => (
        <img
          src={`/pieces/${pieceSet}/${color}${type}.svg`}
          alt={piece}
          style={{ width: squareWidth, height: squareWidth }}
        />
      );
    });
    
    return pieces;
  }, [pieceSet]);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    
    // Last move highlight
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(180, 150, 90, 0.5)' };
      styles[lastMove.to] = { backgroundColor: 'rgba(180, 150, 90, 0.6)' };
    }
    
    // Key squares / custom highlights
    highlightSquares.forEach(sq => {
      styles[sq] = { 
        ...styles[sq],
        boxShadow: 'inset 0 0 0 3px rgba(240, 230, 210, 0.6)' 
      };
    });
    
    return styles;
  }, [lastMove, highlightSquares]);

  const handlePieceDrop = (sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
    // Check if this is a pawn promotion
    const isPawn = piece[1]?.toLowerCase() === 'p';
    const isPromotion = isPawn && (targetSquare[1] === '8' || targetSquare[1] === '1');
    
    if (isPromotion && onPieceDrop) {
      // Store the move and show promotion dialog
      setPendingMove({ from: sourceSquare, to: targetSquare });
      setPromotionSquare(targetSquare);
      return false; // Don't complete the move yet
    }
    
    return onPieceDrop ? onPieceDrop(sourceSquare, targetSquare, piece) : false;
  };

  const handlePromotionPieceSelect = (piece?: PromotionPieceOption, promoteFromSquare?: Square, promoteToSquare?: Square): boolean => {
    if (piece && pendingMove && onPieceDrop) {
      // Extract just the piece letter (e.g., 'wQ' -> 'q')
      const promotionPiece = piece[1]?.toLowerCase() || 'q';
      const result = onPieceDrop(pendingMove.from, pendingMove.to, `${piece[0]}P`);
      setPendingMove(null);
      setPromotionSquare(null);
      return result;
    }
    setPendingMove(null);
    setPromotionSquare(null);
    return false;
  };

  return (
    <div className="w-full h-full">
      <Chessboard
        id={id}
        position={fen}
        onPieceDrop={handlePieceDrop}
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
        onPromotionCheck={(sourceSquare, targetSquare, piece) => {
          const isPawn = piece[1]?.toLowerCase() === 'p';
          return isPawn && (targetSquare[1] === '8' || targetSquare[1] === '1');
        }}
      />
    </div>
  );
}
