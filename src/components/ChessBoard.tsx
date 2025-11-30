"use client";

import { useState, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import type { Square, PromotionPieceOption } from "react-chessboard/dist/chessboard/types";

interface ChessBoardProps {
  fen: string;
  onPieceDrop?: (sourceSquare: string, targetSquare: string, piece: string) => boolean;
  arePiecesDraggable?: boolean;
  orientation?: "white" | "black";
  id?: string;
  lastMove?: { from: string; to: string } | null;
  highlightSquares?: string[];
}

export default function ChessBoard({
  fen,
  onPieceDrop,
  arePiecesDraggable = false,
  orientation = "white",
  id = "chess-board",
  lastMove = null,
  highlightSquares = []
}: ChessBoardProps) {
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: Square; to: Square } | null>(null);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    
    // Last move highlight
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(255, 255, 0, 0.3)' };
      styles[lastMove.to] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' };
    }
    
    // Key squares / custom highlights
    highlightSquares.forEach(sq => {
      styles[sq] = { 
        ...styles[sq],
        boxShadow: 'inset 0 0 0 3px rgba(16, 185, 129, 0.6)' 
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
        customDarkSquareStyle={{ backgroundColor: '#8B7355' }}
        customLightSquareStyle={{ backgroundColor: '#EAE0D5' }}
        customBoardStyle={{
          borderRadius: '4px',
        }}
        customSquareStyles={customSquareStyles}
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
