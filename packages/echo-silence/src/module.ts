import type { SilenceState } from './types.js';

export const echo_silence_module = {
  id: 'echo-silence',
  name: 'EchoSilence',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['timer', 'audio', 'telemetry:read'] as const,
  description: 'Meditation and silence companion with personalized quiet spaces',
};

export class EchoSilence {
  private state: SilenceState = {
    active: false,
    sessionDurationSec: 0,
    breathCount: 0,
    ambientLevel: 'silent',
    streakDays: 0,
    lastSessionAt: null,
  };
  private _bus: unknown;
  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(bus?: unknown) {
    this._bus = bus;
  }

  async init(): Promise<void> {
    /* no-op */
  }

  startSession(ambientLevel: SilenceState['ambientLevel'] = 'silent'): void {
    this.state.active = true;
    this.state.ambientLevel = ambientLevel;
    this.state.sessionDurationSec = 0;
    this.state.breathCount = 0;
    this._timer = setInterval(() => {
      this.state.sessionDurationSec++;
    }, 1000);
    this.emit('echo-silence:session-started', { ambientLevel });
  }

  recordBreath(): void {
    this.state.breathCount++;
  }

  endSession(): void {
    if (this._timer) clearInterval(this._timer);
    this.state.active = false;
    this.state.lastSessionAt = Date.now();
    this.updateStreak();
    this.emit('echo-silence:session-ended', {
      duration: this.state.sessionDurationSec,
      breaths: this.state.breathCount,
    });
  }

  private updateStreak(): void {
    const now = Date.now();
    const dayMs = 86400000;
    if (this.state.lastSessionAt && now - this.state.lastSessionAt < dayMs * 2) {
      this.state.streakDays++;
    } else {
      this.state.streakDays = 1;
    }
  }

  getState(): SilenceState {
    return { ...this.state };
  }

  async destroy(): Promise<void> {
    if (this._timer) clearInterval(this._timer);
  }

  private emit(type: string, data: unknown): void {
    if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (...args: unknown[]) => void)({
          type,
          data,
          source: 'echo-silence',
        });
      }
    }
  }
}

export function createEchoSilenceModule(bus?: unknown): EchoSilence {
  return new EchoSilence(bus);
}
