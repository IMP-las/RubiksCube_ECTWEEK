const TIMER_TICK_MS = 100;

const PHASE_MESSAGES = {
  idle: "Tap Scramble to get a mixed cube",
  scrambling: "Scrambling…",
  ready: "Move any tile or layer to start the clock",
  running: "Go! Solve all six faces",
  won: "Solved!",
};

const game = {
  phase: "idle",
  startedAt: 0,
  finalMs: 0,
  bestMs: null,
  ticker: null,
};
const gameUi = {
  timer: document.getElementById("timer"),
  best: document.getElementById("bestTime"),
  status: document.getElementById("status"),
  win: document.getElementById("winScreen"),
  winBadge: document.getElementById("winBadge"),
  winTime: document.getElementById("winTime"),
  winMoves: document.getElementById("winMoves"),
  winBest: document.getElementById("winBest"),
  playAgain: document.getElementById("playAgainBtn"),
  closeWin: document.getElementById("closeWinBtn"),
};

function formatTime(ms, decimals = 1) {
  const ticksPerSecond = 10 ** decimals;
  const ticks = Math.floor(ms / (1000 / ticksPerSecond));
  const totalSeconds = Math.floor(ticks / ticksPerSecond);
  const fraction = String(ticks % ticksPerSecond).padStart(decimals, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${Math.floor(totalSeconds / 60)}:${seconds}.${fraction}`;
}

function elapsedMs() {
  if (game.phase === "running") return performance.now() - game.startedAt;
  return game.phase === "won" ? game.finalMs : 0;
}

function renderTimer() {
  gameUi.timer.textContent = formatTime(elapsedMs());
}

function renderBest() {
  gameUi.best.textContent =
    game.bestMs === null ? "--" : formatTime(game.bestMs);
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
  setPhase("running");
  game.ticker = setInterval(renderTimer, TIMER_TICK_MS);
}

function win() {
  stopTicker();
  game.finalMs = elapsedMs();
  const isNewBest = game.bestMs === null || game.finalMs < game.bestMs;
  if (isNewBest) {
    game.bestMs = game.finalMs;
    writeBestMs(game.bestMs);
  }
  setPhase("won");
  renderTimer();
  renderBest();
  playFeedback("win"); // after the best time is stored, so the app gets both in one message
  showWinScreen(isNewBest);
}

function startScramble() {
  if (game.phase === "scrambling") return;
  stopTicker();
  hideWinScreen();
  reset();
  setPhase("scrambling");
  renderTimer();
  state.onIdle = () => setPhase("ready");
  scramble();
}

function resetGame() {
  stopTicker();
  hideWinScreen();
  reset();
  setPhase("idle");
  renderTimer();
}


// The clock starts on the player's first turn after the scramble, not when the scramble ends
function onPlayerTurnStart() {
  if (game.phase === "ready") beginRun();
}

function onPlayerMove(solved) {
  if (solved && game.phase === "running") {
    win();
    return;
  }
  
  if (solved && game.phase === "idle")
    setStatus("Solved! Tap Scramble to race the clock");
}

function initGame() {
  game.bestMs = readBestMs();
  state.onTurnStart = onPlayerTurnStart;
  state.onMove = onPlayerMove;
  gameUi.playAgain.addEventListener("click", startScramble);
  gameUi.closeWin.addEventListener("click", hideWinScreen);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideWinScreen();
  });
  renderBest();
  renderTimer();
  setPhase("idle");
}
