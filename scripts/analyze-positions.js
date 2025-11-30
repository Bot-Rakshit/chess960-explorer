const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const POSITIONS_PATH = path.join(__dirname, '../public/data/chess960.json');
const OUTPUT_PATH = path.join(__dirname, '../public/data/chess960_evals.json');
const SEARCH_TIME_MS = 10000; // 10 seconds per position (reaches depth ~25-35)
const MULTI_PV = 3; // Top 3 lines

// Stockfish binary path
const STOCKFISH_PATH = process.env.STOCKFISH_PATH || '/opt/homebrew/bin/stockfish';

class StockfishEngine {
  constructor() {
    this.process = null;
    this.ready = false;
    this.resolveReady = null;
    this.currentResolve = null;
    this.lines = {};
    this.currentDepth = 0;
    this.onProgress = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.process = spawn(STOCKFISH_PATH);
      this.resolveReady = resolve;

      this.process.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          this.handleLine(line.trim());
        }
      });

      this.process.stderr.on('data', (data) => {
        console.error('Stockfish error:', data.toString());
      });

      this.process.on('error', (err) => {
        reject(new Error(`Failed to start Stockfish: ${err.message}\nMake sure Stockfish is installed and in PATH, or set STOCKFISH_PATH env variable.`));
      });

      this.send('uci');
    });
  }

  send(cmd) {
    if (this.process) {
      this.process.stdin.write(cmd + '\n');
    }
  }

  handleLine(line) {
    if (line === 'uciok') {
      this.send('setoption name UCI_Chess960 value true');
      this.send('setoption name Threads value 4');
      this.send(`setoption name MultiPV value ${MULTI_PV}`);
      this.send('isready');
    } else if (line === 'readyok') {
      if (this.resolveReady) {
        this.resolveReady();
        this.resolveReady = null;
      }
    } else if (line.startsWith('info depth') && line.includes(' pv ')) {
      this.parseInfoLine(line);
    } else if (line.startsWith('bestmove')) {
      if (this.currentResolve) {
        const result = Object.values(this.lines).sort((a, b) => b.depth - a.depth || (a.pvNum - b.pvNum));
        this.currentResolve({ lines: result.slice(0, MULTI_PV), depth: this.currentDepth });
        this.currentResolve = null;
      }
    }
  }

  parseInfoLine(line) {
    const depthMatch = line.match(/depth (\d+)/);
    const pvNumMatch = line.match(/multipv (\d+)/);
    const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
    const pvMatch = line.match(/ pv (.+)$/);
    const nodesMatch = line.match(/nodes (\d+)/);

    if (!depthMatch || !scoreMatch || !pvMatch) return;

    const depth = parseInt(depthMatch[1]);
    const pvNum = pvNumMatch ? parseInt(pvNumMatch[1]) : 1;
    const scoreType = scoreMatch[1];
    const scoreValue = parseInt(scoreMatch[2]);
    const pv = pvMatch[1];
    const nodes = nodesMatch ? parseInt(nodesMatch[1]) : 0;

    if (depth > this.currentDepth) {
      this.currentDepth = depth;
      if (this.onProgress) this.onProgress(depth);
    }

    const evalData = {
      moves: pv,
      depth,
      nodes,
      pvNum,
    };

    if (scoreType === 'mate') {
      evalData.mate = scoreValue;
      evalData.eval = scoreValue > 0 ? 9999 : -9999;
    } else {
      evalData.eval = scoreValue / 100;
    }

    // Store best result for each PV
    const key = `pv${pvNum}`;
    if (!this.lines[key] || this.lines[key].depth < depth) {
      this.lines[key] = evalData;
    }
  }

  analyze(fen, onProgress) {
    return new Promise((resolve) => {
      this.lines = {};
      this.currentDepth = 0;
      this.currentResolve = resolve;
      this.onProgress = onProgress;
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      this.send(`go movetime ${SEARCH_TIME_MS}`);
    });
  }

  quit() {
    if (this.process) {
      this.send('quit');
      this.process.kill();
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Chess960 Position Analyzer');
  console.log(`Time: ${SEARCH_TIME_MS/1000}s per position, MultiPV: ${MULTI_PV}`);
  console.log('='.repeat(60));

  // Load positions
  console.log('\nLoading positions...');
  const data = JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf-8'));
  const positions = data.positions;
  console.log(`Found ${positions.length} positions`);

  // Check for existing progress
  let results = {};
  let startIndex = 0;
  
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      results = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      startIndex = Object.keys(results).length;
      console.log(`Resuming from position ${startIndex}`);
    } catch (e) {
      console.log('Starting fresh...');
    }
  }

  // Start Stockfish
  console.log('\nStarting Stockfish...');
  const engine = new StockfishEngine();
  
  try {
    await engine.start();
    console.log('Stockfish ready!\n');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const startTime = Date.now();

  for (let i = startIndex; i < positions.length; i++) {
    const pos = positions[i];
    const fen = pos.fen;
    
    process.stdout.write(`\r[${i + 1}/${positions.length}] #${pos.id} depth: --`);
    
    const onProgress = (depth) => {
      process.stdout.write(`\r[${i + 1}/${positions.length}] #${pos.id} depth: ${depth} `);
    };
    
    const { lines, depth } = await engine.analyze(fen, onProgress);
    
    results[pos.id] = {
      fen,
      depth,
      pvs: lines.filter(Boolean).map(l => ({
        moves: l.moves,
        eval: l.eval,
        mate: l.mate,
      })),
      analyzedAt: new Date().toISOString(),
    };

    // Save progress every 5 positions
    if ((i + 1) % 5 === 0 || i === positions.length - 1) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    }

    // Show progress stats
    const elapsed = (Date.now() - startTime) / 1000;
    const positionsAnalyzed = i - startIndex + 1;
    const avgTime = elapsed / positionsAnalyzed;
    const remaining = (positions.length - i - 1) * avgTime;
    
    process.stdout.write(`\r[${i + 1}/${positions.length}] #${pos.id} done @ d${depth} | ${avgTime.toFixed(1)}s/pos | ETA: ${formatTime(remaining)}      \n`);
  }

  engine.quit();

  console.log('\n' + '='.repeat(60));
  console.log('Analysis complete!');
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log('='.repeat(60));
}

function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

main().catch(console.error);
