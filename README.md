# Audio Visualizer

Real-time audio visualizer built with React, Web Audio API, and Canvas. Drop in any audio file and watch it react. Five visual modes: Bars, Wave, Hybrid, Pulse, and Particles.

**By [Zsoreign Sanchez](https://github.com/zrsanchez36)**

---

## Requirements

Before you start, make sure you have the following installed:

- **Node.js** v18 or higher — [Download here](https://nodejs.org/)
- **npm** v9 or higher (comes with Node.js)
- A modern browser — Chrome, Firefox, or Edge recommended. Safari works but has limited audio format support.

To check your versions:
```bash
node -v
npm -v
```

---

## Installation

**1. Clone the repository**
```bash
git clone https://github.com/zrsanchez36/audio-visualizer.git
cd audio-visualizer
```

Or download the ZIP from GitHub and unzip it, then open the folder in your terminal.

**2. Install dependencies**
```bash
npm install
```

**3. Start the dev server**
```bash
npm run dev
```

**4. Open your browser**

Go to [http://localhost:5173](http://localhost:5173) — you should see the visualizer. Drop any audio file onto the page to get started.

---

## Supported Audio Formats

| Format | Chrome | Firefox | Safari |
|--------|--------|---------|--------|
| MP3    | ✅     | ✅      | ✅     |
| WAV    | ✅     | ✅      | ✅     |
| M4A    | ✅     | ✅      | ✅     |
| FLAC   | ✅     | ✅      | ⚠️ limited |
| OGG    | ✅     | ✅      | ❌     |

**MP3 and WAV are the safest choices across all browsers.**

---

## Visual Modes

| Mode | Description |
|------|-------------|
| **Bars** | Mirrored frequency bars growing from the center — teal on bass, cyan on highs |
| **Wave** | Double-pass neon waveform with bloom glow |
| **Hybrid** | Bars + wave layered with ambient particles drifting in the background |
| **Pulse** | Bass-reactive expanding rings with a breathing center orb |
| **Particles** | Slow ambient drift with an aurora teal-to-violet palette |

---

## Build for Production

```bash
npm run build
```

Output is in the `dist/` folder — plain static files you can host anywhere.

**Deploy options:**
- [Netlify](https://netlify.com) — drag and drop the `dist/` folder
- [Vercel](https://vercel.com) — connect your GitHub repo
- [GitHub Pages](https://pages.github.com) — push `dist/` to a `gh-pages` branch

---

## Stack

- [React 18](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [lucide-react](https://lucide.dev/)

---

## Troubleshooting

**Audio doesn't play on iPhone/iOS Safari**
Audio context requires a user tap before it activates on iOS. Tap the play button — if it doesn't respond the first time, tap once more.

**Particles appear in the wrong position**
This was a known HiDPI/retina bug that has been fixed. If you see it, make sure you're on the latest version.

**Large WAV files are slow to seek**
WAV is uncompressed — a long track can be several hundred MB in memory. It will still work, seeking may just take a moment.

**`npm install` fails**
Make sure you're running Node.js v18 or higher. Run `node -v` to check.
