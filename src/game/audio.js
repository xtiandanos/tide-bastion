// audio.js — fully procedural soundtrack + SFX via Web Audio API. No files.
// Music: ocean-noise bed with slow swells, a lo-fi pad progression and a
// sparse pentatonic sparkle. SFX: short synthesized cues, rate-limited so
// spammy events (shots, kills) don't turn into mush.

class AudioEngine {
  constructor() {
    this.ctx = null
    this.musicVol = 0.5
    this.sfxVol = 0.7
    this.muted = false
    this.lastPlayed = {}
    this.musicTimer = null
    this.chordIdx = 0
  }

  // Must be called from a user gesture (the Start button).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.musicGain = this.ctx.createGain()
    this.sfxGain = this.ctx.createGain()
    this.musicGain.connect(this.master)
    this.sfxGain.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.applyVolumes()
    this.startMusic()
  }

  applyVolumes() {
    if (!this.ctx) return
    const mute = this.muted ? 0 : 1
    this.master.gain.value = mute
    this.musicGain.gain.value = this.musicVol
    this.sfxGain.gain.value = this.sfxVol
  }

  setMusicVolume(v) {
    this.musicVol = v
    this.applyVolumes()
  }

  setSfxVolume(v) {
    this.sfxVol = v
    this.applyVolumes()
  }

  setMuted(m) {
    this.muted = m
    this.applyVolumes()
  }

  // ---------------------------------------------------------------- music

  startMusic() {
    if (!this.ctx || this.musicTimer) return

    // ocean bed: looped noise through a low-pass, breathing with an LFO
    const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const ocean = this.ctx.createBufferSource()
    ocean.buffer = noiseBuf
    ocean.loop = true
    const oceanFilter = this.ctx.createBiquadFilter()
    oceanFilter.type = 'lowpass'
    oceanFilter.frequency.value = 320
    const oceanGain = this.ctx.createGain()
    oceanGain.gain.value = 0.05
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 0.035
    lfo.connect(lfoGain)
    lfoGain.connect(oceanGain.gain)
    ocean.connect(oceanFilter)
    oceanFilter.connect(oceanGain)
    oceanGain.connect(this.musicGain)
    ocean.start()
    lfo.start()

    // lo-fi pad progression: Am — F — G — Em, one chord every ~5s
    const CHORDS = [
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [196.0, 246.94, 293.66], // G
      [164.81, 196.0, 246.94], // Em
    ]
    const PENTATONIC = [440.0, 523.25, 587.33, 659.25, 783.99]

    // sparkle echo
    this.echo = this.ctx.createDelay(1)
    this.echo.delayTime.value = 0.4
    const echoGain = this.ctx.createGain()
    echoGain.gain.value = 0.35
    this.echo.connect(echoGain)
    echoGain.connect(this.echo)
    echoGain.connect(this.musicGain)

    const scheduleChord = () => {
      if (!this.ctx) return
      const t = this.ctx.currentTime
      const chord = CHORDS[this.chordIdx % CHORDS.length]
      this.chordIdx++

      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq * (1 + (i - 1) * 0.0006) // gentle detune
        const g = this.ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.045, t + 1.6)
        g.gain.setValueAtTime(0.045, t + 3.4)
        g.gain.linearRampToValueAtTime(0, t + 5.2)
        osc.connect(g)
        g.connect(this.musicGain)
        osc.start(t)
        osc.stop(t + 5.3)
      })

      // sub bass root
      const bass = this.ctx.createOscillator()
      bass.type = 'sine'
      bass.frequency.value = chord[0] / 2
      const bg = this.ctx.createGain()
      bg.gain.setValueAtTime(0, t)
      bg.gain.linearRampToValueAtTime(0.06, t + 1.4)
      bg.gain.linearRampToValueAtTime(0, t + 5)
      bass.connect(bg)
      bg.connect(this.musicGain)
      bass.start(t)
      bass.stop(t + 5.1)

      this.musicTimer = setTimeout(scheduleChord, 4800)
    }
    scheduleChord()

    // sparse sparkle arpeggio
    this.sparkleTimer = setInterval(() => {
      if (!this.ctx || Math.random() < 0.45) return
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)]
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.035, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
      osc.connect(g)
      g.connect(this.musicGain)
      g.connect(this.echo)
      osc.start(t)
      osc.stop(t + 1.5)
    }, 1400)
  }

  // ---------------------------------------------------------------- sfx

  tone({ freq, end = freq, type = 'sine', dur = 0.15, vol = 0.2, delay = 0 }) {
    if (!this.ctx) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.sfxGain)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  noiseBurst({ dur = 0.25, vol = 0.25, freq = 400, type = 'lowpass' }) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur))
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.sfxGain)
    src.start(t)
  }

  // Rate-limited dispatch — game events can fire many times per second.
  play(name) {
    if (!this.ctx || this.muted) return
    const now = performance.now()
    const MIN_GAP = {
      shot: 70,
      kill: 60,
      freeze: 120,
      launch: 90,
      zap: 90,
      boom: 80,
    }
    const gap = MIN_GAP[name] ?? 40
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return
    this.lastPlayed[name] = now

    switch (name) {
      case 'place':
        this.tone({ freq: 200, end: 110, type: 'triangle', dur: 0.18, vol: 0.3 })
        this.noiseBurst({ dur: 0.08, vol: 0.1, freq: 900 })
        break
      case 'upgrade':
        this.tone({ freq: 660, type: 'sine', dur: 0.14, vol: 0.22 })
        this.tone({ freq: 990, type: 'sine', dur: 0.2, vol: 0.22, delay: 0.1 })
        break
      case 'sell':
        this.tone({ freq: 1200, end: 800, type: 'square', dur: 0.09, vol: 0.12 })
        this.tone({ freq: 900, end: 600, type: 'square', dur: 0.12, vol: 0.12, delay: 0.08 })
        break
      case 'shot':
        this.tone({ freq: 240, end: 120, type: 'triangle', dur: 0.07, vol: 0.1 })
        break
      case 'freeze':
        this.tone({ freq: 1500, end: 2200, type: 'sine', dur: 0.12, vol: 0.08 })
        break
      case 'launch':
        this.noiseBurst({ dur: 0.2, vol: 0.14, freq: 600, type: 'bandpass' })
        break
      case 'zap':
        this.tone({ freq: 1800, end: 150, type: 'sawtooth', dur: 0.12, vol: 0.12 })
        break
      case 'boom':
        this.noiseBurst({ dur: 0.3, vol: 0.2, freq: 300 })
        this.tone({ freq: 90, end: 40, type: 'sine', dur: 0.25, vol: 0.25 })
        break
      case 'kill':
        this.tone({ freq: 320, end: 90, type: 'square', dur: 0.08, vol: 0.1 })
        break
      case 'leak':
        this.tone({ freq: 170, type: 'sawtooth', dur: 0.25, vol: 0.2 })
        this.tone({ freq: 140, type: 'sawtooth', dur: 0.3, vol: 0.2, delay: 0.15 })
        break
      case 'boss':
        this.tone({ freq: 80, type: 'sawtooth', dur: 0.7, vol: 0.3 })
        this.tone({ freq: 120, end: 90, type: 'sawtooth', dur: 0.6, vol: 0.2, delay: 0.1 })
        break
      case 'wave':
        this.tone({ freq: 330, end: 392, type: 'triangle', dur: 0.35, vol: 0.22 })
        this.tone({ freq: 392, end: 440, type: 'triangle', dur: 0.3, vol: 0.18, delay: 0.2 })
        break
      case 'win':
        ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.22, delay: i * 0.16 }),
        )
        break
      case 'lose':
        ;[392, 330, 262, 196].forEach((f, i) =>
          this.tone({ freq: f, type: 'sawtooth', dur: 0.45, vol: 0.16, delay: i * 0.25 }),
        )
        break
    }
  }
}

export const audio = new AudioEngine()
