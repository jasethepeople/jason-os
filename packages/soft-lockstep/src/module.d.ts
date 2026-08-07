import type { LockstepPartner, LockstepState, EmotionInput } from './types.js';
export declare const soft_lockstep_module: {
    id: string;
    name: string;
    category: 'productivity';
    version: string;
    permissions: readonly ['telemetry:read', 'events:emit', 'partner:connect'];
    description: string;
};
export declare class SoftLockstep {
    private state;
    private _bus;
    private _heartbeatTimer;
    private _heartbeatMs;
    private _partnerTimeoutMs;
    constructor(bus?: unknown, options?: {
        heartbeatMs?: number;
        partnerTimeoutMs?: number;
    });
    init(): Promise<void>;
    /**
     * Start a paired focus session with a partner.
     * @param partner - The partner to pair with
     */
    startPairedSession(partner: LockstepPartner): void;
    /**
     * End the current focus session.
     */
    endSession(): void;
    /**
     * Update the partner's focus score from their emotional telemetry.
     * @param emotion - The partner's current emotional state (valence + arousal)
     * @param partnerFocusScore - Direct focus score override (0-1)
     */
    updatePartnerScore(emotion: EmotionInput, partnerFocusScore?: number): void;
    /**
     * Get the current mutual focus score.
     * @returns Mutual focus score between 0 and 1
     */
    getMutualFocusScore(): number;
    /**
     * Ping the partner to signal liveness.
     */
    ping(): void;
    /**
     * Check if the partner is still alive based on last ping.
     * @returns True if partner has pinged within the timeout window
     */
    isPartnerAlive(): boolean;
    /**
     * Switch sync status (solo, paired, or group).
     * @param status - The new sync status
     */
    setSyncStatus(status: LockstepState['syncStatus']): void;
    /**
     * Get the current sync status.
     * @returns Current synchronization status
     */
    getSyncStatus(): LockstepState['syncStatus'];
    /**
     * Get the current partner, or null if none.
     * @returns Current partner copy
     */
    getPartner(): LockstepPartner | null;
    /**
     * Get the duration of the current session in milliseconds.
     * @returns Session duration, or 0 if no active session
     */
    getSessionDuration(): number;
    /**
     * Check if a paired session is currently active.
     * @returns Whether a session is active
     */
    isActive(): boolean;
    /**
     * Get the full current state.
     * @returns Deep-cloned state snapshot
     */
    getState(): LockstepState;
    destroy(): Promise<void>;
    /**
     * Compute a focus score from valence and arousal.
     * Higher valence + moderate arousal = higher focus.
     */
    private scoreFromEmotion;
    /**
     * Compute mutual focus score from self emotion and partner focus score.
     */
    private computeMutualFocus;
    private startHeartbeat;
    private stopHeartbeat;
    private emit;
}
export declare function createSoftLockstepModule(bus?: unknown, options?: {
    heartbeatMs?: number;
    partnerTimeoutMs?: number;
}): SoftLockstep;
//# sourceMappingURL=module.d.ts.map