// ============================================================
// GhostSpan Module — Bio-rhythmic Focus
// Time-shifting focus based on emotional peaks and bio-rhythms
// ============================================================

import type { GhostSpanState, FocusSlot, EmotionDataPoint } from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const ghost_span_module = {
  id: 'ghost-span',
  name: 'GhostSpan',
  category: 'productivity' as const,
  version: '0.1.0',
  permissions: ['telemetry:read', 'schedule'] as const,
  description: 'Time-shifting focus based on emotional peaks and bio-rhythms',
};

// ------------------------------------------------------------------
// GhostSpan Implementation
// ------------------------------------------------------------------

export class GhostSpan {
  private state: GhostSpanState = {
    active: false,
    schedule: [],
    currentSlot: null,
    adjustmentsMade: 0,
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
   * Generate a focus schedule from emotion history data.
   * Maps each hour's valence/arousal to an optimal focus score and task type.
   * @param emotionHistory - Array of emotional data points by hour
   */
  generateSchedule(emotionHistory: EmotionDataPoint[]): void {
    this.state.schedule = emotionHistory.map((e) => ({
      hour: e.hour,
      optimalFocus: this.computeFocusScore(e.valence, e.arousal),
      taskType: this.suggestTaskType(e.valence, e.arousal),
    }));
    this.state.active = true;
  }

  /**
   * Compute a focus suitability score from valence and arousal.
   * Optimal focus occurs at moderate positive valence + moderate arousal.
   * @param valence - Emotional valence (-1 to 1)
   * @param arousal - Arousal level (0 to 1)
   * @returns Focus score (0 to 1)
   */
  computeFocusScore(valence: number, arousal: number): number {
    const valenceScore = 1 - Math.abs(valence - 0.3) * 1.5;
    const arousalScore = 1 - Math.abs(arousal - 0.5);
    return Math.max(0, Math.min(1, (valenceScore + arousalScore) / 2));
  }

  /**
   * Suggest a task type based on emotional state.
   * @param valence - Emotional valence (-1 to 1)
   * @param arousal - Arousal level (0 to 1)
   * @returns Task type recommendation
   */
  suggestTaskType(valence: number, arousal: number): string {
    if (valence > 0.4 && arousal > 0.6) return 'creative';
    if (valence > 0.2 && arousal < 0.4) return 'deep-work';
    if (valence < 0) return 'admin';
    return 'routine';
  }

  /**
   * Get the focus slot for a specific hour.
   * @param hour - Hour of day (0-23)
   * @returns The matching focus slot, or null if not found
   */
  getCurrentSlot(hour: number): FocusSlot | null {
    const slot = this.state.schedule.find((s) => s.hour === hour) ?? null;
    this.state.currentSlot = slot;
    return slot;
  }

  /**
   * Get the best focus slot across the entire schedule.
   * @returns The slot with highest optimalFocus score, or null if no schedule
   */
  getBestSlot(): FocusSlot | null {
    if (this.state.schedule.length === 0) return null;
    return this.state.schedule.reduce((best, slot) =>
      slot.optimalFocus > best.optimalFocus ? slot : best
    );
  }

  /**
   * Get all slots for a given task type.
   * @param taskType - Task type filter
   * @returns Matching focus slots
   */
  getSlotsByTaskType(taskType: string): FocusSlot[] {
    return this.state.schedule.filter((s) => s.taskType === taskType);
  }

  /**
   * Get the average focus score across the full schedule.
   * @returns Average focus score (0-1), or 0 if no schedule
   */
  getAverageFocusScore(): number {
    if (this.state.schedule.length === 0) return 0;
    const sum = this.state.schedule.reduce((acc, s) => acc + s.optimalFocus, 0);
    return sum / this.state.schedule.length;
  }

  /**
   * Adjust a specific hour's slot manually.
   * @param hour - Hour to adjust
   * @param overrides - Partial slot data to override
   */
  adjustSlot(hour: number, overrides: Partial<Omit<FocusSlot, 'hour'>>): void {
    const idx = this.state.schedule.findIndex((s) => s.hour === hour);
    if (idx !== -1) {
      this.state.schedule[idx] = {
        ...this.state.schedule[idx]!,
        ...overrides,
        hour,
      };
      this.state.adjustmentsMade++;
    }
  }

  /**
   * Get the full current state of the GhostSpan instance.
   * @returns Deep-cloned state snapshot
   */
  getState(): GhostSpanState {
    return {
      active: this.state.active,
      schedule: [...this.state.schedule],
      currentSlot: this.state.currentSlot
        ? { ...this.state.currentSlot }
        : null,
      adjustmentsMade: this.state.adjustmentsMade,
    };
  }

  /**
   * Check whether a schedule has been generated.
   * @returns Whether the module has an active schedule
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Clear the current schedule and reset state.
   */
  clearSchedule(): void {
    this.state = {
      active: false,
      schedule: [],
      currentSlot: null,
      adjustmentsMade: this.state.adjustmentsMade,
    };
  }

  async destroy(): Promise<void> {
    this.state = {
      active: false,
      schedule: [],
      currentSlot: null,
      adjustmentsMade: 0,
    };
    this._bus = undefined;
    return Promise.resolve();
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createGhostSpanModule(bus?: unknown): GhostSpan {
  return new GhostSpan(bus);
}
