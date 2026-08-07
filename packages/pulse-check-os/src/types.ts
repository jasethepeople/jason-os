// ============================================================
// PulseCheckOS Types — Emotional Vitals Dashboard
// ============================================================

export type OverallStatus = 'thriving' | 'stable' | 'declining' | 'critical';

export type TrendDirection = 'improving' | 'stable' | 'worsening';

export interface VitalSigns {
  /** Valence dimension: -1 (negative) to 1 (positive) */
  valence: number;
  /** Arousal dimension: 0 (calm) to 1 (energized) */
  arousal: number;
  /** Dominance dimension: 0 (submissive) to 1 (in-control) */
  dominance: number;
  /** Stress level: 0 (none) to 1 (extreme) */
  stress: number;
  /** Timestamp when vitals were recorded */
  timestamp: number;
  /** Overall wellness status derived from vitals */
  overall: OverallStatus;
}

export interface PulseCheckState {
  /** Current vital signs, or null if none recorded */
  current: VitalSigns | null;
  /** Historical vital signs recordings */
  history: VitalSigns[];
  /** Computed trend direction from history */
  trendDirection: TrendDirection;
  /** Active alerts for critical conditions */
  alerts: string[];
}

export interface EmotionInput {
  /** Valence: -1 to 1 */
  valence: number;
  /** Arousal: 0 to 1 */
  arousal: number;
  /** Dominance: 0 to 1 */
  dominance: number;
  /** Stress: 0 to 1 */
  stress: number;
}

export interface PulseCheckOptions {
  /** Maximum history entries to retain (default: 100) */
  maxHistory?: number;
  /** Enable automatic trend detection (default: true) */
  enableTrendDetection?: boolean;
  /** Enable alert generation for critical states (default: true) */
  enableAlerts?: boolean;
}
