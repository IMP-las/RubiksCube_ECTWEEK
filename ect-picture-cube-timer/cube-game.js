const TIMER_TICK_MS = 100;

const PHASE_MESSAGES = {
  idle: 'Tap Scramble to start the clock',
  scrambling: 'Scrambling…',
  running: 'Go! Solve all six faces',
  won: 'Solved!',
};

const game = { phase: 'idle', startedAt: 0, finalMs: 0, bestMs: null, ticker: null };
const gameUi = {
  timer: document.getElementById('timer'),
  best: document.getElementById('bestTime'),
  status: document.getElementById('status'),
  win: document.getElementById('winScreen'),
  winBadge: document.getElementById('winBadge'),
  winTime: document.getElementById('winTime'),
  winMoves: document.getElementById('winMoves'),
  winBest: document.getElementById('winBest'),
  playAgain: document.getElementById('playAgainBtn'),
  closeWin: document.getElementById('closeWinBtn'),
};

function formatTime(ms, decimals = 1) {
  const ticksPerSecond = 10 ** decimals;
  const ticks = Math.floor(ms / (1000 / ticksPerSecond));
  const totalSeconds = Math.floor(ticks / ticksPerSecond);
  const fraction = String(ticks % ticksPerSecond).padStart(decimals, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${Math.floor(totalSeconds / 60)}:${seconds}.${fraction}`;
}

function elapsedMs() {
  if (game.phase === 'running') return performance.now() - game.startedAt;
  return game.phase === 'won' ? game.finalMs : 0;
}

function renderTimer() {
  gameUi.timer.textContent = formatTime(elapsedMs());
}

function renderBest() {
  gameUi.best.textContent = game.bestMs === null ? '--' : formatTime(game.bestMs);
}

function setStatus(text) {
  gameUi.status.textContent = text;
}

function setPhase(phase) {
  game.phase = phase;
  setStatus(PHASE_MESSAGES[phase]);
}

function stopTicker() {
  clearInterval(game.ticker);
  game.ticker = null;
}

function showWinScreen(isNewBest) {
  gameUi.winBadge.hidden = !isNewBest;
  gameUi.winTime.textContent = formatTime(game.finalMs, 2);
  gameUi.winMoves.textContent = state.moves;
  gameUi.winBest.textContent = formatTime(game.bestMs, 2);
  gameUi.win.hidden = false;
  gameUi.playAgain.focus();
}

function hideWinScreen() {
  gameUi.win.hidden = true;
}

function beginRun() {
  game.startedAt = performance.now();
  setPhase('running');
  game.ticker = setInterval(renderTimer, TIMER_TICK_MS);
}

function win() {
  stopTicker();
  game.finalMs = performance.now() - game.startedAt;
  const isNewBest = game.bestMs === null || game.finalMs < game.bestMs;
  if (isNewBest) {
    game.bestMs = game.finalMs;
    writeBestMs(game.bestMs);
  }
  setPhase('won');
  renderTimer();
  renderBest();
  showWinScreen(isNewBest);
}

// The clock only starts once the player has tapped Scramble and the mixing has finished
function startScramble() {
  if (game.phase === 'scrambling') return;
  stopTicker();
  hideWinScreen();
  reset();
  setPhase('scrambling');
  renderTimer();
  state.onIdle = beginRun;
  scramble();
}

function resetGame() {
  stopTicker();
  hideWinScreen();
  reset();
  setPhase('idle');
  renderTimer();
}

function onPlayerMove(solved) {
  if (!solved) return;
  if (game.phase === 'running') win();
  else if (game.phase === 'idle') setStatus('Solved! Tap Scramble to race the clock');
}

function initGame() {
  game.bestMs = readBestMs();
  state.onMove = onPlayerMove;
  gameUi.playAgain.addEventListener('click', startScramble);
  gameUi.closeWin.addEventListener('click', hideWinScreen);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') hideWinScreen(); });
  renderBest();
  renderTimer();
  setPhase('idle');
}
