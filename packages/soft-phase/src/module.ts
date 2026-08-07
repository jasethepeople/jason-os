// ============================================================
// SoftPhase Module — Cycle Tracking
// Cycle tracking with emotional correlation mapping
// ============================================================

import type {
  PhaseState,
  CyclePhase,
  EmotionalCorrelation,
  EmotionInput,
} from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const soft_phase_module = {
  id: 'soft-phase',
  name: 'SoftPhase',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['telemetry:read', 'storage:write'] as const,
  description: 'Cycle tracking with emotional correlation mapping',
};

// ------------------------------------------------------------------
// Phase Correlations (user-adjustable baseline)
// ------------------------------------------------------------------

const PHASE_CORRELATIONS: Readonly<Record<CyclePhase, EmotionalCorrelation>> = {
  menstrual: { valenceDelta: -0.2, stressDelta: 0.3 },
  follicular: { valenceDelta: 0.15, stressDelta: -0.1 },
  ovulatory: { valenceDelta: 0.2, stressDelta: -0.15 },
  luteal: { valenceDelta: -0.1, stressDelta: 0.2 },
  unknown: { valenceDelta: 0, stressDelta: 0 },
};

// ------------------------------------------------------------------
// SoftPhase Implementation
// ------------------------------------------------------------------

export class SoftPhase {
  private state: PhaseState = {
    phase: 'unknown',
    day: 0,
    emotionalCorrelation: null,
    predictions: [],
  };

  private _bus: unknown;

  constructor(bus?: unknown) {
    this._bus = bus;
    void this._bus; // referenced to satisfy noUnusedLocals
  }

  async init(): Promise<void> {
    // Lifecycle hook for module loader integration
    return Promise.resolve();
  }

  /**
   * Set the current cycle day and infer the phase.
   * @param day - Day in cycle (1-28+)
   */
  setDay(day: number): void {
    this.state.day = day;
    this.state.phase = this.inferPhase(day);
    this.emit('soft-phase:phase-change', { phase: this.state.phase, day });
  }

  /**
   * Infer cycle phase from day number.
   * @param day - Day in cycle (1-28+)
   * @returns Inferred phase
   */
  inferPhase(day: number): CyclePhase {
    if (day <= 0 || day > 28) return 'unknown';
    if (day <= 5) return 'menstrual';
    if (day <= 13) return 'follicular';
    if (day <= 16) return 'ovulatory';
    return 'luteal';
  }

  /**
   * Correlate current emotional state with cycle phase.
   * Sets the emotional correlation based on the current phase.
   * @param emotion - Current emotional state
   */
  correlateEmotion(_emotion: EmotionInput): void {
    this.state.emotionalCorrelation =
      PHASE_CORRELATIONS[this.state.phase] ?? { valenceDelta: 0, stressDelta: 0 };
  }

  /**
   * Get the raw emotional correlation for a specific phase without changing state.
   * @param phase - The cycle phase to query
   * @returns Emotional correlation for that phase
   */
  getPhaseCorrelation(phase: CyclePhase): EmotionalCorrelation {
    return { ...PHASE_CORRELATIONS[phase] };
  }

  /**
   * Generate predictions for upcoming days.
   * @param daysAhead - Number of days to predict (default 28)
   */
  predict(daysAhead = 28): void {
    this.state.predictions = [];
    const now = Date.now();
    for (let i = 1; i <= daysAhead; i++) {
      const futureDay = this.state.day + i;
      this.state.predictions.push({
        date: now + i * 86400000,
        predictedPhase: this.inferPhase(futureDay),
      });
    }
  }

  /**
   * Get the current cycle phase.
   * @returns Current phase
   */
  getPhase(): CyclePhase {
    return this.state.phase;
  }

  /**
   * Get the current cycle day.
   * @returns Current day (1-28+)
   */
  getDay(): number {
    return this.state.day;
  }

  /**
   * Get the full current state of the SoftPhase instance.
   * @returns Deep-cloned state snapshot
   */
  getState(): PhaseState {
    return {
      ...this.state,
      predictions: [...this.state.predictions],
    };
  }

  /**
   * Reset all state to initial values.
   */
  reset(): void {
    this.state = {
      phase: 'unknown',
      day: 0,
      emotionalCorrelation: null,
      predictions: [],
    };
  }

  async destroy(): Promise<void> {
    this.reset();
    this._bus = undefined;
    return Promise.resolve();
  }

  // ------------------------------------------------------------------
  // Event emission helper
  // ------------------------------------------------------------------

  private emit(type: string, data: Record<string, unknown>): void {
    if (
      this._bus &&
      typeof this._bus === 'object' &&
      this._bus !== null
    ) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (event: unknown) => void)({ type, data, source: 'soft-phase' });
      }
    }
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createSoftPhaseModule(bus?: unknown): SoftPhase {
  return new SoftPhase(bus);
}
