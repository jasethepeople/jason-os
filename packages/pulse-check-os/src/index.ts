// ============================================================
// @jason-os/pulse-check-os — Public API
// Emotional vitals dashboard — VAD+stress monitoring
// ============================================================

export {
  pulse_check_os_module,
  PulseCheckOS,
  createPulseCheckOSModule,
} from './module.js';

export type {
  VitalSigns,
  PulseCheckState,
  EmotionInput,
  OverallStatus,
  TrendDirection,
  PulseCheckOptions,
} from './types.js';
