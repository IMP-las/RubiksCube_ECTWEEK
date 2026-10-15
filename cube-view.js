// Image order matches the files uploaded to App Inventor: face1.png ... face6.png
const FACES = [
  {
    image: "face1.png",
    color: "#009B48",
    normal: [0, 0, 1],
    css: "translateZ(calc(var(--s) / 2))",
    visible: (p) => p[2] === 1,
    tile: (p) => [p[0] + 1, p[1] + 1],
  },
  {
    image: "face2.png",
    color: "#0046AD",
    normal: [0, 0, -1],
    css: "rotateY(180deg) translateZ(calc(var(--s) / 2))",
    visible: (p) => p[2] === -1,
    tile: (p) => [1 - p[0], p[1] + 1],
  },
  {
    image: "face3.png",
    color: "#B71234",
    normal: [1, 0, 0],
    css: "rotateY(90deg) translateZ(calc(var(--s) / 2))",
    visible: (p) => p[0] === 1,
    tile: (p) => [1 - p[2], p[1] + 1],
  },
  {
    image: "face4.png",
    color: "#FF5800",
    normal: [-1, 0, 0],
    css: "rotateY(-90deg) translateZ(calc(var(--s) / 2))",
    visible: (p) => p[0] === -1,
    tile: (p) => [p[2] + 1, p[1] + 1],
  },
  {
    image: "face5.png",
    color: "#FFFFFF",
    normal: [0, -1, 0],
    css: "rotateX(90deg) translateZ(calc(var(--s) / 2))",
    visible: (p) => p[1] === -1,
    tile: (p) => [p[0] + 1, p[2] + 1],
  },
  {
    image: "face6.png",
    color: "#FFD500",
    normal: [0, 1, 0],
    css: "rotateX(-90deg) translateZ(calc(var(--s) / 2))",
    visible: (p) => p[1] === 1,
    tile: (p) => [p[0] + 1, 1 - p[2]],
  },
];

const MOVE_MS = 220;
const SCRAMBLE_MS = 100;
const SCRAMBLE_LENGTH = 20;
const TINT_ALPHA = "50"; // hex alpha, about 60%

const state = {
  cubies: [],
  elements: [],
  size: 90,
  view: START_VIEW,
  moves: 0,
  queue: [],
  busy: false,
  drag: null,
  inertia: null,
  epoch: 0,
  onIdle: null,
  onTurnStart: null,
  onMove: null,
};
const ui = {
  stage: document.getElementById("stage"),
  scene: document.getElementById("scene"),
  moveCount: document.getElementById("moveCount"),
};

function stickerLayers(face, cubie) {
  const [col, row] = face.tile(cubie.home);
  const tint = `${face.color}${TINT_ALPHA}`;
  return [
    {
      image: `linear-gradient(${tint}, ${tint})`,
      size: "100% 100%",
      position: "0 0",
    },
    {
      image: `url(${face.image})`,
      size: "300% 300%",
      position: `${col * 50}% ${row * 50}%`,
    },
  ];
}

function buildFace(face, faceIndex, cubie, cubieIndex) {
  const el = document.createElement("div");
  el.className = "face";
  el.style.transform = face.css;
  if (face.visible(cubie.home)) {
    const layers = stickerLayers(face, cubie);
    el.dataset.cubie = cubieIndex;
    el.dataset.face = faceIndex;
    el.style.backgroundImage = layers.map((l) => l.image).join(", ");
    el.style.backgroundSize = layers.map((l) => l.size).join(", ");
    el.style.backgroundPosition = layers.map((l) => l.position).join(", ");
  }
  return el;
}

function buildCubie(cubie, cubieIndex) {
  const el = document.createElement("div");
  el.className = "cubie";
  FACES.forEach((face, i) =>
    el.appendChild(buildFace(face, i, cubie, cubieIndex)),
  );
  ui.scene.appendChild(el);
  return el;
}

function baseTransform(cubie) {
  return toMatrix3d(
    cubie.rot,
    cubie.pos.map((v) => v * state.size),
  );
}

function renderCubies() {
  state.cubies.forEach((cubie, i) => {
    state.elements[i].style.transform = baseTransform(cubie);
  });
}

function renderView() {
  ui.scene.style.transform = toMatrix3d(state.view);
}

function renderHud() {
  ui.moveCount.textContent = state.moves;
}

function resize() {
  state.size = Math.floor(
    Math.min(ui.stage.clientWidth * 0.19, ui.stage.clientHeight * 0.18),
  );
  document.documentElement.style.setProperty("--s", `${state.size}px`);
  ui.stage.style.perspective = `${state.size * 10}px`;
  renderCubies();
}

function layerTargets(move) {
  const axisIndex = AXIS_NAMES.indexOf(move.axis);
  return state.cubies
    .map((c, i) => (isInLayer(c, move) && !spinsInPlace(c, axisIndex) ? i : -1))
    .filter((i) => i >= 0);
}

function setLayerAngle(targets, move, direction, degrees) {
  targets.forEach((i) => {
    state.elements[i].style.transform =
      `rotate${move.axis.toUpperCase()}(${move.turns * direction * degrees}deg) ${baseTransform(state.cubies[i])}`;
  });
}

function animateLayer(move, direction, fromDegrees, toDegrees, duration) {
  const targets = layerTargets(move);
  const start = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = t * t * (3 - 2 * t);
      setLayerAngle(
        targets,
        move,
        direction,
        fromDegrees + (toDegrees - fromDegrees) * eased,
      );
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function commitMove(move, direction, counted) {
  applyMove(state.cubies, move, direction);
  renderCubies();
  if (!counted) return;
  state.moves++;
  renderHud();
  const solved = isSolved(state.cubies);
  if (solved) {
    alignCenters(state.cubies);
    renderCubies();
  }
  if (state.onMove) state.onMove(solved);
}

async function runQueue() {
  if (state.busy) return;
  state.busy = true;
  while (state.queue.length) {
    const epoch = state.epoch;
    const { move, direction, duration, counted } = state.queue.shift();
    await animateLayer(move, direction, 0, 90, duration);
    if (epoch !== state.epoch) {
      renderCubies(); // the cube was reset mid-turn, drop the stale animation
      continue;
    }
    commitMove(move, direction, counted);
  }
  state.busy = false;
  notifyIdle();
}

function notifyIdle() {
  if (!state.onIdle) return;
  const done = state.onIdle;
  state.onIdle = null;
  done();
}

function enqueue(move, direction, duration = MOVE_MS, counted = true) {
  state.queue.push({ move, direction, duration, counted });
  runQueue();
}

// Outer layers only, so scrambling never moves the centers
function randomMove() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  return { axis: pick(AXIS_NAMES), layer: pick([-1, 1]), turns: 1 };
}

function scramble() {
  state.moves = 0;
  renderHud();
  let previous = null;
  for (let i = 0; i < SCRAMBLE_LENGTH; i++) {
    let move = randomMove();
    while (
      previous &&
      move.axis === previous.axis &&
      move.layer === previous.layer
    )
      move = randomMove();
    previous = move;
    enqueue(move, Math.random() < 0.5 ? 1 : -1, SCRAMBLE_MS, false);
  }
}

function reset() {
  state.epoch++;
  state.queue = [];
  state.onIdle = null;
  state.cubies = createCubies();
  state.moves = 0;
  renderHud();
  renderCubies();
}
