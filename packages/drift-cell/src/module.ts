import type { DriftState, DriftCellConfig } from './types.js';

export const drift_cell_module = {
  id: 'drift-cell',
  name: 'DriftCell',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['telemetry:read', 'storage:write', 'events:emit'] as const,
  description: 'Detects emotional drift and offers grounding interventions',
};

export class DriftCell {
  private state: DriftState = {
    drifting: false,
    driftScore: 0,
    lastDriftAt: null,
    driftDirection: null,
    interventionsOffered: 0,
  };
  private config: DriftCellConfig = { threshold: 0.65, gentleMode: true };
  private _bus: unknown;

  constructor(bus?: unknown, config?: Partial<DriftCellConfig>) {
    this._bus = bus;
    if (config) this.config = { ...this.config, ...config };
  }

  async init(): Promise<void> {
    if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
      const b = this._bus as Record<string, unknown>;
      if (b.on && typeof b.on === 'function') {
        (b.on as (evt: string, handler: (data: unknown) => void) => void)(
          'telemetry:update',
          (e: unknown) => {
            const ev = e as { data?: { valence?: number; arousal?: number; focus?: number } };
            if (
              ev.data &&
              ev.data.valence !== undefined &&
              ev.data.arousal !== undefined &&
              ev.data.focus !== undefined
            ) {
              this.process(ev.data as { valence: number; arousal: number; focus: number });
            }
          },
        );
        (b.on as (evt: string, handler: (data: unknown) => void) => void)(
          'emotional:drift',
          (e: unknown) => {
            const ev = e as { data?: unknown };
            if (ev.data) this.handleDrift(ev.data);
          },
        );
      }
    }
  }

  process(telemetry: { valence: number; arousal: number; focus: number }): void {
    // Drift detection: low focus + high arousal variance
    const driftScore = (1 - telemetry.focus) * 0.6 + Math.abs(telemetry.valence) * 0.4;
    this.state.driftScore = driftScore;

    if (driftScore > this.config.threshold) {
      this.state.drifting = true;
      this.state.lastDriftAt = Date.now();
      this.state.driftDirection =
        telemetry.valence < -0.3
          ? 'past'
          : telemetry.valence > 0.3
            ? 'future'
            : 'dissociation';
      this.emit('drift-cell:drift-detected', { ...this.state });
    } else {
      this.state.drifting = false;
    }
  }

  handleDrift(data: unknown): void {
    if (data && typeof data === 'object') {
      const d = data as { valence?: number; arousal?: number; focus?: number };
      if (d.valence !== undefined && d.arousal !== undefined && d.focus !== undefined) {
        this.process(d as { valence: number; arousal: number; focus: number });
      }
    }
  }

  offerGrounding(): { technique: string; prompt: string } {
    this.state.interventionsOffered++;
    const techniques = [
      {
        technique: '5-4-3-2-1',
        prompt: 'Name 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste.',
      },
      {
        technique: 'soft-anchor',
        prompt: 'Place both feet on the floor. Feel the weight. You are here.',
      },
      {
        technique: 'breath-box',
        prompt: 'Inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat gently.',
      },
      {
        technique: 'body-scan',
        prompt: 'Starting at your toes, slowly move attention up through your body.',
      },
    ];
    const idx = Math.floor(Math.random() * techniques.length);
    return techniques[idx]!;
  }

  getState(): DriftState {
    return { ...this.state };
  }

  async destroy(): Promise<void> {
    this.state.drifting = false;
  }

  private emit(type: string, data: unknown): void {
    if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (evt: { type: string; data: unknown; source: string }) => void)({
          type,
          data,
          source: 'drift-cell',
        });
      }
    }
  }
}

export function createDriftCellModule(
  bus?: unknown,
  config?: Partial<DriftCellConfig>,
): DriftCell {
  return new DriftCell(bus, config);
}
