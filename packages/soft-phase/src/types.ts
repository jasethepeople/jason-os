// ============================================================
// SoftPhase Types — Cycle Tracking Module
// ============================================================

export type CyclePhase = 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | 'unknown';

export interface EmotionalCorrelation {
  /** Expected valence shift during this phase */
  valenceDelta: number;
  /** Expected stress shift during this phase */
  stressDelta: number;
}

export interface PhasePrediction {
  /** Predicted timestamp (ms since epoch) */
  date: number;
  /** Predicted phase name */
  predictedPhase: string;
}

export interface EmotionInput {
  /** Emotional valence (-1 to 1) */
  valence: number;
  /** Stress level (0 to 1) */
  stress: number;
}

export interface PhaseState {
  /** Current cycle phase */
  phase: CyclePhase;
  /** Current day in cycle (1-28+) */
  day: number;
  /** Emotional correlation for current phase */
  emotionalCorrelation: EmotionalCorrelation | null;
  /** Upcoming phase predictions */
  predictions: PhasePrediction[];
}
