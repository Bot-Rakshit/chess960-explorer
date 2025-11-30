const fs = require('fs');
const path = require('path');

const POSITIONS_PATH = path.join(__dirname, '../public/data/chess960.json');
const EVALS_PATH = path.join(__dirname, '../public/data/chess960_evals.json');
const OUTPUT_PATH = path.join(__dirname, '../public/data/chess960.json');

console.log('Loading files...');
const positionsData = JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf-8'));
const evalsData = JSON.parse(fs.readFileSync(EVALS_PATH, 'utf-8'));

console.log(`Positions: ${positionsData.positions.length}`);
console.log(`Evals: ${Object.keys(evalsData).length}`);

let updated = 0;
for (const pos of positionsData.positions) {
  const evalData = evalsData[pos.id];
  if (evalData) {
    pos.eval = {
      fen: pos.fen,
      depth: evalData.depth,
      pvs: evalData.pvs,
    };
    updated++;
  }
}

console.log(`Updated ${updated} positions with new evals`);

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(positionsData, null, 2));
console.log(`Saved to ${OUTPUT_PATH}`);
