// ============================================================
// ShadowPipeline Types — Secure Data Processing Module
// ============================================================

export type TransformType = 'encrypt' | 'hash' | 'anonymize' | 'filter';

export interface PipelineStage {
  /** Unique identifier for the stage */
  id: string;
  /** Human-readable name of the stage */
  name: string;
  /** Type of transformation applied */
  transform: TransformType;
  /** Stage-specific configuration */
  config: Record<string, unknown>;
}

export interface PipelineState {
  /** Defined processing stages in order */
  stages: PipelineStage[];
  /** Whether the pipeline is active */
  active: boolean;
  /** Number of items processed */
  processedCount: number;
  /** Timestamp of last processed item, or null */
  lastProcessedAt: number | null;
}

export interface ProcessResult {
  /** Processed output data */
  data: string;
  /** Stages that were applied */
  stagesApplied: string[];
  /** Whether processing succeeded */
  success: boolean;
  /** Processing timestamp */
  processedAt: number;
  /** Error message if failed */
  error?: string;
}

export interface PipelineConfig {
  /** Auto-activate pipeline on creation */
  autoActivate?: boolean;
}
