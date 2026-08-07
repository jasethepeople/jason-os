// ============================================================
// QuietQuorum Types — Consensus Decision Making Module
// ============================================================

export interface DecisionOption {
  /** Unique identifier for the option */
  id: string;
  /** Human-readable label for the option */
  label: string;
  /** Number of votes received */
  votes: number;
  /** IDs of modules that voted for this option */
  moduleSources: string[];
  /** Computed weighted score */
  score: number;
}

export interface QuorumState {
  /** Currently active decision ID, or null */
  decisionId: string | null;
  /** Available decision options */
  options: DecisionOption[];
  /** Whether consensus has been reached */
  consensusReached: boolean;
  /** ID of the winning option, or null */
  winningOptionId: string | null;
  /** Map of moduleId -> optionId votes */
  moduleVotes: Map<string, string>;
}

export interface VotePayload {
  /** ID of the voting module */
  moduleId: string;
  /** ID of the chosen option */
  optionId: string;
  /** Weight of the vote (0-1) */
  weight: number;
}

export interface QuorumConfig {
  /** Threshold for consensus (0-1), default 0.6 */
  consensusThreshold?: number;
  /** Minimum total weight required for a valid quorum */
  minimumQuorumWeight?: number;
}
