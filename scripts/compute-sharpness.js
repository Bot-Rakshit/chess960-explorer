const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const POSITIONS_PATH = path.join(__dirname, '../public/data/chess960.json');
const OUTPUT_PATH = path.join(__dirname, '../public/data/chess960_sharpness.json');
const LC0_PATH = '/opt/homebrew/bin/lc0';
const NETWORK_PATH = path.join(__dirname, 'lc0-net/network.pb.gz');
const NODES = 5000; // nodes per position (~10s each)

/**
 * Sharpness formula:
 * sharpness = (2 / (log(1/W - 1) + log(1/L - 1)))^2
 * 
 * Where W = win probability, L = loss probability from WDL
 */
function computeSharpness(w, d, l) {
  // Normalize to probabilities (0-1)
  const total = w + d + l;
  const W = w / total;
  const L = l / total;
  
  // Avoid division by zero / log of zero
  const wClamped = Math.max(0.001, Math.min(0.999, W));
  const lClamped = Math.max(0.001, Math.min(0.999, L));
  
  const logitW = Math.log(1 / wClamped - 1);
  const logitL = Math.log(1 / lClamped - 1);
  
  const denom = logitW + logitL;
  
  // If denom is very small, position is very sharp
  if (Math.abs(denom) < 0.001) {
    return 100; // Cap at 100
  }
  
  const sharpness = Math.pow(2 / denom, 2);
  
  // Clamp to reasonable range
  return Math.min(100, Math.max(0, sharpness));
}

class Lc0Engine {
  constructor() {
    this.process = null;
    this.resolveReady = null;
    this.currentResolve = null;
    this.wdl = null;
    this.buffer = '';
  }

  start() {
    return new Promise((resolve, reject) => {
      this.process = spawn(LC0_PATH, [
        `--weights=${NETWORK_PATH}`,
      ]);
      
      this.resolveReady = resolve;

      const handleData = (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop();
        
        for (const line of lines) {
          this.handleLine(line.trim());
        }
      };

      this.process.stdout.on('data', handleData);
      this.process.stderr.on('data', handleData);

      this.process.on('error', (err) => {
        reject(new Error(`Failed to start lc0: ${err.message}`));
      });

      // Send UCI init - wait for metal backend to load
      setTimeout(() => this.send('uci'), 500);
    });
  }

  send(cmd) {
    if (this.process && this.process.stdin.writable) {
      this.process.stdin.write(cmd + '\n');
    }
  }

  handleLine(line) {
    if (line === 'uciok') {
      this.send('setoption name UCI_ShowWDL value true');
      this.send('isready');
    } else if (line === 'readyok') {
      if (this.resolveReady) {
        this.resolveReady();
        this.resolveReady = null;
      }
    } else if (line.includes(' wdl ')) {
      const wdlMatch = line.match(/wdl\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (wdlMatch) {
        this.wdl = {
          w: parseInt(wdlMatch[1]),
          d: parseInt(wdlMatch[2]),
          l: parseInt(wdlMatch[3]),
        };
      }
    } else if (line.startsWith('bestmove')) {
      if (this.currentResolve) {
        this.currentResolve(this.wdl);
        this.currentResolve = null;
      }
    }
  }

  analyze(fen) {
    return new Promise((resolve) => {
      this.wdl = null;
      this.currentResolve = resolve;
      this.send(`position fen ${fen}`);
      this.send(`go nodes ${NODES}`);
    });
  }

  quit() {
    if (this.process) {
      this.send('quit');
      setTimeout(() => this.process.kill(), 100);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Chess960 Sharpness Calculator (lc0 + WDL)');
  console.log(`Nodes: ${NODES} per position`);
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

  // Start lc0
  console.log('\nStarting lc0...');
  const engine = new Lc0Engine();
  
  try {
    await engine.start();
    console.log('lc0 ready!\n');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const startTime = Date.now();

  for (let i = startIndex; i < positions.length; i++) {
    const pos = positions[i];
    const fen = pos.fen;
    
    process.stdout.write(`\r[${i + 1}/${positions.length}] #${pos.id} analyzing...`);
    
    const wdl = await engine.analyze(fen);
    
    let sharpness = 0;
    if (wdl) {
      sharpness = computeSharpness(wdl.w, wdl.d, wdl.l);
    }
    
    results[pos.id] = {
      fen,
      wdl: wdl || { w: 0, d: 1000, l: 0 },
      sharpness: Math.round(sharpness * 100) / 100,
      analyzedAt: new Date().toISOString(),
    };

    // Save progress every 10 positions
    if ((i + 1) % 10 === 0 || i === positions.length - 1) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    }

    // Show progress stats
    const elapsed = (Date.now() - startTime) / 1000;
    const positionsAnalyzed = i - startIndex + 1;
    const avgTime = elapsed / positionsAnalyzed;
    const remaining = (positions.length - i - 1) * avgTime;
    
    const wdlStr = wdl ? `W:${wdl.w} D:${wdl.d} L:${wdl.l}` : 'N/A';
    process.stdout.write(`\r[${i + 1}/${positions.length}] #${pos.id} ${wdlStr} sharp:${sharpness.toFixed(2)} | ${avgTime.toFixed(1)}s/pos | ETA: ${formatTime(remaining)}      \n`);
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
