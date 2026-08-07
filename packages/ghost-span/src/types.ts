// ============================================================
// GhostSpan Types — Bio-rhythmic Focus Module
// ============================================================

export interface FocusSlot {
  /** Hour of the day (0-23) */
  hour: number;
  /** Computed focus suitability score (0-1) */
  optimalFocus: number;
  /** Recommended task category for this slot */
  taskType: string;
}

export interface GhostSpanState {
  /** Whether a schedule has been generated */
  active: boolean;
  /** Full 24-hour focus schedule */
  schedule: FocusSlot[];
  /** Currently selected slot (from last getCurrentSlot call) */
  currentSlot: FocusSlot | null;
  /** Number of schedule adjustments made */
  adjustmentsMade: number;
}

export interface EmotionDataPoint {
  /** Emotional valence (-1 to 1) */
  valence: number;
  /** Arousal level (0 to 1) */
  arousal: number;
  /** Hour of day (0-23) this data point applies to */
  hour: number;
}
