// ============================================================
// QuietQuorum Module — Consensus Decision Making
// Weighted voting system for cross-module decision resolution
// ============================================================

import type { DecisionOption, QuorumState, QuorumConfig } from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const quiet_quorum_module = {
  id: 'quiet-quorum',
  name: 'QuietQuorum',
  category: 'productivity' as const,
  version: '0.1.0',
  permissions: ['events:emit', 'events:listen'] as const,
  description: 'Weighted consensus decision making across modules',
};

// ------------------------------------------------------------------
// Defaults
// ------------------------------------------------------------------

const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_MIN_QUORUM = 2;

// ------------------------------------------------------------------
// QuietQuorum Implementation
// ------------------------------------------------------------------

export class QuietQuorum {
  private state: QuorumState = {
    decisionId: null,
    options: [],
    consensusReached: false,
    winningOptionId: null,
    moduleVotes: new Map(),
  };

  private _bus: unknown;
  private _config: Required<QuorumConfig>;

  constructor(bus?: unknown, config: QuorumConfig = {}) {
    this._bus = bus;
    void this._bus;
    this._config = {
      consensusThreshold: config.consensusThreshold ?? DEFAULT_THRESHOLD,
      minimumQuorumWeight: config.minimumQuorumWeight ?? DEFAULT_MIN_QUORUM,
    };
  }

  async init(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Propose a new decision with a set of options.
   * @param decisionId - Unique identifier for the decision
   * @param options - Array of decision options (id + label)
   */
  proposeDecision(decisionId: string, options: { id: string; label: string }[]): void {
    if (options.length === 0) {
      throw new Error('Decision must have at least one option');
    }
    const decisionOptions: DecisionOption[] = options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      votes: 0,
      moduleSources: [],
      score: 0,
    }));
    this.state = {
      decisionId,
      options: decisionOptions,
      consensusReached: false,
      winningOptionId: null,
      moduleVotes: new Map(),
    };
  }

  /**
   * Cast a weighted vote for a specific option.
   * @param moduleId - ID of the voting module
   * @param optionId - ID of the chosen option
   * @param weight - Vote weight (0-1)
   */
  vote(moduleId: string, optionId: string, weight: number): void {
    if (this.state.decisionId === null) {
      throw new Error('No active decision. Call proposeDecision() first.');
    }
    const option = this.state.options.find((o) => o.id === optionId);
    if (!option) {
      throw new Error(`Option "${optionId}" not found in current decision.`);
    }
    if (weight < 0 || weight > 1) {
      throw new Error('Vote weight must be between 0 and 1');
    }

    // Remove previous vote from this module if it exists
    const previousVote = this.state.moduleVotes.get(moduleId);
    if (previousVote !== undefined) {
      const prevOption = this.state.options.find((o) => o.id === previousVote);
      if (prevOption) {
        prevOption.votes = Math.max(0, prevOption.votes - 1);
        prevOption.moduleSources = prevOption.moduleSources.filter((m) => m !== moduleId);
      }
    }

    // Apply new vote
    option.votes += 1;
    option.moduleSources.push(moduleId);
    this.state.moduleVotes.set(moduleId, optionId);

    this.emit('quorum:vote-cast', {
      moduleId,
      optionId,
      weight,
      decisionId: this.state.decisionId,
    } as Record<string, unknown>);

    // Auto-tally when minimum quorum is reached
    this.tally();
  }

  /**
   * Recalculate weighted scores for all options and check consensus.
   * @returns Current state snapshot after tallying
   */
  tally(): QuorumState {
    const totalWeight = this.state.moduleVotes.size;
    if (totalWeight === 0) {
      return this.getState();
    }

    for (const option of this.state.options) {
      option.score = option.votes / totalWeight;
    }

    // Check for consensus
    const winner = this.state.options.reduce<DecisionOption | null>(
      (best, opt) => (opt.score > (best?.score ?? -1) ? opt : best),
      null
    );

    if (
      winner &&
      winner.score >= this._config.consensusThreshold &&
      totalWeight >= this._config.minimumQuorumWeight
    ) {
      this.state.consensusReached = true;
      this.state.winningOptionId = winner.id;
      this.emit('quorum:consensus-reached', {
        decisionId: this.state.decisionId,
        winningOptionId: winner.id,
        winningScore: winner.score,
        totalVotes: totalWeight,
      });
    } else {
      this.state.consensusReached = false;
      this.state.winningOptionId = null;
    }

    return this.getState();
  }

  /**
   * Get the current consensus result.
   * @returns Winning option ID or null if no consensus
   */
  getConsensus(): { winner: string | null; score: number; reached: boolean } {
    return {
      winner: this.state.winningOptionId,
      score: this.state.winningOptionId
        ? (this.state.options.find((o) => o.id === this.state.winningOptionId)?.score ?? 0)
        : 0,
      reached: this.state.consensusReached,
    };
  }

  /**
   * Get the full current state of the quorum.
   * @returns Deep-cloned state snapshot
   */
  getState(): QuorumState {
    return {
      decisionId: this.state.decisionId,
      options: this.state.options.map((o) => ({
        ...o,
        moduleSources: [...o.moduleSources],
      })),
      consensusReached: this.state.consensusReached,
      winningOptionId: this.state.winningOptionId,
      moduleVotes: new Map(this.state.moduleVotes),
    };
  }

  /**
   * Get the currently active decision ID.
   * @returns Decision ID or null
   */
  getActiveDecision(): string | null {
    return this.state.decisionId;
  }

  /**
   * Get the vote cast by a specific module.
   * @param moduleId - Module ID to look up
   * @returns Option ID voted for, or undefined
   */
  getModuleVote(moduleId: string): string | undefined {
    return this.state.moduleVotes.get(moduleId);
  }

  /**
   * Check if a specific module has voted.
   * @param moduleId - Module ID to check
   * @returns Whether the module has cast a vote
   */
  hasVoted(moduleId: string): boolean {
    return this.state.moduleVotes.has(moduleId);
  }

  /**
   * Get the number of unique voters.
   * @returns Voter count
   */
  getVoterCount(): number {
    return this.state.moduleVotes.size;
  }

  /**
   * End the current decision and reset state.
   */
  endDecision(): void {
    this.state = {
      decisionId: null,
      options: [],
      consensusReached: false,
      winningOptionId: null,
      moduleVotes: new Map(),
    };
  }

  async destroy(): Promise<void> {
    this.endDecision();
    this._bus = undefined;
    return Promise.resolve();
  }

  // ------------------------------------------------------------------
  // Event emission helper
  // ------------------------------------------------------------------

  private emit(type: string, data: Record<string, unknown>): void {
    if (
      this._bus &&
      typeof this._bus === 'object' &&
      this._bus !== null
    ) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (event: unknown) => void)({ type, data, source: 'quiet-quorum' });
      }
    }
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createQuietQuorumModule(bus?: unknown, config?: QuorumConfig): QuietQuorum {
  return new QuietQuorum(bus, config);
}
