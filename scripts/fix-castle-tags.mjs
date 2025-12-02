import { readFileSync, writeFileSync } from 'fs';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';

const dataPath = './public/data/chess960.json';
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

let fixedCount = 0;
let correctCount = 0;

for (const position of data.positions) {
    const hasCastleTag = position.tags?.includes('Can Castle Move 1');
    
    if (!hasCastleTag) continue;
    
    // Parse the FEN and check if castling is actually legal
    const setup = parseFen(position.fen);
    if (!setup.isOk) {
        console.log(`Position #${position.id}: Failed to parse FEN`);
        continue;
    }
    
    const game = Chess.fromSetup(setup.value);
    if (!game.isOk) {
        console.log(`Position #${position.id}: Failed to create game`);
        continue;
    }
    
    const chess = game.value;
    
    // Get all legal moves and check if any is a castling move
    // In chessops, castling moves have the king moving to the rook's square
    const kingSquare = chess.board.kingOf('white');
    if (kingSquare === undefined) continue;
    
    const legalDests = chess.allDests();
    const kingMoves = legalDests.get(kingSquare);
    
    let canCastleMove1 = false;
    
    if (kingMoves) {
        for (const dest of kingMoves) {
            // Check if this destination has a rook (castling in Chess960)
            const piece = chess.board.get(dest);
            if (piece && piece.role === 'rook' && piece.color === 'white') {
                canCastleMove1 = true;
                break;
            }
        }
    }
    
    if (!canCastleMove1) {
        // Remove the incorrect tag
        position.tags = position.tags.filter(t => t !== 'Can Castle Move 1');
        console.log(`Position #${position.id}: Removed incorrect "Can Castle Move 1" tag`);
        fixedCount++;
    } else {
        correctCount++;
    }
}

// Save the fixed data
writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log(`\nDone!`);
console.log(`- Positions with correct "Can Castle Move 1" tag: ${correctCount}`);
console.log(`- Positions with tag removed (was incorrect): ${fixedCount}`);
