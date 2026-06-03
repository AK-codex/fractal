const PALETTES = {
  cosmic: [
    [4, 7, 20],
    [35, 15, 89],
    [104, 42, 210],
    [0, 196, 255],
    [255, 245, 190],
  ],
  ember: [
    [5, 0, 0],
    [78, 10, 3],
    [198, 44, 10],
    [255, 153, 43],
    [255, 243, 201],
  ],
  ocean: [
    [0, 8, 18],
    [0, 59, 95],
    [0, 153, 188],
    [91, 236, 220],
    [241, 255, 250],
  ],
  mono: [
    [0, 0, 0],
    [30, 34, 44],
    [107, 119, 140],
    [215, 224, 238],
    [255, 255, 255],
  ],
};

const FRACTALS = {
  mandelbrot(cx, cy, maxIterations) {
    let zx = 0;
    let zy = 0;
    return escapeTime(zx, zy, cx, cy, maxIterations, false);
  },

  burningShip(cx, cy, maxIterations) {
    let zx = 0;
    let zy = 0;
    return escapeTime(zx, zy, cx, cy, maxIterations, true);
  },

  julia(cx, cy, maxIterations) {
    const juliaX = -0.8;
    const juliaY = 0.156;
    return escapeTime(cx, cy, juliaX, juliaY, maxIterations, false);
  },
};

let activeJobId = 0;

self.addEventListener("message", (event) => {
  activeJobId = event.data.id;
  render(event.data);
});

function escapeTime(zxStart, zyStart, cx, cy, maxIterations, absoluteOrbit) {
  let zx = zxStart;
  let zy = zyStart;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (absoluteOrbit) {
      zx = Math.abs(zx);
      zy = Math.abs(zy);
    }

    const zx2 = zx * zx;
    const zy2 = zy * zy;
    const radius2 = zx2 + zy2;

    if (radius2 > 4) {
      const smooth = iteration + 1 - Math.log2(Math.log2(Math.sqrt(radius2)));
      return Math.max(0, smooth);
    }

    zy = 2 * zx * zy + cy;
    zx = zx2 - zy2 + cx;
  }

  return maxIterations;
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

function colorPixel(iteration, maxIterations, palette) {
  if (iteration >= maxIterations) {
    return [0, 0, 0];
  }

  const normalized = iteration / maxIterations;
  const curved = Math.pow(normalized, 0.42);
  const bands = 0.08 * Math.sin(iteration * 0.18);
  const [r, g, b] = interpolateColor(palette, (curved + bands + 1) % 1);
  const edgeBoost = 0.85 + Math.min(0.55, normalized * 1.8);

  return [
    Math.min(255, r * edgeBoost),
    Math.min(255, g * edgeBoost),
    Math.min(255, b * edgeBoost),
  ];
}

function render(job) {
  const {
    id,
    phase,
    width,
    height,
    centerX,
    centerY,
    span,
    maxIterations,
    fractalType,
    palette: paletteName,
  } = job;

  const renderFractal = FRACTALS[fractalType] || FRACTALS.mandelbrot;
  const palette = PALETTES[paletteName] || PALETTES.cosmic;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const aspect = height / width;
  const xSpan = span;
  const ySpan = span * aspect;
  const chunkRows = phase === "preview" ? 18 : 8;
  let y = 0;

  function processChunk() {
    if (id !== activeJobId) {
      return;
    }

    const yEnd = Math.min(height, y + chunkRows);
    for (; y < yEnd; y += 1) {
      const cy = centerY + (y / (height - 1) - 0.5) * ySpan;

      for (let x = 0; x < width; x += 1) {
        const cx = centerX + (x / (width - 1) - 0.5) * xSpan;
        const escapedAt = renderFractal(cx, cy, maxIterations);
        const [r, g, b] = colorPixel(escapedAt, maxIterations, palette);
        const index = (y * width + x) * 4;

        pixels[index] = r;
        pixels[index + 1] = g;
        pixels[index + 2] = b;
        pixels[index + 3] = 255;
      }
    }

    if (y >= height) {
      self.postMessage({
        type: "complete",
        id,
        phase,
        width,
        height,
        buffer: pixels.buffer,
      }, [pixels.buffer]);
      return;
    }

    if (y % (chunkRows * 4) === 0) {
      self.postMessage({
        type: "progress",
        id,
        phase,
        percent: Math.round((y / height) * 100),
      });
    }

    setTimeout(processChunk, 0);
  }

  processChunk();
}
