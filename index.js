/* eslint-disable object-curly-newline, object-property-newline */
/* globals Fig */
// Get useful methods from FigureOne
const { range, Figure, Point, round } = Fig;

// Global config
const maxIterations = 30;
const width = 6;
const aspectRatio = 1;
const height = width / aspectRatio;
const zero = new Point(0, 0);
const colors = [
  [round(78 / 255, 3), round(15 / 255, 3), round(98 / 255, 3), 1],
  [round(100 / 255, 3), round(157 / 255, 3), round(97 / 255, 3), 1],
  [round(81 / 255, 3), round(167 / 255, 3), round(208 / 255, 3), 1],
  [round(70 / 255, 3), round(89 / 255, 3), round(137 / 255, 3), 1],
  [round(68 / 255, 3), round(142 / 255, 3), round(153 / 255, 3), 1],
];

// Global variables
let offset = new Point(0, 0); // Pan offset
let zoom = 1;
let pIndex = 0;           // preset index
let roots = 5;
let iterations = 30;
let needsUpdate = false;  // Figure needs to be udpated
let PNeedsUpdate = false; // Polynomial needs to be updated

// Create Figure
const figure = new Figure({
  color: [1, 1, 1, 1], scene: [-width / 2, -height / 2, width / 2, height / 2],
});

/*
.########.########.....###.....######..########....###....##......
.##.......##.....##...##.##...##....##....##......##.##...##......
.##.......##.....##..##...##..##..........##.....##...##..##......
.######...########..##.....##.##..........##....##.....##.##......
.##.......##...##...#########.##..........##....#########.##......
.##.......##....##..##.....##.##....##....##....##.....##.##......
.##.......##.....##.##.....##..######.....##....##.....##.########
*/
// Grid of strip triangles
function createGrid(spacing) {
  const x = range(-width / 2, width / 2, spacing);
  const y = range(-height / 2 + 0.5, height / 2, spacing);
  const points = [];
  for (let j = 0; j < y.length - 1; j += 1) {
    for (let i = 0; i < x.length; i += 1) {
      points.push(x[i], y[j], x[i], y[j + 1]);
    }
    points.push(x[x.length - 1], y[j + 1], x[0], y[j + 1]);
  }
  return points;
}

const plane = figure.add({
  make: 'gl',
  vertices: createGrid(0.005),
  dimension: 2,
  color: [0.3, 0, 0, 1],
  glPrimitive: 'TRIANGLE_STRIP',
  vertexShader: {
    src: `
      #define mul(a, b) vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x)
      varying vec4 v_color;
      uniform mat4 u_worldViewProjectionMatrix;
      // Polynomical coefficients
      uniform vec2 u_p5;
      uniform vec2 u_p4;
      uniform vec2 u_p3;
      uniform vec2 u_p2;
      uniform vec2 u_p1;
      uniform vec2 u_p0;
      // Polynomical derivative coefficients
      uniform vec2 u_pd4;
      uniform vec2 u_pd3;
      uniform vec2 u_pd2;
      uniform vec2 u_pd1;
      uniform vec2 u_pd0;
      // Roots
      uniform vec2 u_r0;
      uniform vec2 u_r1;
      uniform vec2 u_r2;
      uniform vec2 u_r3;
      uniform vec2 u_r4;
      uniform int u_roots;  // Number of roots

      uniform vec2 u_offset;    // Pan offset
      uniform int u_iterations;
      uniform float u_zoom;
      uniform float u_convergenceSpeed;
      uniform float u_convergenceThreshold;

      attribute vec2 aVertex;

      // Complex division
      vec2 div(vec2 a, vec2 b) {
        float den = b.x * b.x + b.y * b.y;
        return vec2((a.x * b.x + a.y * b.y) / den, (-a.x * b.y + a.y * b.x) / den);
      }

      vec2 square(vec2 a) { return mul(a, a); }
      vec2 cube(vec2 a) { return mul(a, square(a)); }

      void main() {
        gl_Position = u_worldViewProjectionMatrix * vec4(aVertex.xy, 0, 1);

        vec2 p = aVertex / u_zoom + u_offset;
        vec2 lastP = vec2(p.x + 1.0, p.y + 1.0);
        float k = 0.0;
        for(int i = 0; i < ${maxIterations}; i++) {
          k = k + 1.0 / float(u_iterations);
          if (i < u_iterations && distance(lastP, p) > u_convergenceThreshold) {
            vec2 squareP = square(p);
            vec2 cubeP = mul(p, squareP);
            vec2 quadP = mul(p, cubeP);
            lastP = p;
            vec2 Px = mul(u_p2, squareP) + mul(u_p1, p) + u_p0;
            vec2 Pdx = mul(u_pd1, p) + u_pd0;
            if (u_roots > 2) {
              Px += mul(u_p3, cubeP);
              Pdx += mul(u_pd2, squareP);
            }
            if (u_roots > 3) {
              Px += mul(u_p4, quadP);
              Pdx += mul(u_pd3, cubeP);
            }
            if (u_roots > 4) {
              Px += mul(u_p5, mul(cubeP, squareP));
              Pdx += mul(u_pd4, quadP);
            }
            p = p - div(Px, Pdx);
          } else {
            break;
          }
        }
        if (u_convergenceSpeed > 0.5) {
          v_color = vec4(k, 0, 0, 1);
        } else {
          float minDistance = distance(u_r0, p);
          float r1Distance = distance(u_r1, p);
          float r2Distance = distance(u_r2, p);
          float r3Distance = distance(u_r3, p);
          float r4Distance = distance(u_r4, p);
          v_color = vec4(${colors[0]});
          if (r1Distance < minDistance) {
            minDistance = r1Distance;
            v_color = vec4(${colors[1]});
          }
          if (u_roots > 2 && r2Distance < minDistance) {
            minDistance = r2Distance;
            v_color = vec4(${colors[2]});
          }
          if (u_roots > 3 && r3Distance < minDistance) {
            minDistance = r3Distance;
            v_color = vec4(${colors[3]});
          }
          if (u_roots > 4 && r4Distance < minDistance) {
            minDistance = r4Distance;
            v_color = vec4(${colors[4]});
          }
        }
      }`,
    vars: ['aVertex', 'u_worldViewProjectionMatrix', 'u_p5', 'u_p4', 'u_p3', 'u_p2', 'u_p1', 'u_p0', 'u_pd4', 'u_pd3', 'u_pd2', 'u_pd1', 'u_pd0', 'u_iterations', 'u_r0', 'u_r1', 'u_r2', 'u_r3', 'u_r4', 'u_roots', 'u_offset', 'u_zoom', 'u_convergenceThreshold', 'u_convergenceSpeed'],
  },
  fragmentShader: {
    src: `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }`,
  },
  uniforms: [
    { name: 'u_r0', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_r1', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_r2', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_r3', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_r4', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_p5', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_p4', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_p3', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_p2', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_p1', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_p0', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_pd4', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_pd3', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_pd2', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_pd1', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_pd0', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_iterations', length: 1, value: 0, type: 'INT' },
    { name: 'u_roots', length: 1, value: 0, type: 'INT' },
    { name: 'u_offset', length: 2, value: [0, 0], type: 'FLOAT_VECTOR' },
    { name: 'u_zoom', length: 1, value: [0], type: 'FLOAT' },
    { name: 'u_convergenceSpeed', length: 1, value: [0], type: 'FLOAT' },
    { name: 'u_convergenceThreshold', length: 1, value: [0.001], type: 'FLOAT' },
  ],
});

/*
.########...#######...#######..########..######.
.##.....##.##.....##.##.....##....##....##....##
.##.....##.##.....##.##.....##....##....##......
.########..##.....##.##.....##....##.....######.
.##...##...##.....##.##.....##....##..........##
.##....##..##.....##.##.....##....##....##....##
.##.....##..#######...#######.....##.....######.
*/
// Create the roots. They will have their own scene that will be zoomed and
// panned indpendently. When zoomed, the roots will get scaled by the inverse
// so their size remains consistent.
const s = new Fig.Scene({
  left: -width / 2, bottom: -height / 2, right: width / 2, top: height / 2,
});
function makeRoot(color, position) {
  return figure.add({
    make: 'collection',
    elements: [
      { make: 'polygon', radius: 0.05, sides: 30, color },
      {
        make: 'polygon', radius: 0.065, sides: 30,
        color: [1, 1, 1, 1], line: { width: 0.02 },
      },
      {
        make: 'polygon', radius: 0.09, sides: 30,
        color: [0, 0, 0, 1], line: { width: 0.02 },
      },
    ],
    position,
    move: true,
    touchBorder: figure.isTouchDevice ? 0.3 : 0.1,
    scene: s,
  });
}

const root0 = makeRoot(colors[0], [-2, -1]);
const root1 = makeRoot(colors[1], [-1, 1]);
const root2 = makeRoot(colors[2], [0, -2]);
const root3 = makeRoot(colors[3], [1, 1]);
const root4 = makeRoot(colors[4], [2, -1]);

/*
.##.....##.########..########.....###....########.########.########.
.##.....##.##.....##.##.....##...##.##......##....##.......##.....##
.##.....##.##.....##.##.....##..##...##.....##....##.......##.....##
.##.....##.########..##.....##.##.....##....##....######...########.
.##.....##.##........##.....##.#########....##....##.......##...##..
.##.....##.##........##.....##.##.....##....##....##.......##....##.
..#######..##........########..##.....##....##....########.##.....##
*/

function updated(rootsUpdated = false) {
  needsUpdate = true;
  if (rootsUpdated) {
    PNeedsUpdate = true;
  }
  figure.animateNextFrame();
}

function update() {
  if (needsUpdate === false) {
    return;
  }
  // Set the scene for the roots
  const w = width / zoom;
  const h = height / zoom;
  s.set2D({
    left: -w / 2 - offset.x,
    right: w / 2 - offset.x,
    bottom: -h / 2 - offset.y,
    top: h / 2 - offset.y,
  });
  root0.transform.updateScale(1 / zoom);
  root1.transform.updateScale(1 / zoom);
  root2.transform.updateScale(1 / zoom);
  root3.transform.updateScale(1 / zoom);
  root4.transform.updateScale(1 / zoom);

  // If the roots have changed position, then recomput polynomial and
  // derivative and set correspondinguniforms
  if (PNeedsUpdate) {
    const r0 = root0.getPosition();
    const r1 = root1.getPosition();
    const r2 = root2.getPosition();
    const r3 = root3.getPosition();
    const r4 = root4.getPosition();
    const r = [r0, r1, r2, r3, r4];
    let P = [r0.cmul(r1), r0.add(r1).scale(-1), new Point(1, 0), zero, zero, zero];
    let Pd = [P[1], new Point(2, 0), zero, zero, zero];
    for (let m = 3; m <= roots; m += 1) {
      const Pm = [P[0].cmul(r[m - 1].scale(-1)), zero, zero, zero, zero, zero];
      for (let t = 1; t < m; t += 1) {
        Pm[t] = P[t - 1].add(r[m - 1].scale(-1).cmul(P[t]));
      }
      Pm[m] = new Point(1, 0);
      P = Pm;
      Pd = [P[1], zero, zero, zero, zero];
      for (let t = 1; t < m; t += 1) {
        Pd[t] = P[t + 1].scale(t + 1);
      }
      Pd[m - 1] = new Point(m, 0);
    }

    // Root position uniforms
    plane.drawingObject.uniforms.u_r0.value = [r0.x, r0.y];
    plane.drawingObject.uniforms.u_r1.value = [r1.x, r1.y];
    plane.drawingObject.uniforms.u_r2.value = [r2.x, r2.y];
    plane.drawingObject.uniforms.u_r3.value = [r3.x, r3.y];
    plane.drawingObject.uniforms.u_r4.value = [r4.x, r4.y];

    // Polynomial uniforms
    plane.drawingObject.uniforms.u_p5.value = [P[5].x, P[5].y];
    plane.drawingObject.uniforms.u_p4.value = [P[4].x, P[4].y];
    plane.drawingObject.uniforms.u_p3.value = [P[3].x, P[3].y];
    plane.drawingObject.uniforms.u_p2.value = [P[2].x, P[2].y];
    plane.drawingObject.uniforms.u_p1.value = [P[1].x, P[1].y];
    plane.drawingObject.uniforms.u_p0.value = [P[0].x, P[0].y];

    // Polynomial derivative uniforms
    plane.drawingObject.uniforms.u_pd4.value = [Pd[4].x, Pd[4].y];
    plane.drawingObject.uniforms.u_pd3.value = [Pd[3].x, Pd[3].y];
    plane.drawingObject.uniforms.u_pd2.value = [Pd[2].x, Pd[2].y];
    plane.drawingObject.uniforms.u_pd1.value = [Pd[1].x, Pd[1].y];
    plane.drawingObject.uniforms.u_pd0.value = [Pd[0].x, Pd[0].y];
    PNeedsUpdate = false;
  }

  // Upload global uniforms
  plane.drawingObject.uniforms.u_iterations.value = [iterations];
  plane.drawingObject.uniforms.u_roots.value = [roots];
  plane.drawingObject.uniforms.u_offset.value = [-offset.x, -offset.y];
  plane.drawingObject.uniforms.u_zoom.value = [zoom];

  needsUpdate = false;
}

/*
..######...#######..##....##.########.########...#######..##........######.
.##....##.##.....##.###...##....##....##.....##.##.....##.##.......##....##
.##.......##.....##.####..##....##....##.....##.##.....##.##.......##......
.##.......##.....##.##.##.##....##....########..##.....##.##........######.
.##.......##.....##.##..####....##....##...##...##.....##.##.............##
.##....##.##.....##.##...###....##....##....##..##.....##.##.......##....##
..######...#######..##....##....##....##.....##..#######..########..######.
*/
const controls = figure.add({
  name: 'controls',
  make: 'collection',
  position: [0, -height / 2 + 0.25],
  elements: [
    {
      make: 'rectangle',
      width,
      height: 0.5,
      color: [0, 0, 0, 1],
      touch: true,
    },
    {
      name: 'iterations',
      make: 'text',
      position: [-width * 0.35, 0.03],
      xAlign: 'center',
      text: 'Max Iterations: 10',
      font: { size: 0.15 },
    },
    {
      name: 'slider',
      make: 'collections.slider',
      width: width / 4,
      height: 0.15,
      theme: 'light',
      position: [-width * 0.35, -0.1],
      touchBorder: [0.2, 0.2, 0.15, 0.27],
    },
    {
      name: 'presets',
      make: 'collections.button',
      label: { text: 'Presets', font: { size: 0.19 } },
      width: 0.7,
      height: 0.3,
      position: [width * 0.14 + width * 0.01, 0],
      touchBorder: [0.07, 0.1, 0.07, 0.1],
    },
    {
      name: 'home',
      make: 'collections.button',
      label: { text: 'Home', font: { size: 0.19 } },
      width: 0.7,
      height: 0.3,
      position: [-width * 0 + width * 0.01, 0],
      touchBorder: [0.07, 0.1, 0.07, 0.1],
    },
    {
      name: 'roots',
      make: 'collections.button',
      states: ['2 Roots', '3 Roots', '4 Roots', '5 Roots'],
      width: 0.7,
      height: 0.3,
      touchBorder: [0.07, 0.1, 0.07, 0.1],
      label: { font: { size: 0.19 } },
      position: [-width * 0.14 + width * 0.01, 0],
    },
    {
      name: 'convergenceSpeed',
      make: 'collections.toggle',
      position: [width * 0.43, -0.01],
      width: width * 0.06,
      theme: 'light',
      touchBorder: [1, 0.2, 0.2, 0.15],
    },
    {
      name: 'convergenceLabel',
      make: 'textLines',
      text: ['Iterations to', 'Converge'],
      justify: 'center',
      font: { size: 0.14 },
      position: [width * 0.26, 0.03],
    },
  ],
});

/*
.########..##........#######..########
.##.....##.##.......##.....##....##...
.##.....##.##.......##.....##....##...
.########..##.......##.....##....##...
.##........##.......##.....##....##...
.##........##.......##.....##....##...
.##........########..#######.....##...
*/
const plot = figure.add({
  make: 'collections.plot',
  font: { size: 0.15 },
  x: {
    start: -width / 2, stop: width / 2, step: 1,
    line: false, ticks: false, autoStep: 2, labels: { hide: [0] },
  },
  y: {
    start: -width / 2, stop: width / 2, step: 1, line: false, ticks: false,
    autoStep: 2, labels: v => v.values.map(p => `${Fig.round(Math.abs(p), 4)}i`),
  },
  position: [-width / 2, -width / 2 * aspectRatio + 0.5],
  color: [1, 1, 1, 1],
  width,
  height: width * aspectRatio - 0.5,
  cross: [0, 0],
  zoom: true,
  pan: true,
  autoGrid: true,
  plotAreaLabels: { left: 0.05, right: 0, bottom: 0.05, top: 0 },
});

plot.notifications.add('update', () => {
  zoom = plot.getZoom();
  offset = plot.getPan();
  updated();
});

/*
.####.##....##.########.########.########.....###.....######..########
..##..###...##....##....##.......##.....##...##.##...##....##....##...
..##..####..##....##....##.......##.....##..##...##..##..........##...
..##..##.##.##....##....######...########..##.....##.##..........##...
..##..##..####....##....##.......##...##...#########.##..........##...
..##..##...###....##....##.......##....##..##.....##.##....##....##...
.####.##....##....##....########.##.....##.##.....##..######.....##...
*/
// Setup interactive elements

// Stop animations if being moved
root0.notifications.add('beforeMove', () => figure.stop());
root1.notifications.add('beforeMove', () => figure.stop());
root2.notifications.add('beforeMove', () => figure.stop());
root3.notifications.add('beforeMove', () => figure.stop());
root4.notifications.add('beforeMove', () => figure.stop());
// Update when moved or animated
root0.notifications.add('setTransform', () => updated(true));
root1.notifications.add('setTransform', () => updated(true));
root2.notifications.add('setTransform', () => updated(true));
root3.notifications.add('setTransform', () => updated(true));
root4.notifications.add('setTransform', () => updated(true));

controls._slider.notifications.add('changed', (v) => {
  iterations = round(v * maxIterations, 0);
  controls._iterations.custom.setText(`Max Iterations: ${iterations}`);
  updated();
});

controls._home.notifications.add('touch', () => {
  offset = new Point(0, 0);
  zoom = 1;
  updated();
});

controls._roots.notifications.add('touch', (index) => {
  pIndex = 0;
  roots = index + 2;
  root2.hide();
  root3.hide();
  root4.hide();
  if (index > 0) {
    root2.showAll();
  }
  if (index > 1) {
    root3.showAll();
  }
  if (index > 2) {
    root4.showAll();
  }
  updated(true);
});

controls._convergenceSpeed.notifications.add('on', () => {
  plane.drawingObject.uniforms.u_convergenceSpeed.value = [1.0];
});
controls._convergenceSpeed.notifications.add('off', () => {
  plane.drawingObject.uniforms.u_convergenceSpeed.value = [0.0];
});


/*
.########..########..########..######..########.########..######.
.##.....##.##.....##.##.......##....##.##..........##....##....##
.##.....##.##.....##.##.......##.......##..........##....##......
.########..########..######....######..######......##.....######.
.##........##...##...##.............##.##..........##..........##
.##........##....##..##.......##....##.##..........##....##....##
.##........##.....##.########..######..########....##.....######.
*/
// Preset root positions and animation logic
// Any number of presets can be used
const presets2 = [
  [[-1, 0], [1, 0]],
  [[-1, 0], [1, -1.5]],
  [[-1, 0], [1, 1.5]],
  [[0, -1], [0, 1]],
  [[2, 0], [-2, 0]],
];
const presets3 = [
  [[-1, -1], [0, 1], [1, -1]],
  [[-1, -1], [0, 2.5], [1, -1]],
  [[-1.5, 0], [0, 0], [1.5, 0]],
  [[-1.5, 0], [-1.3, 0], [1.5, 0]],
  [[-1.5, 0], [1.3, 0], [1.5, 0]],
  [[0, 0.2], [0, -0.2], [1.5, 0]],
  [[0, 0.2], [0, -0.2], [1.5, 1]],
  [[0, 0.2], [0, -0.2], [1.5, -1]],
  [[0, 0.2], [0, -0.2], [1, 0]],
  [[0, 0.2], [0, -0.2], [-2, 0]],
];
const presets4 = [
  [[-1, -1], [-1, 1], [1, 1], [1, -1]],
  [[-1, -1], [-1, 1], [1, 1], [2, -2]],
  [[-1, -1], [-1, 1], [1, 1], [0, 0]],
  [[1, -1], [-1, 1], [1, 1], [0, 0]],
  [[2, 0], [-2, 0], [0, 0.5], [0, -0.5]],
];
const presets5 = [
  [[-1, 0], [0, -1], [0, 0], [0, 1], [1, 0]],
  [[-2, 0], [0, -1], [-1, 0], [0, 1], [1, 0]],
  [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]],
  [[0.5, 0], [-1, 0], [0, 0], [1, 0], [2, 0]],
  [[-1, 0], [0, -1.5], [0, -0.5], [0, 0], [1, 0]],
  [[-0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [1, 0]],
  [[-2, 0], [-1.6, 0.5], [-0.5, -1], [0.5, 0.5], [1, 0.5]],
  [[-2, -1], [-1, 1], [0, -2], [1, 1], [2, -1]],
];
const presets = [presets2, presets3, presets4, presets5];

controls._presets.notifications.add('touch', () => {
  figure.stop();
  const steps = [];
  const r = [root0, root1, root2, root3, root4];
  for (let i = 0; i < roots; i += 1) {
    steps.push(r[i].animations.position({ target: presets[roots - 2][pIndex][i], duration: 4 }));
  }
  figure.animations.new().inParallel(steps).start();
  pIndex = (pIndex + 1) % presets[roots - 2].length;
});

/*
..######..########.########.##.....##.########.
.##....##.##..........##....##.....##.##.....##
.##.......##..........##....##.....##.##.....##
..######..######......##....##.....##.########.
.......##.##..........##....##.....##.##.......
.##....##.##..........##....##.....##.##.......
..######..########....##.....#######..##.......
*/
controls._slider.setValue(1);
roots = 5;
controls._roots.setStateIndex(3);
figure.notifications.add('beforeDraw', () => update());
PNeedsUpdate = true;

