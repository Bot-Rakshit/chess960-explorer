# Freestyle Chess Explorer

A modern Chess960 (Fischer Random) position explorer with Stockfish analysis, strategic plans, and GM tournament data.

## Features

- **All 960 Positions** - Browse and explore every possible Chess960 starting position
- **Stockfish 17 Analysis** - Real-time engine evaluation with multi-PV support
- **Strategic Plans** - AI-generated opening plans and key square analysis for each position
- **GM Game Database** - Tournament games from Freestyle Chess events featuring top players
- **Interactive Board** - Make moves, analyze variations with last-move highlighting
- **Position Tags** - Filter positions by characteristics (fianchetto, central knights, etc.)
- **Mobile Responsive** - Full functionality on all device sizes

## Tech Stack

- **Next.js 16** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **react-chessboard** for the chess board UI
- **chessops** for chess logic and move validation
- **Stockfish WASM** for browser-based engine analysis

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Landing page
│   ├── explore/page.tsx  # Main explorer interface
│   ├── about/page.tsx    # About page
│   ├── layout.tsx        # Root layout with metadata
│   └── globals.css       # Global styles
├── components/
│   ├── ChessBoard.tsx    # Interactive chess board
│   ├── AnalysisPanel.tsx # Engine analysis display
│   ├── GameViewer.tsx    # GM game replay viewer
│   ├── PositionList.tsx  # Position browser sidebar
│   ├── StatsPanel.tsx    # Position statistics
│   └── HeroInteractive.tsx # Landing page animation
├── hooks/
│   └── useStockfish.ts   # Stockfish engine hook
└── types/
    └── index.ts          # TypeScript interfaces
```

## Data

- `public/data/chess960.json` - All 960 positions with evaluations, plans, and tags
- `public/data/chess960_database.pgn` - GM tournament games
- `public/data/chess960_freestyle_database.pgn` - Freestyle Chess event games

## License

MIT

## Credits

Developed by [Chessiro](https://chessiro.com)
