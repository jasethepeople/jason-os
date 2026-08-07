// ============================================================
// Undercurrent Types — Subconscious Pattern Detector
// ============================================================

export type PatternType = 'correlation' | 'cycle' | 'spike-cluster' | 'baseline-drift';

export interface DataPoint {
  /** Timestamp of the data point */
  timestamp: number;
  /** Valence dimension: -1 to 1 */
  valence: number;
  /** Arousal dimension: 0 to 1 */
  arousal: number;
  /** Dominance dimension: 0 to 1 */
  dominance: number;
  /** Stress level: 0 to 1 */
  stress: number;
}

export interface Pattern {
  /** Unique identifier for the pattern */
  id: string;
  /** Pattern classification type */
  type: PatternType;
  /** Confidence score: 0 to 1 */
  confidence: number;
  /** Timestamp of first observation */
  firstSeen: number;
  /** Timestamp of most recent observation */
  lastSeen: number;
  /** Number of times this pattern has been observed */
  occurrences: number;
  /** Dimensions related to this pattern */
  relatedDimensions: string[];
  /** Human-readable description of the pattern */
  description: string;
}

export interface UndercurrentState {
  /** Detected patterns */
  patterns: Pattern[];
  /** Generated insights from pattern analysis */
  insights: string[];
  /** How many historical data points are scanned (window size) */
  scanDepth: number;
}

export interface UndercurrentOptions {
  /** Minimum confidence threshold for pattern detection (default: 0.6) */
  confidenceThreshold?: number;
  /** Scan window size in data points (default: 50) */
  scanDepth?: number;
  /** Minimum occurrences to report a pattern (default: 3) */
  minOccurrences?: number;
}
