# Fractal Video Generator

A dependency-free browser program for generating animated fractal visuals inspired by looping fractal videos. Open `index.html` in a modern browser to render a continuously morphing Mandelbrot/Julia hybrid on an HTML canvas.

## Features

- Real-time animated Mandelbrot and Julia rendering on a canvas.
- Presets for classic Mandelbrot zooms, electric Julia sets, seahorse valley, and burning-ship-style shapes.
- Controls for palette, iterations, zoom speed, resolution, and glow/trail effects.
- PNG frame export for capturing stills from the animation.
- No build step or package installation required.

## Run locally

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

You can also open `index.html` directly from your file browser.

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml` that publishes the static site to GitHub Pages whenever changes land on `main`.

To enable deployment in GitHub:

1. Open the repository settings.
2. Go to **Pages**.
3. Set **Build and deployment** → **Source** to **GitHub Actions**.
4. Push or merge to `main`, or run the **Deploy GitHub Pages** workflow manually.

## Tips for video-like output

1. Pick the **Seahorse Valley** or **Electric Julia** preset.
2. Set **Quality** to `900x900` or higher if your machine can handle it.
3. Increase **Glow** and **Trail** for a music-video style afterimage.
4. Use screen recording software while the animation plays, or click **Save PNG** to export individual frames.
