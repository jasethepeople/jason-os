/**
 * SoftAnchor — Emotional Re-anchoring (Emotional)
 * Types and interfaces for the emotional re-anchoring system.
 */

/** State snapshot for the SoftAnchor module */
export interface AnchorState {
  /** Whether the emotional state is currently stable */
  stable: boolean;
  /** The trigger that prompted re-anchoring, or null if none */
  trigger: string | null;
  /** Unix timestamp of the last re-anchor event, or null */
  reanchoredAt: number | null;
  /** Total number of successful re-anchor operations */
  anchorCount: number;
}
