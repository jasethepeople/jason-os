import type { QuorumState, QuorumConfig } from './types.js';
export declare const quiet_quorum_module: {
    id: string;
    name: string;
    category: 'productivity';
    version: string;
    permissions: readonly ['events:emit', 'events:listen'];
    description: string;
};
export declare class QuietQuorum {
    private state;
    private _bus;
    private _config;
    constructor(bus?: unknown, config?: QuorumConfig);
    init(): Promise<void>;
    /**
     * Propose a new decision with a set of options.
     * @param decisionId - Unique identifier for the decision
     * @param options - Array of decision options (id + label)
     */
    proposeDecision(decisionId: string, options: {
        id: string;
        label: string;
    }[]): void;
    /**
     * Cast a weighted vote for a specific option.
     * @param moduleId - ID of the voting module
     * @param optionId - ID of the chosen option
     * @param weight - Vote weight (0-1)
     */
    vote(moduleId: string, optionId: string, weight: number): void;
    /**
     * Recalculate weighted scores for all options and check consensus.
     * @returns Current state snapshot after tallying
     */
    tally(): QuorumState;
    /**
     * Get the current consensus result.
     * @returns Winning option ID or null if no consensus
     */
    getConsensus(): {
        winner: string | null;
        score: number;
        reached: boolean;
    };
    /**
     * Get the full current state of the quorum.
     * @returns Deep-cloned state snapshot
     */
    getState(): QuorumState;
    /**
     * Get the currently active decision ID.
     * @returns Decision ID or null
     */
    getActiveDecision(): string | null;
    /**
     * Get the vote cast by a specific module.
     * @param moduleId - Module ID to look up
     * @returns Option ID voted for, or undefined
     */
    getModuleVote(moduleId: string): string | undefined;
    /**
     * Check if a specific module has voted.
     * @param moduleId - Module ID to check
     * @returns Whether the module has cast a vote
     */
    hasVoted(moduleId: string): boolean;
    /**
     * Get the number of unique voters.
     * @returns Voter count
     */
    getVoterCount(): number;
    /**
     * End the current decision and reset state.
     */
    endDecision(): void;
    destroy(): Promise<void>;
    private emit;
}
export declare function createQuietQuorumModule(bus?: unknown, config?: QuorumConfig): QuietQuorum;
//# sourceMappingURL=module.d.ts.map