import { useRef, useCallback } from 'react'

export interface UseAudioAnalyzerReturn {
  connectAudio: (audio: HTMLAudioElement) => void
  getFrequencyData: () => Uint8Array | null
  getTimeDomainData: () => Uint8Array | null
  getAverageVolume: () => number
  getBassEnergy: () => number
  disconnect: () => void
}

export function useAudioAnalyzer(): UseAudioAnalyzerReturn {
  const ctxRef      = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null)
  const connectedEl = useRef<HTMLAudioElement | null>(null)
  const freqBuf     = useRef<Uint8Array | null>(null)
  const timeBuf     = useRef<Uint8Array | null>(null)

  const connectAudio = useCallback((audio: HTMLAudioElement) => {
    if (connectedEl.current === audio && analyserRef.current) return

    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    try { sourceRef.current?.disconnect() } catch {}

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.82

    const source = ctx.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(ctx.destination)

    analyserRef.current = analyser
    sourceRef.current   = source
    connectedEl.current = audio
    freqBuf.current     = new Uint8Array(analyser.frequencyBinCount)
    timeBuf.current     = new Uint8Array(analyser.fftSize)
  }, [])

  const getFrequencyData = useCallback((): Uint8Array | null => {
    if (!analyserRef.current || !freqBuf.current) return null
    analyserRef.current.getByteFrequencyData(freqBuf.current)
    return freqBuf.current
  }, [])

  const getTimeDomainData = useCallback((): Uint8Array | null => {
    if (!analyserRef.current || !timeBuf.current) return null
    analyserRef.current.getByteTimeDomainData(timeBuf.current)
    return timeBuf.current
  }, [])

  const getAverageVolume = useCallback((): number => {
    const d = getFrequencyData()
    if (!d) return 0
    return d.reduce((a, b) => a + b, 0) / d.length / 255
  }, [getFrequencyData])

  const getBassEnergy = useCallback((): number => {
    const d = getFrequencyData()
    if (!d) return 0
    const bass = d.slice(0, Math.floor(d.length * 0.1))
    return bass.reduce((a, b) => a + b, 0) / bass.length / 255
  }, [getFrequencyData])

  const disconnect = useCallback(() => {
    try { sourceRef.current?.disconnect(); analyserRef.current?.disconnect(); ctxRef.current?.close() } catch {}
    ctxRef.current = analyserRef.current = sourceRef.current = connectedEl.current = freqBuf.current = timeBuf.current = null
  }, [])

  return { connectAudio, getFrequencyData, getTimeDomainData, getAverageVolume, getBassEnergy, disconnect }
}
