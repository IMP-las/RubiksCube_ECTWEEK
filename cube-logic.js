const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const AXIS_NAMES = ['x', 'y', 'z'];

function axisRotation(axis, c, s) {
  if (axis === 'x') return [[1, 0, 0], [0, c, -s], [0, s, c]];
  if (axis === 'y') return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

function rotationMatrix(axis, turns) {
  const k = ((turns % 4) + 4) % 4;
  return axisRotation(axis, [1, 0, -1, 0][k], [0, 1, 0, -1][k]);
}

function multiply(a, b) {
  return a.map((row, i) => b[0].map((_, j) => row.reduce((sum, _v, k) => sum + a[i][k] * b[k][j], 0)));
}

function transform(matrix, vector) {
  return matrix.map(row => row.reduce((sum, v, k) => sum + v * vector[k], 0));
}

function createCubies() {
  const cubies = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        cubies.push({ home: [x, y, z], pos: [x, y, z], rot: IDENTITY });
      }
    }
  }
  return cubies;
}

function isFaceCenter(cubie) {
  return cubie.home.filter(v => v === 0).length === 2;
}

// A center sitting on the turning axis stays put: face turns never spin its picture
function spinsInPlace(cubie, axisIndex) {
  return isFaceCenter(cubie) && cubie.pos[axisIndex] !== 0;
}

function isInLayer(cubie, move) {
  return cubie.pos[AXIS_NAMES.indexOf(move.axis)] === move.layer;
}

function applyMove(cubies, move, direction) {
  const matrix = rotationMatrix(move.axis, move.turns * direction);
  const axisIndex = AXIS_NAMES.indexOf(move.axis);
  cubies.filter(c => isInLayer(c, move)).forEach(c => {
    if (!spinsInPlace(c, axisIndex)) c.rot = multiply(matrix, c.rot);
    c.pos = transform(matrix, c.pos);
  });
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function sameVector(a, b) {
  return a.every((v, i) => v === b[i]);
}

// Solved means every piece sits where the whole cube's turn says it should; center pictures never twist, so only their position counts
function isSolved(cubies) {
  const movable = cubies.filter(c => !isFaceCenter(c));
  const whole = movable[0].rot;
  return cubies.every(c => sameVector(c.pos, transform(whole, c.home)))
    && movable.every(c => sameVector(c.rot.flat(), whole.flat()));
}

// When the whole cube was turned by slice moves, the centers follow it once solved
function alignCenters(cubies) {
  const whole = cubies.find(c => !isFaceCenter(c)).rot;
  cubies.filter(isFaceCenter).forEach(c => { c.rot = whole; });
}
