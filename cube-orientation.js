const DRAG_DEGREES_PER_PIXEL = 0.5;

function rotationFromDegrees(axis, degrees) {
  const radians = degrees * Math.PI / 180;
  return axisRotation(axis, Math.cos(radians), Math.sin(radians));
}

const START_VIEW = multiply(rotationFromDegrees('x', -25), rotationFromDegrees('y', -35));

// Spin in screen space so any drag direction works at any angle, with no limit
function dragView(view, dx, dy) {
  const horizontal = rotationFromDegrees('y', dx * DRAG_DEGREES_PER_PIXEL);
  const vertical = rotationFromDegrees('x', -dy * DRAG_DEGREES_PER_PIXEL);
  return multiply(vertical, multiply(horizontal, view));
}

function toMatrix3d(m, [x, y, z] = [0, 0, 0]) {
  return `matrix3d(${m[0][0]},${m[1][0]},${m[2][0]},0,${m[0][1]},${m[1][1]},${m[2][1]},0,`
       + `${m[0][2]},${m[1][2]},${m[2][2]},0,${x},${y},${z},1)`;
}

function screenVector(view, vector) {
  const [x, y] = transform(view, vector);
  return [x, y];
}
