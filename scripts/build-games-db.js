const fs = require('fs');
const path = require('path');

const PGN_PATH = path.join(__dirname, '../public/data/chess960_all_games.pgn');
const OUTPUT_PATH = path.join(__dirname, '../public/data/games_db.json');

function parseGamesFromPgn(text) {
  const games = [];
  const gameTexts = text.split(/(?=\[Event\s+")/);

  for (const gameText of gameTexts) {
    if (!gameText.trim()) continue;

    const getHeader = (header) => {
      const match = gameText.match(new RegExp(`\\[${header}\\s+"([^"]+)"\\]`));
      return match ? match[1] : "";
    };

    const fen = getHeader("FEN");
    if (!fen) continue;

    // Extract just board position for indexing
    const boardPosition = fen.split(" ")[0];

    const whiteEloStr = getHeader("WhiteElo");
    const blackEloStr = getHeader("BlackElo");

    games.push({
      pgn: gameText,
      fen,
      board: boardPosition,
      white: getHeader("White"),
      black: getHeader("Black"),
      event: getHeader("Event"),
      date: getHeader("Date"),
      result: getHeader("Result"),
      whiteElo: whiteEloStr ? parseInt(whiteEloStr) : null,
      blackElo: blackEloStr ? parseInt(blackEloStr) : null,
    });
  }

  return games;
}

console.log('Reading PGN file...');
const pgnText = fs.readFileSync(PGN_PATH, 'utf-8');

console.log('Parsing games...');
const games = parseGamesFromPgn(pgnText);

console.log(`Parsed ${games.length} games`);

// Create index by board position for fast lookup
const gamesByBoard = {};
for (const game of games) {
  if (!gamesByBoard[game.board]) {
    gamesByBoard[game.board] = [];
  }
  gamesByBoard[game.board].push(game);
}

console.log(`Created index with ${Object.keys(gamesByBoard).length} unique positions`);

const output = {
  games,
  gamesByBoard,
};

console.log('Writing JSON...');
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));

const stats = fs.statSync(OUTPUT_PATH);
console.log(`Done! Output: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
