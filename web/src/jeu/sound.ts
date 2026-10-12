// Small synthesized match sounds (no audio files). Off until the player turns them on.
type Name = 'swish' | 'clank' | 'thud' | 'whistle' | 'horn' | 'crowd' | 'dribble' | 'pop'

class Sound {
  on = false
  private ac: AudioContext | null = null
  private out: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null

  private init() {
    if (this.ac) return
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return
    const ac = new C()
    this.ac = ac
    this.out = ac.createGain(); this.out.gain.value = 0.55; this.out.connect(ac.destination)
    this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }

  /** Turns sound on or off (must run from a tap so browsers allow audio). */
  toggle() {
    this.init()
    if (!this.ac) return false
    if (this.ac.state === 'suspended') void this.ac.resume()
    this.on = !this.on
    return this.on
  }

  private env(node: AudioNode, t0: number, a: number, peak: number, dur: number) {
    const ac = this.ac!, gn = ac.createGain()
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(peak, t0 + a); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    node.connect(gn); gn.connect(this.out!)
  }
  private tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, f2 = 0) {
    const ac = this.ac!, t = ac.currentTime, o = ac.createOscillator()
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur)
    this.env(o, t, 0.005, vol, dur); o.start(t); o.stop(t + dur + 0.05)
  }
  private noise(dur: number, ft: BiquadFilterType, freq: number, vol: number, q = 1, a = 0.01, delay = 0) {
    const ac = this.ac!, t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter()
    s.buffer = this.noiseBuf; f.type = ft; f.frequency.value = freq; f.Q.value = q; s.connect(f)
    this.env(f, t, a, vol, dur); s.start(t); s.stop(t + dur + 0.05)
  }

  play(n: Name, k = 1) {
    if (!this.on || !this.ac) return
    try {
      switch (n) {
        case 'swish': this.noise(0.32, 'bandpass', 4200, 0.35, 0.8, 0.02); this.noise(0.2, 'highpass', 6500, 0.12, 0.7, 0.01, 0.05); break
        case 'clank': this.tone(520, 0.24, 'triangle', 0.22, 470); this.tone(1310, 0.12, 'square', 0.04); break
        case 'thud': this.tone(150, 0.2, 'sine', 0.5, 55); this.noise(0.09, 'lowpass', 700, 0.3); break
        case 'whistle': {
          const ac = this.ac, t = ac.currentTime, o = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain()
          o.frequency.value = 2950; l.frequency.value = 28; lg.gain.value = 90; l.connect(lg); lg.connect(o.frequency)
          this.env(o, t, 0.01, 0.16, 0.42); o.start(t); l.start(t); o.stop(t + 0.5); l.stop(t + 0.5)
          break
        }
        case 'horn': for (const f of [220, 277, 330]) this.tone(f, 1.2, 'sawtooth', 0.06); break
        case 'crowd': this.noise(1.3 + k * 0.5, 'bandpass', 950, 0.16 * k, 0.6, 0.25); this.noise(1.2, 'lowpass', 420, 0.1 * k, 0.7, 0.3); break
        case 'dribble': this.tone(95, 0.07, 'sine', 0.22, 60); break
        case 'pop': this.tone(760, 0.08, 'sine', 0.14, 1200); break
      }
    } catch {
      // audio graph refused (e.g. tab in background): skip this sound
    }
  }
}

export const sound = new Sound()
