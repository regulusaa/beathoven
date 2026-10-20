import { frequency } from './music.js';

export class PianoAudio {
  constructor() {
    this.context = null;
    this.voices = new Map();
    this.enabled = true;
  }

  async unlock() {
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === 'suspended') await this.context.resume();
  }

  async start(midi) {
    if (!this.enabled) return;
    await this.unlock();
    this.stop(midi);
    const ctx = this.context;
    const now = ctx.currentTime;
    const output = ctx.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(0.24, now + .012);
    output.gain.exponentialRampToValueAtTime(0.09, now + .42);
    output.connect(ctx.destination);
    const oscillators = [
      { type: 'triangle', ratio: 1, gain: .75 },
      { type: 'sine', ratio: 2, gain: .18 },
      { type: 'sine', ratio: 3, gain: .07 }
    ].map(partial => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = partial.type;
      oscillator.frequency.value = frequency(midi) * partial.ratio;
      gain.gain.value = partial.gain;
      oscillator.connect(gain).connect(output);
      oscillator.start(now);
      return oscillator;
    });
    this.voices.set(midi, { output, oscillators });
  }

  async preview(midi) {
    if (!this.enabled) return;
    await this.unlock();
    const ctx = this.context;
    const now = ctx.currentTime;
    const output = ctx.createGain();
    output.gain.setValueAtTime(.0001,now);
    output.gain.exponentialRampToValueAtTime(.18,now + .015);
    output.gain.exponentialRampToValueAtTime(.0001,now + .65);
    const oscillator = ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency(midi);
    oscillator.connect(output).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + .67);
    oscillator.onended = () => output.disconnect();
  }

  stop(midi) {
    const voice = this.voices.get(midi);
    if (!voice || !this.context) return;
    const now = this.context.currentTime;
    voice.output.gain.cancelScheduledValues(now);
    voice.output.gain.setValueAtTime(Math.max(voice.output.gain.value, .0001), now);
    voice.output.gain.exponentialRampToValueAtTime(.0001, now + .28);
    voice.oscillators.forEach(oscillator => oscillator.stop(now + .3));
    this.voices.delete(midi);
  }

  stopAll() { for (const midi of this.voices.keys()) this.stop(midi); }
}
