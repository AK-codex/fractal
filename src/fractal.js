const canvas = document.querySelector("#fractalCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const controls = {
  preset: document.querySelector("#preset"),
  palette: document.querySelector("#palette"),
  resolution: document.querySelector("#resolution"),
  iterations: document.querySelector("#iterations"),
  speed: document.querySelector("#speed"),
  glow: document.querySelector("#glow"),
  trail: document.querySelector("#trail"),
  toggleAnimation: document.querySelector("#toggleAnimation"),
  randomize: document.querySelector("#randomize"),
  savePng: document.querySelector("#savePng"),
};

const outputs = {
  iterations: document.querySelector("#iterationOutput"),
  speed: document.querySelector("#speedOutput"),
  glow: document.querySelector("#glowOutput"),
  trail: document.querySelector("#trailOutput"),
  stats: document.querySelector("#stats"),
  preset: document.querySelector("#presetLabel"),
};

const presets = {
  mandelbrot: {
    label: "Classic Mandelbrot",
    center: [-0.62, 0],
    span: 3.1,
    juliaMix: 0,
    power: 2,
  },
  seahorse: {
    label: "Seahorse Valley",
    center: [-0.743643887, 0.131825904],
    span: 0.018,
    juliaMix: 0.15,
    power: 2,
  },
  julia: {
    label: "Electric Julia",
    center: [0, 0],
    span: 3.05,
    juliaMix: 1,
    power: 2,
  },
  burningShip: {
    label: "Burning Ship",
    center: [-0.55, -0.52],
    span: 2.7,
    juliaMix: 0,
    power: 2,
    absoluteOrbit: true,
  },
};

const paletteStops = {
  nebula: [
    [8, 5, 24],
    [42, 11, 92],
    [132, 44, 255],
    [0, 225, 255],
    [255, 246, 169],
  ],
  lava: [
    [6, 0, 0],
    [88, 7, 7],
    [224, 53, 12],
    [255, 174, 66],
    [255, 252, 210],
  ],
  aurora: [
    [1, 12, 24],
    [0, 112, 112],
    [38, 255, 171],
    [162, 74, 255],
    [250, 250, 255],
  ],
  mono: [
    [0, 0, 0],
    [32, 35, 44],
    [110, 124, 145],
    [216, 226, 244],
    [255, 255, 255],
  ],
};

let running = true;
let frameCount = 0;
let lastFpsTime = performance.now();
let previousFrame = null;
let renderScale = 1;

function readSettings() {
  const preset = presets[controls.preset.value];
  return {
    preset,
    palette: paletteStops[controls.palette.value],
    iterations: Number(controls.iterations.value),
    speed: Number(controls.speed.value) / 100,
    glow: Number(controls.glow.value) / 100,
    trail: Number(controls.trail.value) / 100,
  };
}

function updateReadouts() {
  outputs.iterations.value = controls.iterations.value;
  outputs.speed.value = (Number(controls.speed.value) / 100).toFixed(2);
  outputs.glow.value = (Number(controls.glow.value) / 100).toFixed(2);
  outputs.trail.value = (Number(controls.trail.value) / 100).toFixed(2);
  outputs.preset.textContent = presets[controls.preset.value].label;
}

function resizeCanvas() {
  const size = Number(controls.resolution.value);
  canvas.width = size;
  canvas.height = size;
  renderScale = size / 900;
  previousFrame = null;
}

function interpolateColor(stops, value) {
  const scaled = Math.max(0, Math.min(0.999, value)) * (stops.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const start = stops[index];
  const end = stops[index + 1] || stops[index];
  return [
    start[0] + (end[0] - start[0]) * local,
    start[1] + (end[1] - start[1]) * local,
    start[2] + (end[2] - start[2]) * local,
  ];
}

function fractalValue(cx, cy, time, settings) {
  const { preset, iterations } = settings;
  const morph = 0.5 + 0.5 * Math.sin(time * 0.27);
  const juliaCr = -0.78 + 0.16 * Math.cos(time * 0.19);
  const juliaCi = 0.156 + 0.22 * Math.sin(time * 0.23);
  const juliaMix = Math.min(1, preset.juliaMix + morph * 0.18);

  let zr = cx * juliaMix;
  let zi = cy * juliaMix;
  let cr = cx * (1 - juliaMix) + juliaCr * juliaMix;
  let ci = cy * (1 - juliaMix) + juliaCi * juliaMix;

  for (let i = 0; i < iterations; i += 1) {
    if (preset.absoluteOrbit) {
      zr = Math.abs(zr);
      zi = Math.abs(zi);
    }

    const zr2 = zr * zr;
    const zi2 = zi * zi;
    if (zr2 + zi2 > 16) {
      const smooth = i + 1 - Math.log2(Math.log2(Math.sqrt(zr2 + zi2)));
      return smooth / iterations;
    }

    zi = 2 * zr * zi + ci;
    zr = zr2 - zi2 + cr;
  }

  return 0;
}

function renderFrame(now) {
  const time = now * 0.001;
  const settings = readSettings();
  const { preset, palette, glow, speed, trail } = settings;
  const width = canvas.width;
  const height = canvas.height;
  const image = ctx.createImageData(width, height);
  const pixels = image.data;

  const pulse = 0.5 + 0.5 * Math.sin(time * 0.33);
  const zoom = Math.exp(-speed * (0.75 + pulse) * (time % 16));
  const rotate = Math.sin(time * 0.11) * 0.38;
  const cos = Math.cos(rotate);
  const sin = Math.sin(rotate);
  const span = preset.span * (0.82 + 0.18 * Math.sin(time * 0.41)) * zoom;
  const cxOffset = Math.sin(time * 0.17) * span * 0.07;
  const cyOffset = Math.cos(time * 0.13) * span * 0.07;

  for (let y = 0; y < height; y += 1) {
    const ny = (y / height - 0.5) * span;
    for (let x = 0; x < width; x += 1) {
      const nx = (x / width - 0.5) * span;
      const cr = preset.center[0] + nx * cos - ny * sin + cxOffset;
      const ci = preset.center[1] + nx * sin + ny * cos + cyOffset;
      const escaped = fractalValue(cr, ci, time, settings);
      const index = (y * width + x) * 4;

      if (escaped === 0) {
        pixels[index] = 0;
        pixels[index + 1] = 0;
        pixels[index + 2] = 0;
      } else {
        const wave = 0.18 * Math.sin(34 * escaped + time * 2.7);
        const brightness = Math.pow(escaped, 0.38) + glow * 0.28 + wave;
        const [r, g, b] = interpolateColor(palette, brightness % 1);
        pixels[index] = Math.min(255, r * (1 + glow * escaped));
        pixels[index + 1] = Math.min(255, g * (1 + glow * escaped));
        pixels[index + 2] = Math.min(255, b * (1 + glow * escaped));
      }
      pixels[index + 3] = 255;
    }
  }

  if (previousFrame && trail > 0) {
    const previous = previousFrame.data;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = pixels[i] * (1 - trail) + previous[i] * trail;
      pixels[i + 1] = pixels[i + 1] * (1 - trail) + previous[i + 1] * trail;
      pixels[i + 2] = pixels[i + 2] * (1 - trail) + previous[i + 2] * trail;
    }
  }

  previousFrame = image;
  ctx.putImageData(image, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.max(0.5, 7 * glow * renderScale)}px)`;
  ctx.globalAlpha = glow * 0.26;
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();

  frameCount += 1;
  if (now - lastFpsTime > 700) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    outputs.stats.textContent = `${fps} fps · ${width}x${height}`;
    frameCount = 0;
    lastFpsTime = now;
  }

  if (running) {
    requestAnimationFrame(renderFrame);
  }
}

function randomize() {
  const presetKeys = Object.keys(presets);
  const paletteKeys = Object.keys(paletteStops);
  controls.preset.value = presetKeys[Math.floor(Math.random() * presetKeys.length)];
  controls.palette.value = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
  controls.iterations.value = Math.floor(100 + Math.random() * 260);
  controls.speed.value = Math.floor(18 + Math.random() * 82);
  controls.glow.value = Math.floor(35 + Math.random() * 65);
  controls.trail.value = Math.floor(8 + Math.random() * 55);
  previousFrame = null;
  updateReadouts();
}

function savePng() {
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  link.download = `fractal-${stamp}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

for (const control of Object.values(controls)) {
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
    control.addEventListener("input", updateReadouts);
  }
}

controls.resolution.addEventListener("change", resizeCanvas);
controls.preset.addEventListener("change", () => {
  previousFrame = null;
});
controls.palette.addEventListener("change", () => {
  previousFrame = null;
});
controls.toggleAnimation.addEventListener("click", () => {
  running = !running;
  controls.toggleAnimation.textContent = running ? "Pause" : "Play";
  if (running) {
    lastFpsTime = performance.now();
    frameCount = 0;
    requestAnimationFrame(renderFrame);
  }
});
controls.randomize.addEventListener("click", randomize);
controls.savePng.addEventListener("click", savePng);

updateReadouts();
resizeCanvas();
requestAnimationFrame(renderFrame);
