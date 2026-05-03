// ─── PIECE UNICODE MAP ───────────────────────────────────────────────────────
const GLYPHS = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};

const PIECE_VALUES = { P:1, N:3, B:3, R:5, Q:9, K:1000 };

// Piece-square tables (from white's perspective, row 0 = rank 8)
const PST = {
  P: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0]
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  R: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0]
  ],
  Q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20]
  ]
};

// ─── GAME STATE ──────────────────────────────────────────────────────────────
let board = [];
let turn = 'w';
let castling = {};
let enPassant = null;
let gameMode = '2player'; // '2player' | 'bot'
let botDifficulty = 'beginner';
let gameStatus = 'playing';
let moveNumber = 1;
let selectedSq = null;
let validMoves = [];
let lastMove = null;
let history = [];
let capturedByWhite = [];
let capturedByBlack = [];
let promotionCallback = null;
let botThinking = false;

function initBoard() {
  const back = ['R','N','B','Q','K','B','N','R'];
  board = Array.from({length:8}, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = 'b' + back[c];
    board[1][c] = 'bP';
    board[6][c] = 'wP';
    board[7][c] = 'w' + back[c];
  }
  turn = 'w';
  castling = { wK:true, wQ:true, bK:true, bQ:true };
  enPassant = null;
  gameStatus = 'playing';
  moveNumber = 1;
  selectedSq = null;
  validMoves = [];
  lastMove = null;
  history = [];
  capturedByWhite = [];
  capturedByBlack = [];
  botThinking = false;
}

// ─── MOVE GENERATION ─────────────────────────────────────────────────────────
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function color(piece) { return piece ? piece[0] : null; }
function type(piece)  { return piece ? piece[1] : null; }
function enemy(col)   { return col === 'w' ? 'b' : 'w'; }

function pseudoMoves(r, c, b, ep) {
  const p = b[r][c];
  if (!p) return [];
  const col = color(p), t = type(p);
  const moves = [];
  const add = (nr, nc) => { if (inBounds(nr, nc)) moves.push([nr, nc]); };
  const slide = (dr, dc) => {
    let nr = r+dr, nc = c+dc;
    while (inBounds(nr, nc)) {
      if (b[nr][nc]) {
        if (color(b[nr][nc]) !== col) moves.push([nr, nc]);
        break;
      }
      moves.push([nr, nc]);
      nr += dr; nc += dc;
    }
  };

  if (t === 'P') {
    const dir = col === 'w' ? -1 : 1;
    const startRow = col === 'w' ? 6 : 1;
    if (inBounds(r+dir, c) && !b[r+dir][c]) {
      moves.push([r+dir, c]);
      if (r === startRow && !b[r+2*dir][c]) moves.push([r+2*dir, c]);
    }
    for (const dc of [-1, 1]) {
      if (!inBounds(r+dir, c+dc)) continue;
      if (b[r+dir][c+dc] && color(b[r+dir][c+dc]) !== col) moves.push([r+dir, c+dc]);
      if (ep && ep.r === r+dir && ep.c === c+dc) moves.push([r+dir, c+dc]);
    }
  } else if (t === 'N') {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr=r+dr, nc=c+dc;
      if (inBounds(nr,nc) && color(b[nr][nc]) !== col) moves.push([nr,nc]);
    }
  } else if (t === 'B') {
    for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr,dc);
  } else if (t === 'R') {
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc);
  } else if (t === 'Q') {
    for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc);
  } else if (t === 'K') {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr=r+dr, nc=c+dc;
      if (inBounds(nr,nc) && color(b[nr][nc]) !== col) moves.push([nr,nc]);
    }
    // Castling (checked for check clearance in legalMoves)
    const rank = col === 'w' ? 7 : 0;
    if (r === rank && c === 4) {
      if (castling[col+'K'] && !b[rank][5] && !b[rank][6] && b[rank][7] === col+'R')
        moves.push([rank, 6]);
      if (castling[col+'Q'] && !b[rank][3] && !b[rank][2] && !b[rank][1] && b[rank][0] === col+'R')
        moves.push([rank, 2]);
    }
  }
  return moves;
}

function isAttacked(r, c, byColor, b, ep) {
  for (let sr = 0; sr < 8; sr++)
    for (let sc = 0; sc < 8; sc++)
      if (color(b[sr][sc]) === byColor)
        for (const [tr,tc] of pseudoMoves(sr, sc, b, ep))
          if (tr === r && tc === c) return true;
  return false;
}

function isInCheck(col, b, ep) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (b[r][c] === col+'K') return isAttacked(r, c, enemy(col), b, ep);
  return false;
}

function applyMove(b, from, to, epIn, castIn, promoType) {
  const nb = b.map(r => [...r]);
  const piece = nb[from[0]][from[1]];
  const col = color(piece), t = type(piece);
  const newCast = {...castIn};
  let newEp = null;

  // En passant capture
  if (t === 'P' && epIn && to[0] === epIn.r && to[1] === epIn.c) {
    const capRow = col === 'w' ? to[0]+1 : to[0]-1;
    nb[capRow][to[1]] = null;
  }
  // Castling rook move
  if (t === 'K') {
    newCast[col+'K'] = false; newCast[col+'Q'] = false;
    const rank = col === 'w' ? 7 : 0;
    if (from[1] === 4 && to[1] === 6) { nb[rank][5] = nb[rank][7]; nb[rank][7] = null; }
    if (from[1] === 4 && to[1] === 2) { nb[rank][3] = nb[rank][0]; nb[rank][0] = null; }
  }
  if (t === 'R') {
    if (from[0] === 7 && from[1] === 0) newCast.wQ = false;
    if (from[0] === 7 && from[1] === 7) newCast.wK = false;
    if (from[0] === 0 && from[1] === 0) newCast.bQ = false;
    if (from[0] === 0 && from[1] === 7) newCast.bK = false;
  }
  // Double pawn push → set en passant
  if (t === 'P' && Math.abs(to[0]-from[0]) === 2)
    newEp = { r: (from[0]+to[0])>>1, c: from[1] };

  nb[to[0]][to[1]] = piece;
  nb[from[0]][from[1]] = null;

  // Promotion
  if (t === 'P' && (to[0] === 0 || to[0] === 7))
    nb[to[0]][to[1]] = col + (promoType || 'Q');

  return { board: nb, castling: newCast, enPassant: newEp };
}

function legalMoves(r, c, b, ep, cast) {
  const piece = b[r][c];
  if (!piece) return [];
  const col = color(piece), t = type(piece);
  const result = [];
  for (const [tr, tc] of pseudoMoves(r, c, b, ep)) {
    // Castling legality: king not in check, squares not attacked
    if (t === 'K' && Math.abs(tc - c) === 2) {
      if (isInCheck(col, b, ep)) continue;
      const midC = tc === 6 ? 5 : 3;
      if (isAttacked(r, midC, enemy(col), b, ep)) continue;
      if (isAttacked(r, tc,   enemy(col), b, ep)) continue;
    }
    const { board: nb, castling: nc, enPassant: ne } = applyMove(b, [r,c], [tr,tc], ep, cast);
    if (!isInCheck(col, nb, ne)) result.push([tr, tc]);
  }
  return result;
}

function getAllLegalMoves(col, b, ep, cast) {
  b = b || board; ep = ep !== undefined ? ep : enPassant; cast = cast || castling;
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (color(b[r][c]) === col)
        for (const [tr,tc] of legalMoves(r, c, b, ep, cast))
          moves.push({ from:[r,c], to:[tr,tc] });
  return moves;
}

function hasAnyLegalMove(col, b, ep, cast) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (color(b[r][c]) === col && legalMoves(r,c,b,ep,cast).length > 0) return true;
  return false;
}

// ─── APPLY MOVE TO GAME STATE ─────────────────────────────────────────────────
function doMove(from, to, promoType) {
  const piece = board[from[0]][from[1]];
  const col = color(piece), t = type(piece);
  const captured = board[to[0]][to[1]];

  // En passant capture piece
  let epCap = null;
  if (t === 'P' && enPassant && to[0] === enPassant.r && to[1] === enPassant.c) {
    const capRow = col === 'w' ? to[0]+1 : to[0]-1;
    epCap = board[capRow][to[1]];
  }

  const result = applyMove(board, from, to, enPassant, castling, promoType);
  board = result.board;
  castling = result.castling;
  enPassant = result.enPassant;

  const actualCap = captured || epCap;
  if (actualCap) {
    if (col === 'w') capturedByWhite.push(actualCap);
    else capturedByBlack.push(actualCap);
  }

  lastMove = { from, to };
  turn = enemy(col);
  if (turn === 'w') moveNumber++;

  // Check status
  const inCheck = isInCheck(turn, board, enPassant);
  const hasMoves = hasAnyLegalMove(turn, board, enPassant, castling);
  if (!hasMoves) gameStatus = inCheck ? 'checkmate' : 'stalemate';
  else if (inCheck) gameStatus = 'check';
  else gameStatus = 'playing';
}

// ─── BOT AI ───────────────────────────────────────────────────────────────────
function evaluate(b) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const col = color(p), t = type(p);
      const val = PIECE_VALUES[t] * 100;
      const pstRow = col === 'w' ? r : 7 - r;
      const pst = (PST[t] ? PST[t][pstRow][c] : 0);
      score += col === 'w' ? (val + pst) : -(val + pst);
    }
  }
  return score;
}

function orderMoves(moves, b) {
  return moves.sort((a, b_) => {
    const cap_a = b[a.to[0]][a.to[1]] ? 1 : 0;
    const cap_b = b[b_.to[0]][b_.to[1]] ? 1 : 0;
    return cap_b - cap_a;
  });
}

function minimax(b, ep, cast, depth, alpha, beta, maximizing) {
  const col = maximizing ? 'w' : 'b';
  const inCheck = isInCheck(col, b, ep);
  const moves = getAllLegalMoves(col, b, ep, cast);

  if (moves.length === 0) {
    if (inCheck) return maximizing ? -90000 : 90000;
    return 0; // stalemate
  }
  if (depth === 0) return evaluate(b);

  const ordered = orderMoves(moves, b);

  if (maximizing) {
    let best = -Infinity;
    for (const m of ordered) {
      const r = applyMove(b, m.from, m.to, ep, cast);
      const score = minimax(r.board, r.enPassant, r.castling, depth-1, alpha, beta, false);
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of ordered) {
      const r = applyMove(b, m.from, m.to, ep, cast);
      const score = minimax(r.board, r.enPassant, r.castling, depth-1, alpha, beta, true);
      best = Math.min(best, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function getBotMove() {
  const moves = getAllLegalMoves(turn);
  if (!moves.length) return null;

  if (botDifficulty === 'beginner') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = botDifficulty === 'intermediate' ? 2 : 4;
  const maximizing = turn === 'w';
  let bestMove = null, bestScore = maximizing ? -Infinity : Infinity;

  for (const m of orderMoves(moves, board)) {
    const r = applyMove(board, m.from, m.to, enPassant, castling);
    const score = minimax(r.board, r.enPassant, r.castling, depth-1, -Infinity, Infinity, !maximizing);
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return bestMove || moves[0];
}

// ─── UI ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function buildBoard() {
  const boardEl = $('board');
  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'sq ' + ((r+c)%2 === 0 ? 'light' : 'dark');
      sq.dataset.r = r; sq.dataset.c = c;
      sq.addEventListener('click', onSquareClick);
      boardEl.appendChild(sq);
    }
  }

  // Rank labels (8 → 1)
  const rl = $('rank-labels'); rl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    const span = document.createElement('span');
    span.textContent = 8 - r;
    rl.appendChild(span);
  }
  // File labels (a → h)
  const fl = $('file-labels'); fl.innerHTML = '';
  const spacer = document.createElement('span');
  spacer.className = 'file-label-spacer';
  fl.appendChild(spacer);
  for (let c = 0; c < 8; c++) {
    const span = document.createElement('span');
    span.textContent = String.fromCharCode(97+c);
    fl.appendChild(span);
  }
}

function renderBoard() {
  const squares = document.querySelectorAll('.sq');
  squares.forEach(sq => {
    const r = +sq.dataset.r, c = +sq.dataset.c;
    sq.className = 'sq ' + ((r+c)%2===0 ? 'light' : 'dark');
    sq.innerHTML = '';

    if (lastMove && ((lastMove.from[0]===r && lastMove.from[1]===c) ||
                     (lastMove.to[0]===r   && lastMove.to[1]===c)))
      sq.classList.add('last-move');

    if (selectedSq && selectedSq[0]===r && selectedSq[1]===c)
      sq.classList.add('selected');

    for (const [vr,vc] of validMoves) {
      if (vr===r && vc===c) {
        sq.classList.add(board[r][c] ? 'valid-capture' : 'valid-move');
      }
    }

    const piece = board[r][c];
    if (piece) {
      const span = document.createElement('span');
      span.className = 'piece ' + (color(piece)==='w' ? 'white' : 'black');
      span.textContent = GLYPHS[piece];
      sq.appendChild(span);
    }
  });

  updateSidebar();
}

function updateSidebar() {
  const ti = $('turn-indicator');
  if (gameMode === 'bot' && turn === 'b' && botThinking) {
    ti.textContent = 'BOT THINKING...';
    ti.className = 'turn-indicator thinking';
  } else if (gameStatus === 'check') {
    ti.textContent = (turn === 'w' ? 'WHITE' : 'BLACK') + ' IN CHECK!';
    ti.className = 'turn-indicator in-check';
  } else {
    ti.textContent = (turn === 'w' ? 'WHITE' : 'BLACK') + "'S TURN";
    ti.className = 'turn-indicator' + (turn === 'b' ? ' black-turn' : '');
  }

  $('display-move').textContent = moveNumber;

  const statusMap = { playing:'PLAYING', check:'CHECK!', checkmate:'CHECKMATE', stalemate:'STALEMATE' };
  $('display-status').textContent = statusMap[gameStatus] || gameStatus.toUpperCase();

  // Captured pieces
  $('captured-white').textContent = capturedByWhite.map(p => GLYPHS[p]).join('');
  $('captured-black').textContent = capturedByBlack.map(p => GLYPHS[p]).join('');
}

// ─── INPUT HANDLING ───────────────────────────────────────────────────────────
function onSquareClick(e) {
  if (gameStatus === 'checkmate' || gameStatus === 'stalemate') return;
  if (botThinking) return;
  if (gameMode === 'bot' && turn === 'b') return;

  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;

  if (selectedSq) {
    const isValid = validMoves.some(([vr,vc]) => vr===r && vc===c);
    if (isValid) {
      executeMove(selectedSq, [r,c]);
      return;
    }
  }

  // Select a piece of current player's color
  if (board[r][c] && color(board[r][c]) === turn) {
    selectedSq = [r, c];
    validMoves = legalMoves(r, c, board, enPassant, castling);
  } else {
    selectedSq = null;
    validMoves = [];
  }
  renderBoard();
}

function executeMove(from, to) {
  const p = board[from[0]][from[1]];
  const isPromo = type(p) === 'P' && (to[0] === 0 || to[0] === 7);

  selectedSq = null; validMoves = [];

  if (isPromo) {
    showPromotion(color(p), promoType => {
      doMove(from, to, promoType);
      renderBoard();
      checkGameOver();
      if (gameMode === 'bot' && gameStatus === 'playing') scheduleBotMove();
    });
  } else {
    doMove(from, to);
    renderBoard();
    checkGameOver();
    if (gameMode === 'bot' && gameStatus === 'playing') scheduleBotMove();
  }
}

function showPromotion(col, callback) {
  const modal = $('promotion-modal');
  const pieces = $('promo-pieces');
  pieces.innerHTML = '';
  promotionCallback = callback;
  for (const t of ['Q','R','B','N']) {
    const btn = document.createElement('div');
    btn.className = 'promo-piece ' + (col==='w' ? 'white' : 'black');
    btn.textContent = GLYPHS[col+t];
    btn.style.color = col==='w' ? 'var(--white-piece)' : 'var(--black-piece)';
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
      callback(t);
    });
    pieces.appendChild(btn);
  }
  modal.classList.remove('hidden');
}

function scheduleBotMove() {
  botThinking = true;
  updateSidebar();
  const delay = botDifficulty === 'advanced' ? 600 : 300;
  setTimeout(() => {
    const move = getBotMove();
    botThinking = false;
    if (move) {
      const p = board[move.from[0]][move.from[1]];
      const isPromo = type(p) === 'P' && (move.to[0] === 0 || move.to[0] === 7);
      doMove(move.from, move.to, isPromo ? 'Q' : undefined);
      renderBoard();
      checkGameOver();
    }
  }, delay);
}

function checkGameOver() {
  if (gameStatus === 'checkmate' || gameStatus === 'stalemate') showGameOver();
}

function showGameOver() {
  const overlay = $('gameover-overlay');
  const result = $('overlay-result');
  const winner = $('overlay-winner');
  if (gameStatus === 'checkmate') {
    result.textContent = 'CHECKMATE!';
    const w = enemy(turn);
    if (gameMode === 'bot' && w === 'b') winner.textContent = 'BOT WINS';
    else winner.textContent = (w === 'w' ? 'WHITE' : 'BLACK') + ' WINS';
  } else {
    result.textContent = 'STALEMATE!';
    winner.textContent = "IT'S A DRAW";
  }
  overlay.classList.remove('hidden');
}

// ─── SCREEN MANAGEMENT ───────────────────────────────────────────────────────
function startGame() {
  $('mode-screen').classList.add('hidden');
  $('game-screen').classList.remove('hidden');
  $('gameover-overlay').classList.add('hidden');
  $('display-mode').textContent = gameMode === '2player' ? '2P LOCAL' : 'VS BOT (' + botDifficulty.toUpperCase()[0] + ')';
  initBoard();
  buildBoard();
  renderBoard();
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
$('btn-2player').addEventListener('click', () => {
  gameMode = '2player';
  $('difficulty-select').classList.add('hidden');
  startGame();
});

$('btn-vs-bot').addEventListener('click', () => {
  $('difficulty-select').classList.remove('hidden');
});

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    botDifficulty = btn.dataset.diff;
    gameMode = 'bot';
    startGame();
  });
});

$('btn-resign').addEventListener('click', () => {
  if (gameStatus !== 'playing' && gameStatus !== 'check') return;
  const loser = turn;
  gameStatus = 'checkmate'; // reuse checkmate overlay
  const overlay = $('gameover-overlay');
  $('overlay-result').textContent = 'RESIGNATION';
  $('overlay-winner').textContent = (enemy(loser) === 'w' ? 'WHITE' : 'BLACK') + ' WINS';
  overlay.classList.remove('hidden');
});

$('btn-new-game').addEventListener('click', () => {
  $('gameover-overlay').classList.add('hidden');
  initBoard();
  buildBoard();
  renderBoard();
});

$('btn-play-again').addEventListener('click', () => {
  $('gameover-overlay').classList.add('hidden');
  initBoard();
  buildBoard();
  renderBoard();
});

$('btn-change-mode').addEventListener('click', () => {
  $('game-screen').classList.add('hidden');
  $('gameover-overlay').classList.add('hidden');
  $('mode-screen').classList.remove('hidden');
  $('difficulty-select').classList.add('hidden');
});

$('btn-menu').addEventListener('click', () => {
  $('game-screen').classList.add('hidden');
  $('gameover-overlay').classList.add('hidden');
  $('mode-screen').classList.remove('hidden');
  $('difficulty-select').classList.add('hidden');
});
