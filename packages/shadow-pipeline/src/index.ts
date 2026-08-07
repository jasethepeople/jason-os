// ============================================================
// @jason-os/shadow-pipeline — Public API
// Secure multi-stage data processing pipeline
// ============================================================

export {
  shadow_pipeline_module,
  ShadowPipeline,
  createShadowPipelineModule,
} from './module.js';

export type {
  PipelineStage,
  PipelineState,
  ProcessResult,
  PipelineConfig,
  TransformType,
} from './types.js';
