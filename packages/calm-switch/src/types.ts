// ============================================================
// CalmSwitch Types — Emotional State Transition Module
// ============================================================

export interface TransitionEntry {
  /** The emotional state before activation */
  from: string;
  /** The target emotional state */
  to: string;
  /** Technique used for the transition */
  technique: string;
  /** Timestamp of the transition (ms since epoch) */
  at: number;
}

export interface CalmState {
  /** Whether the calm-switch is currently active */
  active: boolean;
  /** Total number of interventions performed */
  interventions: number;
  /** Timestamp of last activation, or null */
  lastActivatedAt: number | null;
  /** Currently selected technique, or null */
  currentTechnique: string | null;
  /** Log of all state transitions */
  transitionLog: TransitionEntry[];
}

export interface CalmSwitchOptions {
  /** Override technique mappings for specific states */
  customTechniques?: Record<string, string[]>;
  /** Seed for deterministic technique selection (testing) */
  seed?: number;
}
