# Audio Visualizer

A reactive audio visualizer built with React, the Web Audio API, and Canvas.  
Drop any audio file in and watch it come alive.

**By [Zsoreign Sanchez](https://github.com/zrsanchez36)**

---

## Features

- **Drag & drop** any audio file (MP3, WAV, FLAC, M4A) — or click to browse
- **5 visual modes:**
  - **Bars** — mirrored frequency bars that grow from the center, colored teal → cyan by frequency
  - **Wave** — double-pass neon waveform with bloom glow
  - **Hybrid** — bars + wave layered with ambient particles in the background
  - **Pulse** — bass-reactive expanding rings with a breathing center orb
  - **Particles** — slow ambient drift, teal → violet aurora palette, frequency-reactive color and size
- Full transport controls: play/pause, seek, volume, restart
- Retina/HiDPI canvas rendering
- Mobile-friendly layout

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) and drop an audio file in.

## Build

```bash
npm run build
```

Output goes to `dist/` — deploy anywhere (Netlify, Vercel, GitHub Pages, etc.)

## Stack

- [React 18](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [lucide-react](https://lucide.dev/) for icons

## How it works

Audio is loaded via `createObjectURL`, connected to an `AudioContext`, and routed through an `AnalyserNode`. Every animation frame, frequency and time-domain data is read and drawn onto a `<canvas>` element via `requestAnimationFrame`. All drawing uses `rgba()` colors for full browser compatibility.

The `useAudioAnalyzer` hook manages the Web Audio graph.  
The `useCanvasAnimation` hook owns the draw loop and all visual modes.
