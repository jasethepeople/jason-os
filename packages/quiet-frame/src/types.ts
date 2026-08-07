// ============================================================
// QuietFrame Types — Language Softening Module
// ============================================================

export interface FrameState {
  /** Whether any softening has been applied to the current text */
  softened: boolean;
  /** The original unsoftened text */
  originalText: string | null;
  /** The softened version of the text */
  softenedText: string | null;
  /** Total number of soften replacements applied across all calls */
  softensApplied: number;
}

export interface SoftenOptions {
  /** Specific patterns to include (uses default set if omitted) */
  includePatterns?: Array<[RegExp, string]>;
  /** Whether to apply softening recursively until no more matches */
  recursive?: boolean;
  /** Preserve original casing when replacing */
  preserveCase?: boolean;
}
