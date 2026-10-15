const LIVE_START_PIXELS = 6;
const TURN_SPEED_BOOST = 1.5;
const SNAP_THRESHOLD_DEGREES = 30;
const FLICK_SPEED = 0.6; // px per ms
const FLICK_MIN_DEGREES = 8;
const SNAP_MS = 170;
const INERTIA_FRICTION = 0.003; // per ms
const INERTIA_STOP_SPEED = 0.02; // px per ms
const INERTIA_RELEASE_MS = 60;

// Pick the cube axis the pointer followed on the touched sticker, then the layer that slides with it
function swipeToMove(cubieIndex, faceIndex, dx, dy) {
  const cubie = state.cubies[cubieIndex];
  const normal = transform(cubie.rot, FACES[faceIndex].normal);
  const normalAxis = normal.findIndex((v) => v !== 0);

  let best = null;
  [0, 1, 2]
    .filter((i) => i !== normalAxis)
    .forEach((i) => {
      const tangent = [0, 0, 0];
      tangent[i] = 1;
      const [sx, sy] = screenVector(state.view, tangent);
      const score = dx * sx + dy * sy;
      if (!best || Math.abs(score) > Math.abs(best.score))
        best = { tangent, score };
    });
  const tangent = best.score < 0 ? best.tangent.map((v) => -v) : best.tangent;

  const spin = cross(normal, tangent);
  const axisIndex = spin.findIndex((v) => v !== 0);
  const [sx, sy] = screenVector(state.view, tangent);
  const length = Math.hypot(sx, sy);
  return {
    move: {
      axis: AXIS_NAMES[axisIndex],
      layer: cubie.pos[axisIndex],
      turns: 1,
    },
    direction: spin[axisIndex],
    screenDirection: length > 1e-6 ? [sx / length, sy / length] : [1, 0],
    // keeps the touched tile under the pointer: arc length = radius * angle, radius about 1.5 cubies
    degreesPerPixel:
      (TURN_SPEED_BOOST * (180 / Math.PI)) /
      (1.5 * state.size * Math.max(length, 0.35)),
  };
}

function stopInertia() {
  if (state.inertia) cancelAnimationFrame(state.inertia);
  state.inertia = null;
}

function startInertia(vx, vy) {
  let last = performance.now();
  function frame(now) {
    const dt = now - last;
    last = now;
    state.view = dragView(state.view, vx * dt, vy * dt);
    renderView();
    const decay = Math.exp(-INERTIA_FRICTION * dt);
    vx *= decay;
    vy *= decay;
    state.inertia =
      Math.hypot(vx, vy) > INERTIA_STOP_SPEED
        ? requestAnimationFrame(frame)
        : null;
  }
  state.inertia = requestAnimationFrame(frame);
}

function startDrag(e) {
  if (state.drag) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  stopInertia();

  const face = e.target.closest(".face");
  const sticker = face && face.dataset.cubie !== undefined ? face : null;
  let mode = "view";
  if (sticker) mode = state.busy ? "ignore" : "turn";

  ui.stage.setPointerCapture(e.pointerId);
  ui.stage.classList.add("is-dragging");
  state.drag = {
    mode,
    pointerId: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    time: e.timeStamp,
    vx: 0,
    vy: 0,
    startX: e.clientX,
    startY: e.clientY,
    cubie: sticker ? Number(sticker.dataset.cubie) : null,
    face: sticker ? Number(sticker.dataset.face) : null,
    live: null,
  };
}

function trackVelocity(drag, e) {
  const dt = Math.max(1, e.timeStamp - drag.time);
  drag.vx = 0.7 * drag.vx + 0.3 * ((e.clientX - drag.x) / dt);
  drag.vy = 0.7 * drag.vy + 0.3 * ((e.clientY - drag.y) / dt);
  drag.x = e.clientX;
  drag.y = e.clientY;
  drag.time = e.timeStamp;
}

function beginLiveTurn(drag, dx, dy) {
  const turn = swipeToMove(drag.cubie, drag.face, dx, dy);
  state.busy = true;
  drag.mode = "live";
  drag.live = { ...turn, targets: layerTargets(turn.move), angle: 0, speed: 0 };
  if (state.onTurnStart) state.onTurnStart();
}

function updateLiveTurn(drag, e, dx, dy) {
  const live = drag.live;
  const [ux, uy] = live.screenDirection;
  const angle = (dx * ux + dy * uy) * live.degreesPerPixel;
  live.angle = Math.max(-90, Math.min(90, angle));
  live.speed = drag.vx * ux + drag.vy * uy;
  setLayerAngle(live.targets, live.move, live.direction, live.angle);
}

function moveDrag(e) {
  const drag = state.drag;
  if (!drag || e.pointerId !== drag.pointerId) return;

  if (drag.mode === "view") {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    trackVelocity(drag, e);
    state.view = dragView(state.view, dx, dy);
    renderView();
    return;
  }

  trackVelocity(drag, e);
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (drag.mode === "turn" && Math.hypot(dx, dy) > LIVE_START_PIXELS)
    beginLiveTurn(drag, dx, dy);
  if (drag.mode === "live") updateLiveTurn(drag, e, dx, dy);
}

// -1, 0 or 1 quarter turns: a long enough drag or a quick flick turns the layer, otherwise it springs back
function snapTurns(live) {
  const { angle, speed } = live;
  if (Math.abs(angle) >= SNAP_THRESHOLD_DEGREES) return Math.sign(angle);
  const flicked =
    Math.abs(speed) > FLICK_SPEED &&
    Math.abs(angle) > FLICK_MIN_DEGREES &&
    Math.sign(speed) === Math.sign(angle);
  return flicked ? Math.sign(angle) : 0;
}

async function finishLiveTurn(live, cancelled) {
  const epoch = state.epoch;
  const turns = cancelled ? 0 : snapTurns(live);
  const target = turns * 90;
  const duration = SNAP_MS * Math.max(0.4, Math.abs(target - live.angle) / 90);
  await animateLayer(live.move, live.direction, live.angle, target, duration);
  if (turns !== 0 && epoch === state.epoch)
    commitMove(live.move, live.direction * turns, true);
  else renderCubies();
  state.busy = false;
  runQueue();
}

function endDrag(e, cancelled) {
  const drag = state.drag;
  if (!drag || e.pointerId !== drag.pointerId) return;
  state.drag = null;
  ui.stage.classList.remove("is-dragging");

  if (drag.mode === "live") finishLiveTurn(drag.live, cancelled);
  else if (drag.mode === "view" && !cancelled) {
    const recent = e.timeStamp - drag.time < INERTIA_RELEASE_MS;
    if (recent && Math.hypot(drag.vx, drag.vy) > INERTIA_STOP_SPEED * 3)
      startInertia(drag.vx, drag.vy);
  }
}

function enableInput() {
  ui.stage.addEventListener("pointerdown", startDrag);
  ui.stage.addEventListener("pointermove", moveDrag);
  ui.stage.addEventListener("pointerup", (e) => endDrag(e, false));
  ui.stage.addEventListener("pointercancel", (e) => endDrag(e, true));
}
