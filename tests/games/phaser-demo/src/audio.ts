/**
 * Procedural Web Audio synthesizer for Phaser 3 demo.
 * Zero external audio files; 100% synthesized via Web Audio API oscillators.
 */

export class SynthAudio {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor(context?: AudioContext | null) {
    if (context) {
      this.ctx = context;
    }
  }

  public setContext(context: AudioContext | null): void {
    this.ctx = context;
  }

  public async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Ignore audio resume errors if blocked by browser policy
      }
    }
  }

  public jump(): void {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      // Rising frequency sweep for snappy arcade jump
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);

      // Amplitude envelope
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // Audio node failure fallback
    }
  }

  public pickup(): void {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;

    try {
      const now = this.ctx.currentTime;
      // Arpeggio note 1 (E6 - 1318.5 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      // Arpeggio note 2 (higher bell chime)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.07); // E6
      gain2.gain.setValueAtTime(0.22, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.22);

      osc1.onended = () => {
        osc1.disconnect();
        gain1.disconnect();
      };
      osc2.onended = () => {
        osc2.disconnect();
        gain2.disconnect();
      };
    } catch {
      // Audio node failure fallback
    }
  }

  public bump(): void {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      // Downward frequency sweep for impact/rebound
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // Audio node failure fallback
    }
  }

  public destroy(): void {
    this.ctx = null;
  }
}
