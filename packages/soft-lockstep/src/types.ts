// ============================================================
// SoftLockstep Types — Synchronized Focus Companion
// ============================================================

export interface LockstepPartner {
  /** Unique identifier for the partner */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Partner's current focus score (0-1) */
  focusScore: number;
  /** Timestamp of last ping received from partner */
  lastPingAt: number;
}

export interface LockstepState {
  /** Whether a paired session is currently active */
  active: boolean;
  /** Current partner, or null if in solo mode */
  partner: LockstepPartner | null;
  /** Timestamp when the current session started */
  sessionStart: number | null;
  /** Computed mutual focus score (0-1) */
  mutualFocusScore: number;
  /** Current synchronization status */
  syncStatus: 'solo' | 'paired' | 'group';
}

export interface EmotionInput {
  /** Valence dimension (-1 to 1) */
  valence: number;
  /** Arousal dimension (0 to 1) */
  arousal: number;
}

export interface LockstepOptions {
  /** Heartbeat interval in milliseconds (default: 5000) */
  heartbeatMs?: number;
  /** Timeout threshold for partner liveness in milliseconds (default: 15000) */
  partnerTimeoutMs?: number;
}
