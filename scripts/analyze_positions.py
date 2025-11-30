#!/usr/bin/env python3
"""
Chess960 Position Analyzer
Analyzes all 960 positions using Stockfish in parallel.
"""

import json
import subprocess
import threading
import queue
import time
import os
from pathlib import Path
from datetime import datetime

# Configuration
STOCKFISH_PATH = "/opt/homebrew/bin/stockfish"
SEARCH_TIME_MS = 20000  # 20 seconds per position
THREADS_PER_ENGINE = 4  # Threads per Stockfish instance
NUM_WORKERS = 2  # Number of parallel Stockfish instances
MULTI_PV = 3  # Top 3 lines

SCRIPT_DIR = Path(__file__).parent
POSITIONS_PATH = SCRIPT_DIR / "../public/data/chess960.json"
OUTPUT_PATH = SCRIPT_DIR / "../public/data/chess960_evals.json"


class StockfishWorker:
    def __init__(self, worker_id):
        self.worker_id = worker_id
        self.process = None
        
    def start(self):
        self.process = subprocess.Popen(
            [STOCKFISH_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        self._send("uci")
        self._wait_for("uciok")
        self._send("setoption name UCI_Chess960 value true")
        self._send(f"setoption name Threads value {THREADS_PER_ENGINE}")
        self._send(f"setoption name MultiPV value {MULTI_PV}")
        self._send("isready")
        self._wait_for("readyok")
        
    def _send(self, cmd):
        self.process.stdin.write(cmd + "\n")
        self.process.stdin.flush()
        
    def _wait_for(self, target):
        while True:
            line = self.process.stdout.readline().strip()
            if line == target:
                return
                
    def analyze(self, fen):
        self._send("ucinewgame")
        self._send(f"position fen {fen}")
        self._send(f"go movetime {SEARCH_TIME_MS}")
        
        lines = {}
        final_depth = 0
        
        while True:
            line = self.process.stdout.readline().strip()
            
            if line.startswith("bestmove"):
                break
                
            if "info depth" in line and " pv " in line:
                parsed = self._parse_info(line)
                if parsed:
                    pv_num = parsed["pv_num"]
                    if pv_num not in lines or lines[pv_num]["depth"] < parsed["depth"]:
                        lines[pv_num] = parsed
                    if parsed["depth"] > final_depth:
                        final_depth = parsed["depth"]
        
        result = []
        for i in range(1, MULTI_PV + 1):
            if i in lines:
                l = lines[i]
                result.append({
                    "moves": l["moves"],
                    "eval": l["eval"],
                    "mate": l.get("mate"),
                })
        
        return {"pvs": result, "depth": final_depth}
    
    def _parse_info(self, line):
        try:
            depth = int(self._extract(line, "depth"))
            pv_num = int(self._extract(line, "multipv") or "1")
            
            score_type = None
            score_val = None
            if " score cp " in line:
                score_type = "cp"
                score_val = int(self._extract(line, "score cp"))
            elif " score mate " in line:
                score_type = "mate"
                score_val = int(self._extract(line, "score mate"))
            
            if not score_type:
                return None
                
            pv_start = line.find(" pv ") + 4
            moves = line[pv_start:].strip()
            
            result = {
                "depth": depth,
                "pv_num": pv_num,
                "moves": moves,
            }
            
            if score_type == "mate":
                result["mate"] = score_val
                result["eval"] = 9999 if score_val > 0 else -9999
            else:
                result["eval"] = score_val / 100
                
            return result
        except:
            return None
    
    def _extract(self, line, key):
        try:
            parts = line.split()
            idx = parts.index(key)
            return parts[idx + 1]
        except:
            return None
            
    def quit(self):
        if self.process:
            self._send("quit")
            self.process.wait()


def worker_thread(worker_id, task_queue, results, lock, progress):
    worker = StockfishWorker(worker_id)
    worker.start()
    
    while True:
        try:
            pos_id, fen = task_queue.get(timeout=1)
        except queue.Empty:
            break
            
        result = worker.analyze(fen)
        
        with lock:
            results[pos_id] = {
                "fen": fen,
                "depth": result["depth"],
                "pvs": result["pvs"],
                "analyzedAt": datetime.now().isoformat(),
            }
            progress["done"] += 1
            progress["last"] = f"#{pos_id} @ d{result['depth']}"
            
        task_queue.task_done()
    
    worker.quit()


def main():
    print("=" * 60)
    print("Chess960 Position Analyzer (Parallel)")
    print(f"Time: {SEARCH_TIME_MS/1000}s/pos | Workers: {NUM_WORKERS} | Threads: {THREADS_PER_ENGINE}/worker")
    print("=" * 60)
    
    # Load positions
    print("\nLoading positions...")
    with open(POSITIONS_PATH) as f:
        data = json.load(f)
    positions = data["positions"]
    print(f"Found {len(positions)} positions")
    
    # Load existing results
    results = {}
    if OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH) as f:
                results = json.load(f)
            print(f"Loaded {len(results)} existing results")
        except:
            pass
    
    # Create task queue
    task_queue = queue.Queue()
    for pos in positions:
        if str(pos["id"]) not in results and pos["id"] not in results:
            task_queue.put((pos["id"], pos["fen"]))
    
    remaining = task_queue.qsize()
    print(f"Positions to analyze: {remaining}")
    
    if remaining == 0:
        print("All positions already analyzed!")
        return
    
    # Progress tracking
    lock = threading.Lock()
    progress = {"done": 0, "last": ""}
    start_time = time.time()
    
    # Start workers
    print(f"\nStarting {NUM_WORKERS} workers...")
    threads = []
    for i in range(NUM_WORKERS):
        t = threading.Thread(target=worker_thread, args=(i, task_queue, results, lock, progress))
        t.start()
        threads.append(t)
    
    # Progress display
    try:
        while any(t.is_alive() for t in threads):
            time.sleep(1)
            with lock:
                done = progress["done"]
                last = progress["last"]
            
            elapsed = time.time() - start_time
            if done > 0:
                avg_time = elapsed / done
                eta = (remaining - done) * avg_time
                eta_str = f"{eta/3600:.1f}h" if eta > 3600 else f"{eta/60:.0f}m"
                print(f"\r[{done}/{remaining}] {last} | {avg_time:.1f}s/pos | ETA: {eta_str}    ", end="", flush=True)
            
            # Save periodically
            if done > 0 and done % 10 == 0:
                with lock:
                    with open(OUTPUT_PATH, "w") as f:
                        json.dump(results, f, indent=2)
    except KeyboardInterrupt:
        print("\n\nInterrupted! Saving progress...")
    
    # Wait for threads
    for t in threads:
        t.join(timeout=1)
    
    # Final save
    with open(OUTPUT_PATH, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n\n{'=' * 60}")
    print(f"Done! Analyzed {progress['done']} positions")
    print(f"Output: {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
