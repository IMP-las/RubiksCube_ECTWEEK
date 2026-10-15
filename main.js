function init() {
  state.cubies = createCubies();
  state.elements = state.cubies.map(buildCubie);
  enableInput();
  initFeedback();
  initGame();
  document
    .getElementById("scrambleBtn")
    .addEventListener("click", startScramble);
  document.getElementById("resetBtn").addEventListener("click", resetGame);
  window.addEventListener("resize", resize);
  renderView();
  resize();
}

init();
