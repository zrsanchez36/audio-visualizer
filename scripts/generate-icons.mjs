import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const publicDir = resolve(rootDir, 'public')

mkdirSync(publicDir, { recursive: true })

const palette = {
  bgTop: [18, 26, 49],
  bgBottom: [8, 16, 29],
  vignette: [4, 8, 18],
  teal: [45, 200, 190],
  aqua: [94, 236, 246],
  white: [234, 255, 255],
  violet: [122, 128, 255],
  border: [138, 230, 240],
  barEdge: [34, 189, 178],
  barCenter: [136, 251, 255],
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function mix(a, b, t) {
  return a + (b - a) * t
}

function mixColor(a, b, t) {
  return [
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
  ]
}

function createSurface(width, height) {
  return {
    width,
    height,
    data: new Float32Array(width * height * 4),
  }
}

function blendPixel(surface, x, y, rgb, alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= surface.width || y >= surface.height) return
  const index = (y * surface.width + x) * 4
  const inv = 1 - alpha
  surface.data[index] = rgb[0] / 255 * alpha + surface.data[index] * inv
  surface.data[index + 1] = rgb[1] / 255 * alpha + surface.data[index + 1] * inv
  surface.data[index + 2] = rgb[2] / 255 * alpha + surface.data[index + 2] * inv
  surface.data[index + 3] = alpha + surface.data[index + 3] * inv
}

function fillBackground(surface, inset, radius) {
  const left = inset
  const top = inset
  const right = surface.width - inset
  const bottom = surface.height - inset
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const halfWidth = (right - left) / 2
  const halfHeight = (bottom - top) / 2

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const px = x + 0.5
      const py = y + 0.5
      const qx = Math.abs(px - centerX) - halfWidth + radius
      const qy = Math.abs(py - centerY) - halfHeight + radius
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
      if (outside > 0) continue

      const nx = (px - left) / (right - left)
      const ny = (py - top) / (bottom - top)
      const base = mixColor(palette.bgTop, palette.bgBottom, clamp(ny * 0.82 + nx * 0.18))

      const distCenter = Math.hypot(nx - 0.5, ny - 0.47)
      const vignette = smoothstep(0.16, 0.72, distCenter)
      let color = mixColor(base, palette.vignette, vignette * 0.72)

      const tealAura = clamp(1 - Math.hypot(nx - 0.5, ny - 0.4) / 0.34)
      color = mixColor(color, [18, 78, 88], tealAura * tealAura * 0.42)

      const violetAura = clamp(1 - Math.hypot(nx - 0.79, ny - 0.16) / 0.32)
      color = mixColor(color, palette.violet, violetAura * 0.18)

      blendPixel(surface, x, y, color, 1)
    }
  }
}

function drawRoundedStroke(surface, x, y, width, height, radius, thickness, rgb, alpha) {
  const outerCx = x + width / 2
  const outerCy = y + height / 2
  const outerHw = width / 2
  const outerHh = height / 2
  const innerX = x + thickness
  const innerY = y + thickness
  const innerW = width - thickness * 2
  const innerH = height - thickness * 2
  const innerCx = innerX + innerW / 2
  const innerCy = innerY + innerH / 2
  const innerHw = innerW / 2
  const innerHh = innerH / 2
  const innerRadius = Math.max(0, radius - thickness)
  const startX = Math.floor(x)
  const startY = Math.floor(y)
  const endX = Math.ceil(x + width)
  const endY = Math.ceil(y + height)

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      const sx = px + 0.5
      const sy = py + 0.5
      const oqx = Math.abs(sx - outerCx) - outerHw + radius
      const oqy = Math.abs(sy - outerCy) - outerHh + radius
      const iqx = Math.abs(sx - innerCx) - innerHw + innerRadius
      const iqy = Math.abs(sy - innerCy) - innerHh + innerRadius
      const outsideOuter = Math.hypot(Math.max(oqx, 0), Math.max(oqy, 0)) + Math.min(Math.max(oqx, oqy), 0) - radius
      const outsideInner = Math.hypot(Math.max(iqx, 0), Math.max(iqy, 0)) + Math.min(Math.max(iqx, iqy), 0) - innerRadius
      if (outsideOuter <= 0 && outsideInner > 0) blendPixel(surface, px, py, rgb, alpha)
    }
  }
}

function drawRadialGlow(surface, cx, cy, radius, rgb, alpha) {
  const startX = Math.floor(cx - radius)
  const startY = Math.floor(cy - radius)
  const endX = Math.ceil(cx + radius)
  const endY = Math.ceil(cy + radius)

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (dist >= radius) continue
      const falloff = 1 - dist / radius
      blendPixel(surface, x, y, rgb, alpha * falloff * falloff)
    }
  }
}

function drawRoundedRect(surface, x, y, width, height, radius, colorAt, alphaAt) {
  const cx = x + width / 2
  const cy = y + height / 2
  const halfWidth = width / 2
  const halfHeight = height / 2
  const startX = Math.floor(x)
  const startY = Math.floor(y)
  const endX = Math.ceil(x + width)
  const endY = Math.ceil(y + height)

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      const sx = px + 0.5
      const sy = py + 0.5
      const qx = Math.abs(sx - cx) - halfWidth + radius
      const qy = Math.abs(sy - cy) - halfHeight + radius
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
      if (outside > 0) continue
      const rgb = colorAt(sx, sy)
      const alpha = alphaAt ? alphaAt(sx, sy) : 1
      blendPixel(surface, px, py, rgb, alpha)
    }
  }
}

function drawBars(surface, size) {
  const centerX = surface.width / 2
  const centerY = surface.height * 0.55
  const barWidth = size * 0.084
  const gap = size * 0.026
  const heights = [size * 0.21, size * 0.34, size * 0.5, size * 0.34, size * 0.21]
  const totalWidth = barWidth * heights.length + gap * (heights.length - 1)
  const startX = centerX - totalWidth / 2

  heights.forEach((height, index) => {
    const x = startX + index * (barWidth + gap)
    const y = centerY - height / 2
    const centerBias = 1 - Math.abs(index - 2) / 2.5

    drawRadialGlow(
      surface,
      x + barWidth / 2,
      centerY,
      height * 0.62,
      mixColor(palette.teal, palette.aqua, centerBias * 0.4),
      0.08 + centerBias * 0.06,
    )

    drawRoundedRect(
      surface,
      x,
      y,
      barWidth,
      height,
      barWidth / 2,
      (_px, py) => {
        const t = clamp((py - y) / height)
        const centerGlow = 1 - Math.abs(t - 0.5) * 2
        return mixColor(
          palette.barEdge,
          palette.barCenter,
          Math.pow(clamp(centerGlow), 0.75),
        )
      },
      (_px, py) => {
        const t = clamp((py - y) / height)
        const centerGlow = 1 - Math.abs(t - 0.5) * 2
        return 0.92 + Math.pow(clamp(centerGlow), 1.3) * 0.08
      },
    )
  })
}

function stampGlow(surface, cx, cy, radius, rgb, alpha) {
  const startX = Math.floor(cx - radius)
  const startY = Math.floor(cy - radius)
  const endX = Math.ceil(cx + radius)
  const endY = Math.ceil(cy + radius)

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (dist >= radius) continue
      const falloff = 1 - dist / radius
      blendPixel(surface, x, y, rgb, alpha * Math.pow(falloff, 1.6))
    }
  }
}

function drawWave(surface, size, simplified) {
  if (simplified) return

  const startX = surface.width * 0.23
  const endX = surface.width * 0.8
  const centerY = surface.height * 0.55
  const amplitude = size * 0.078
  const points = []

  for (let i = 0; i <= 84; i += 1) {
    const t = i / 84
    const x = mix(startX, endX, t)
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.72)
    const y = centerY + Math.sin((t * 2.1 - 0.6) * Math.PI) * amplitude * (0.48 + envelope * 0.62)
    points.push([x, y])
  }

  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1]
    const [x2, y2] = points[i]
    const length = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.max(2, Math.ceil(length / (size * 0.0065)))

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps
      const x = mix(x1, x2, t)
      const y = mix(y1, y2, t)
      stampGlow(surface, x, y, size * 0.03, palette.aqua, 0.08)
      stampGlow(surface, x, y, size * 0.014, palette.white, 0.88)
    }
  }
}

function addHighlights(surface, size) {
  drawRadialGlow(surface, surface.width * 0.74, surface.height * 0.2, size * 0.18, palette.violet, 0.11)
  drawRadialGlow(surface, surface.width * 0.5, surface.height * 0.42, size * 0.26, palette.teal, 0.1)
  drawRoundedStroke(
    surface,
    surface.width * 0.07,
    surface.height * 0.07,
    surface.width * 0.86,
    surface.height * 0.86,
    size * 0.2,
    Math.max(2, size * 0.0035),
    palette.border,
    0.1,
  )
}

function clearOutsideRoundedRect(surface, inset, radius) {
  const left = inset
  const top = inset
  const right = surface.width - inset
  const bottom = surface.height - inset
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const halfWidth = (right - left) / 2
  const halfHeight = (bottom - top) / 2

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const px = x + 0.5
      const py = y + 0.5
      const qx = Math.abs(px - centerX) - halfWidth + radius
      const qy = Math.abs(py - centerY) - halfHeight + radius
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
      if (outside <= 0) continue
      const index = (y * surface.width + x) * 4
      surface.data[index] = 0
      surface.data[index + 1] = 0
      surface.data[index + 2] = 0
      surface.data[index + 3] = 0
    }
  }
}

function downsample(surface, scale) {
  const outWidth = Math.floor(surface.width / scale)
  const outHeight = Math.floor(surface.height / scale)
  const out = new Uint8Array(outWidth * outHeight * 4)

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const index = ((y * scale + sy) * surface.width + (x * scale + sx)) * 4
          r += surface.data[index]
          g += surface.data[index + 1]
          b += surface.data[index + 2]
          a += surface.data[index + 3]
        }
      }

      const samples = scale * scale
      r /= samples
      g /= samples
      b /= samples
      a /= samples

      const outIndex = (y * outWidth + x) * 4
      if (a > 0.0001) {
        out[outIndex] = Math.round(clamp(r / a) * 255)
        out[outIndex + 1] = Math.round(clamp(g / a) * 255)
        out[outIndex + 2] = Math.round(clamp(b / a) * 255)
        out[outIndex + 3] = Math.round(clamp(a) * 255)
      }
    }
  }

  return { width: outWidth, height: outHeight, data: out }
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const chunk = Buffer.alloc(8 + data.length + 4)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  const crc = crc32(Buffer.concat([typeBuffer, data]))
  chunk.writeUInt32BE(crc, 8 + data.length)
  return chunk
}

function encodePng(image) {
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(image.width, 0)
  ihdr.writeUInt32BE(image.height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = image.width * 4
  const raw = Buffer.alloc((stride + 1) * image.height)
  for (let y = 0; y < image.height; y += 1) {
    raw[y * (stride + 1)] = 0
    Buffer.from(image.data.buffer, image.data.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    )
  }

  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    header,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function createIco(images) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const directory = Buffer.alloc(count * 16)
  let offset = 6 + count * 16

  images.forEach((image, index) => {
    const size = index * 16
    directory[size] = image.width >= 256 ? 0 : image.width
    directory[size + 1] = image.height >= 256 ? 0 : image.height
    directory[size + 2] = 0
    directory[size + 3] = 0
    directory.writeUInt16LE(1, size + 4)
    directory.writeUInt16LE(32, size + 6)
    directory.writeUInt32LE(image.data.length, size + 8)
    directory.writeUInt32LE(offset, size + 12)
    offset += image.data.length
  })

  return Buffer.concat([header, directory, ...images.map((image) => image.data)])
}

function renderIcon(targetSize, { simplified = false } = {}) {
  const scale = targetSize >= 256 ? 2 : 4
  const size = targetSize * scale
  const surface = createSurface(size, size)
  const inset = size * 0.07
  const radius = size * 0.2

  fillBackground(surface, inset, radius)
  addHighlights(surface, size)
  drawRadialGlow(surface, size * 0.5, size * 0.43, size * 0.17, palette.teal, 0.09)
  drawBars(surface, size)
  drawWave(surface, size, simplified)
  drawRoundedStroke(surface, inset, inset, size - inset * 2, size - inset * 2, radius, Math.max(2, size * 0.004), [118, 132, 182], 0.2)
  clearOutsideRoundedRect(surface, inset, radius)

  return downsample(surface, scale)
}

function writePng(filename, image) {
  const buffer = encodePng(image)
  writeFileSync(resolve(publicDir, filename), buffer)
  return buffer
}

const app1024 = renderIcon(1024)
const app512 = renderIcon(512)
const app192 = renderIcon(192)
const apple180 = renderIcon(180)
const favicon32 = renderIcon(32, { simplified: true })
const favicon16 = renderIcon(16, { simplified: true })

writePng('icon-1024.png', app1024)
writePng('icon-512.png', app512)
writePng('icon-192.png', app192)
writePng('apple-touch-icon.png', apple180)

const favicon32Buffer = writePng('favicon-32x32.png', favicon32)
const favicon16Buffer = writePng('favicon-16x16.png', favicon16)

const ico = createIco([
  { width: 16, height: 16, data: favicon16Buffer },
  { width: 32, height: 32, data: favicon32Buffer },
])

writeFileSync(resolve(publicDir, 'favicon.ico'), ico)
