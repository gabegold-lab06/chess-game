# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

Open `index.html` directly in a browser — no build step, no server required. On Windows:

```
start index.html
```

After any change to `chess.js` or `style.css`, hard-refresh the browser (`Ctrl+Shift+R`) to pick up the change.

## Git workflow

The remote is `https://github.com/gabegold-lab06/chess-game`. After every meaningful change:

```
git add <files>
git commit -m "short imperative summary"
git push
```

Always commit before starting a new feature so there is a clean rollback point.

## Architecture

Everything runs in three files with no dependencies beyond a Google Fonts CDN import:

**`chess.js`** — all logic and DOM manipulation, structured in six sections separated by banner comments:
- **Piece maps / constants** — `GLYPHS` (Unicode symbols), `PIECE_VALUES`, `PST` (piece-square tables for positional evaluation)
- **Game state** — module-level `let` variables: `board` (8×8 array of strings like `'wP'`, `'bK'`, `null`), `turn`, `castling`, `enPassant`, `gameStatus`, `selectedSq`, `validMoves`, `lastMove`, `capturedByWhite/Black`, `botThinking`
- **Move generation** — pure functions that accept board/state as arguments and never touch global state: `pseudoMoves` → `legalMoves` → `getAllLegalMoves`. `applyMove` returns a new board copy and is used both by `doMove` (game state mutation) and the bot search (without mutating globals)
- **`doMove`** — the only function that mutates global game state; calls `applyMove` then updates `turn`, captured pieces, and `gameStatus`
- **Bot AI** — `getBotMove` dispatches by `botDifficulty`: random for beginner, minimax depth 2 for intermediate, minimax + alpha-beta depth 4 for advanced. `evaluate` sums material × 100 + PST bonus; white is maximizing, black is minimizing
- **UI** — `buildBoard` creates DOM once per game, `renderBoard` re-paints all 64 squares on every move. Screen transitions toggle `.hidden` on `#mode-screen` / `#game-screen`

**`index.html`** — static shell only; no inline scripts. Three logical layers stacked with `z-index`: game screen (z default) → promotion modal (z 100) → game-over overlay (z 200).

**`style.css`** — design tokens in `:root` CSS variables. All colors, neon glows, and the CRT scanline effect (`body::after`) live here. Square size is responsive via `clamp(44px, 7vw, 72px)`.

## Key conventions

- Piece strings are two characters: color prefix (`w`/`b`) + type (`P R N B Q K`). `color(piece)` and `type(piece)` are the accessors used everywhere.
- Board coordinates are `[row, col]` where `[0][0]` is a8 (top-left, black's back rank) and `[7][7]` is h1.
- `pseudoMoves` is cheap and ignores check; `legalMoves` wraps it and filters moves that leave the king in check by calling `applyMove` + `isInCheck` on a scratch board copy.
- The bot always plays as black (`turn === 'b'`). `minimax` treats white as maximizing and black as minimizing regardless of which side the human chose.
- `scheduleBotMove` uses `setTimeout` to yield to the browser before the search runs, keeping the UI responsive.
