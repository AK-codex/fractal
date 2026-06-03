const canvas = document.querySelector("#fractalCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const controls = {
  fractalType: document.querySelector("#fractalType"),
  palette: document.querySelector("#palette"),
  resolution: document.querySelector("#resolution"),
  iterations: document.querySelector("#iterations"),
  autoIterations: document.querySelector("#autoIterations"),
  resetView: document.querySelector("#resetView"),
  savePng: document.querySelector("#savePng"),
};

const outputs = {
  fractalLabel: document.querySelector("#fractalLabel"),
  zoomLabel: document.querySelector("#zoomLabel"),
  status: document.querySelector("#statusLabel"),
  iterations: document.querySelector("#iterationOutput"),
  center: document.querySelector("#centerOutput"),
  span: document.querySelector("#spanOutput"),
  precision: document.querySelector("#precisionOutput"),
};

const FRACTAL_PRESETS = {
  mandelbrot: {
    label: "Mandelbrot Set",
    centerX: -0.5,
    centerY: 0,
    span: 3.2,
  },
  burningShip: {
    label: "Burning Ship",
    centerX: -0.45,
    centerY: -0.55,
    span: 3.0,
  },
  julia: {
    label: "Julia Set",
    centerX: 0,
    centerY: 0,
    span: 3.2,
  },
};

const view = {
  centerX: FRACTAL_PRESETS.mandelbrot.centerX,
  centerY: FRACTAL_PRESETS.mandelbrot.centerY,
  span: FRACTAL_PRESETS.mandelbrot.span,
};

let worker = createRenderer();
let renderId = 0;
let isDragging = false;
let dragStart = null;
let dragStartView = null;
const previewCanvas = document.createElement("canvas");
const previewCtx = previewCanvas.getContext("2d", { alpha: false });

function createRenderer() {
  const nextWorker = new Worker("src/renderer.worker.js");
  nextWorker.addEventListener("message", handleWorkerMessage);
  nextWorker.addEventListener("error", () => {
    outputs.status.textContent = "Renderer error. Try a smaller image size.";
  });
  return nextWorker;
}

function resetRenderer() {
  worker.terminate();
  worker = createRenderer();
}

function currentPreset() {
  return FRACTAL_PRESETS[controls.fractalType.value];
}

function formatNumber(value) {
  if (Math.abs(value) >= 1e5 || Math.abs(value) < 1e-4 && value !== 0) {
    return value.toExponential(6);
  }
  return value.toFixed(6);
}

function getAutoIterations() {
  const base = Number(controls.iterations.value);
  if (!controls.autoIterations.checked) {
    return base;
  }

  const initialSpan = currentPreset().span;
  const zoomDepth = Math.max(0, Math.log2(initialSpan / view.span));
  return Math.min(8000, Math.round(base + zoomDepth * 45));
}

function getZoomLabel() {
  const zoom = currentPreset().span / view.span;
  if (zoom >= 1e6) {
    return `${zoom.toExponential(2)}×`;
  }
  if (zoom >= 1000) {
    return `${Math.round(zoom).toLocaleString()}×`;
  }
  return `${zoom.toFixed(2)}×`;
}

function getPrecisionLabel() {
  if (view.span < 1e-14) {
    return "Near JS precision limit";
  }
  if (view.span < 1e-10) {
    return "Deep zoom";
  }
  return "Normal";
}

function updateReadouts() {
  outputs.fractalLabel.textContent = currentPreset().label;
  outputs.zoomLabel.textContent = getZoomLabel();
  outputs.iterations.value = getAutoIterations().toLocaleString();
  outputs.center.textContent = `${formatNumber(view.centerX)}, ${formatNumber(view.centerY)}`;
  outputs.span.textContent = formatNumber(view.span);
  outputs.precision.textContent = getPrecisionLabel();
}

function resizeCanvas() {
  const size = Number(controls.resolution.value);
  canvas.width = size;
  canvas.height = size;
  queueRender();
}

function canvasPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function complexFromCanvasPoint(x, y, span = view.span) {
  return {
    x: view.centerX + (x / canvas.width - 0.5) * span,
    y: view.centerY + (y / canvas.height - 0.5) * span,
  };
}

function zoomAtCanvasPoint(x, y, factor) {
  const before = complexFromCanvasPoint(x, y);
  view.span = Math.max(Number.MIN_VALUE, view.span * factor);
  const after = complexFromCanvasPoint(x, y);

  view.centerX += before.x - after.x;
  view.centerY += before.y - after.y;

  queueRender();
}

function panByPixels(deltaX, deltaY) {
  const scale = view.span / canvas.width;
  view.centerX = dragStartView.centerX - deltaX * scale;
  view.centerY = dragStartView.centerY - deltaY * scale;
  queueRender();
}

function resetView() {
  const preset = currentPreset();
  view.centerX = preset.centerX;
  view.centerY = preset.centerY;
  view.span = preset.span;
  queueRender();
}

function queueRender() {
  renderId += 1;
  resetRenderer();
  updateReadouts();
  outputs.status.textContent = "Rendering preview…";

  const common = {
    id: renderId,
    fractalType: controls.fractalType.value,
    palette: controls.palette.value,
    centerX: view.centerX,
    centerY: view.centerY,
    span: view.span,
    maxIterations: getAutoIterations(),
  };

  worker.postMessage({
    ...common,
    phase: "preview",
    width: Math.max(120, Math.round(canvas.width * 0.35)),
    height: Math.max(120, Math.round(canvas.height * 0.35)),
  });

  worker.postMessage({
    ...common,
    phase: "final",
    width: canvas.width,
    height: canvas.height,
  });
}

function drawImageData(message) {
  const imageData = new ImageData(
    new Uint8ClampedArray(message.buffer),
    message.width,
    message.height,
  );

  if (message.width === canvas.width && message.height === canvas.height) {
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  previewCanvas.width = message.width;
  previewCanvas.height = message.height;
  previewCtx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(previewCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function handleWorkerMessage(event) {
  const message = event.data;
  if (message.id !== renderId) {
    return;
  }

  if (message.type === "progress") {
    outputs.status.textContent = `${message.phase === "preview" ? "Preview" : "Rendering"} ${message.percent}%`;
    return;
  }

  if (message.type === "complete") {
    drawImageData(message);
    outputs.status.textContent = message.phase === "preview" ? "Rendering final image…" : "Ready";
  }
}

function savePng() {
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  link.download = `fractal-${controls.fractalType.value}-${stamp}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const point = canvasPointFromEvent(event);
  const factor = event.deltaY < 0 ? 0.5 : 2;
  zoomAtCanvasPoint(point.x, point.y, factor);
}, { passive: false });

canvas.addEventListener("dblclick", (event) => {
  const point = canvasPointFromEvent(event);
  zoomAtCanvasPoint(point.x, point.y, event.shiftKey ? 2 : 0.5);
});

canvas.addEventListener("pointerdown", (event) => {
  isDragging = true;
  dragStart = canvasPointFromEvent(event);
  dragStartView = { centerX: view.centerX, centerY: view.centerY };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDragging) {
    return;
  }
  const point = canvasPointFromEvent(event);
  panByPixels(point.x - dragStart.x, point.y - dragStart.y);
});

canvas.addEventListener("pointerup", (event) => {
  isDragging = false;
  canvas.releasePointerCapture(event.pointerId);
  canvas.classList.remove("is-dragging");
});

canvas.addEventListener("pointerleave", () => {
  if (!isDragging) {
    return;
  }
  isDragging = false;
  canvas.classList.remove("is-dragging");
});

controls.fractalType.addEventListener("change", resetView);
controls.palette.addEventListener("change", queueRender);
controls.resolution.addEventListener("change", resizeCanvas);
controls.iterations.addEventListener("input", queueRender);
controls.autoIterations.addEventListener("change", queueRender);
controls.resetView.addEventListener("click", resetView);
controls.savePng.addEventListener("click", savePng);

updateReadouts();
resizeCanvas();
