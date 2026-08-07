// ============================================================
// @jason-os/quiet-quorum — Public API
// Consensus decision making across modules via weighted voting
// ============================================================

export {
  quiet_quorum_module,
  QuietQuorum,
  createQuietQuorumModule,
} from './module.js';

export type {
  DecisionOption,
  QuorumState,
  VotePayload,
  QuorumConfig,
} from './types.js';
