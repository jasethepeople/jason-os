/**
 * QuietSpan — Focus Session Manager (Productivity)
 * Types and interfaces for timed focus sessions with emotional context tracking.
 */

/** Represents a single timed focus session */
export interface FocusSession {
  /** Unique session identifier */
  id: string;
  /** Unix timestamp when session started */
  startedAt: number;
  /** Unix timestamp when session ended, or null if still active */
  endedAt: number | null;
  /** Planned duration in minutes */
  durationMin: number;
  /** Whether a break was taken during the session */
  breakTaken: boolean;
  /** User notes captured at session end */
  notes: string;
  /** Tag for categorizing the session */
  tag: string;
}

/** Full state snapshot for the QuietSpan module */
export interface QuietSpanState {
  /** All completed focus sessions */
  sessions: FocusSession[];
  /** Currently active session, or null if none */
  activeSession: FocusSession | null;
  /** Cumulative focus score (0–100) */
  focusScore: number;
  /** Emotional state captured at session start */
  emotionAtStart: { valence: number; stress: number } | null;
  /** Emotional state captured at session end */
  emotionAtEnd: { valence: number; stress: number } | null;
}
