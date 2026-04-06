import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Upload, Music,
} from 'lucide-react'
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer'
import { useCanvasAnimation, type VisualMode } from './hooks/useCanvasAnimation'

// ─── Canvas ──────────────────────────────────────────────────────────────────
function Visualizer({
  getFrequencyData, getTimeDomainData, getBassEnergy, isPlaying, mode,
}: {
  getFrequencyData: () => Uint8Array | null
  getTimeDomainData: () => Uint8Array | null
  getBassEnergy: () => number
  isPlaying: boolean
  mode: VisualMode
}) {
  const { canvasRef, startAnimation, stopAnimation, resizeCanvas } = useCanvasAnimation({
    getFrequencyData, getTimeDomainData, getBassEnergy, isPlaying, mode,
  })

  useEffect(() => {
    resizeCanvas()
    startAnimation()
    const onResize = () => resizeCanvas()
    window.addEventListener('resize', onResize)
    return () => { stopAnimation(); window.removeEventListener('resize', onResize) }
  }, [startAnimation, stopAnimation, resizeCanvas])

  return (
    <div style={{
      position: 'relative', width: '100%', borderRadius: 12,
      overflow: 'hidden', border: '1px solid var(--border)',
      background: '#0a0b12',
    }}>
      {/* Top/bottom fade overlays */}
      <div style={{ position: 'absolute', inset: '0 0 auto', height: 36,
        background: 'linear-gradient(to bottom, #0a0b12, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 'auto 0 0', height: 36,
        background: 'linear-gradient(to top, #0a0b12, transparent)', zIndex: 1, pointerEvents: 'none' }} />

      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 'clamp(200px, 38vw, 300px)', display: 'block' }}
        aria-label="Audio visualizer"
      />

      {!isPlaying && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 2,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'rgba(107,114,128,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Press play to visualize
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Track info ───────────────────────────────────────────────────────────────
interface TrackMeta { name: string; size: string }

function TrackDisplay({ track }: { track: TrackMeta | null }) {
  return (
    <div style={{ textAlign: 'center', minHeight: 52 }}>
      {track ? (
        <>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--primary)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            Now Playing
          </p>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400, margin: '0 auto 4px' }}>
            {track.name}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            {track.size}
          </p>
        </>
      ) : (
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>No track loaded</p>
      )}
    </div>
  )
}

// ─── Drop zone ────────────────────────────────────────────────────────────────
function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) onFile(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        width: '100%', padding: '28px 20px', borderRadius: 12, cursor: 'pointer',
        border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
        background: dragging ? 'rgba(45,200,190,0.05)' : 'var(--bg-card)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        transition: 'all 0.2s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <Upload size={22} color={dragging ? 'var(--primary)' : 'var(--muted)'} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: dragging ? 'var(--primary)' : 'var(--fg)', fontWeight: 500 }}>
          Drop an audio file here
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          or click to browse — MP3, WAV, FLAC, M4A supported
        </p>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(s: number) {
  if (!isFinite(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const MODES: { value: VisualMode; label: string }[] = [
  { value: 'bars',      label: 'Bars'      },
  { value: 'wave',      label: 'Wave'      },
  { value: 'hybrid',    label: 'Hybrid'    },
  { value: 'pulse',     label: 'Pulse'     },
  { value: 'particles', label: 'Particles' },
]

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const audioRef    = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(0)
  const [volume, setVolume]           = useState(0.8)
  const [mode, setMode]               = useState<VisualMode>('hybrid')
  const [track, setTrack]             = useState<TrackMeta | null>(null)
  const [connected, setConnected]     = useState(false)
  const [objectUrl, setObjectUrl]     = useState<string | null>(null)

  const { connectAudio, getFrequencyData, getTimeDomainData, getBassEnergy, disconnect } = useAudioAnalyzer()

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Cleanup object URL on unmount
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }, [objectUrl])
  useEffect(() => () => { disconnect() }, [disconnect])

  const loadFile = useCallback((file: File) => {
    const audio = audioRef.current
    if (!audio) return
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    audio.pause()
    setIsPlaying(false)
    setCurrentTime(0)
    setConnected(false)
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    audio.src = url
    audio.load()
    // Strip extension for display name
    const name = file.name.replace(/\.[^.]+$/, '')
    setTrack({ name, size: fmtSize(file.size) })
  }, [objectUrl])

  const handlePlayPause = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !track) return
    if (!connected) { connectAudio(audio); setConnected(true) }
    if (isPlaying) {
      audio.pause()
    } else {
      try { await audio.play() } catch (e) { console.error(e) }
    }
  }, [isPlaying, connected, connectAudio, track])

  const handleSeek = (val: number) => {
    if (audioRef.current) { audioRef.current.currentTime = val; setCurrentTime(val) }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Global drag-over on the window
  const [globalDrag, setGlobalDrag] = useState(false)
  useEffect(() => {
    const over  = (e: DragEvent) => { e.preventDefault(); setGlobalDrag(true) }
    const leave = () => setGlobalDrag(false)
    const drop  = (e: DragEvent) => {
      e.preventDefault(); setGlobalDrag(false)
      const f = e.dataTransfer?.files[0]
      if (f && f.type.startsWith('audio/')) loadFile(f)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }, [loadFile])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: 28 }}>

      {/* Global drag overlay */}
      {globalDrag && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(45,200,190,0.08)',
          border: '3px dashed var(--primary)', zIndex: 999, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--primary)', letterSpacing: '0.1em' }}>
            Drop to load
          </p>
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
          <Music size={18} color="var(--primary)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Audio Visualizer
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          by Zsoreign Sanchez
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Track info */}
        <TrackDisplay track={track} />

        {/* Canvas */}
        <Visualizer
          getFrequencyData={getFrequencyData}
          getTimeDomainData={getTimeDomainData}
          getBassEnergy={getBassEnergy}
          isPlaying={isPlaying}
          mode={mode}
        />

        {/* Progress bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 44, display: 'flex', alignItems: 'center' }}>
            <input
              type="range" min={0} max={100} value={progress}
              onChange={(e) => handleSeek((parseFloat(e.target.value) / 100) * duration)}
              disabled={!track}
              style={{
                width: '100%', height: 4, borderRadius: 2,
                background: `linear-gradient(to right, var(--primary) ${progress}%, var(--bg-sec) ${progress}%)`,
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Transport */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <button
            onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; setCurrentTime(0) } }}
            disabled={!track}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', color: track ? 'var(--muted)' : 'var(--border)', transition: 'color 0.2s' }}
            aria-label="Restart"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={handlePlayPause}
            disabled={!track}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: track ? 'var(--primary)' : 'var(--bg-sec)',
              color: track ? 'var(--primary-fg)' : 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', transform: 'scale(1)',
              boxShadow: track ? '0 0 24px rgba(45,200,190,0.25)' : 'none',
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={26} /> : <Play size={26} style={{ marginLeft: 2 }} />}
          </button>

          <button
            onClick={() => { if (audioRef.current && duration) { audioRef.current.currentTime = duration; setCurrentTime(duration) } }}
            disabled={!track}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', color: track ? 'var(--muted)' : 'var(--border)', transition: 'color 0.2s' }}
            aria-label="End"
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setVolume(v => v === 0 ? 0.8 : 0)}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted)', flexShrink: 0 }}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <div style={{ flex: 1, height: 36, display: 'flex', alignItems: 'center' }}>
            <input
              type="range" min={0} max={1} step={0.01} value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{
                width: '100%', height: 4, borderRadius: 2,
                background: `linear-gradient(to right, var(--primary) ${volume * 100}%, var(--bg-sec) ${volume * 100}%)`,
              }}
              aria-label="Volume"
            />
          </div>
        </div>

        {/* Mode selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              style={{
                height: 36, borderRadius: 8, fontSize: 12,
                fontFamily: 'var(--font-mono)',
                border: `1px solid ${mode === m.value ? 'var(--primary)' : 'var(--border)'}`,
                background: mode === m.value ? 'var(--primary)' : 'transparent',
                color: mode === m.value ? 'var(--primary-fg)' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <DropZone onFile={loadFile} />

      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Footer */}
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
        Built with React + Web Audio API + Canvas
      </p>
    </div>
  )
}
