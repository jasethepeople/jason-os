// ============================================================
// @jason-os/emotional-telemetry
// Real-time emotional state capture: valence, arousal, dominance, stress vectors
// ============================================================

export {
  // Engine
  EmotionalTelemetryEngineImpl,
  createEmotionalTelemetryEngine,
} from './telemetry-engine.js';

export type {
  // Core interfaces
  EmotionalTelemetryEngine,
  EmotionalSample,
  EmotionalState,
  EmotionalBaseline,
  EmotionalReport,
  DriftResult,
  EmotionalDataExport,
} from './telemetry-engine.js';
