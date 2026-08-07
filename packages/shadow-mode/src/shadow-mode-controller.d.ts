/**
 * shadow-mode-controller.ts — Shadow Mode Controller for Jason-OS
 *
 * The privacy emergency system. When activated, it makes Jason-OS disappear.
 * Features: ghost mode activation, stealth behavior, decoy UI, panic mode,
 * duress password, hidden panels, burner sessions, and configurable triggers.
 */
type PrivacyTier = 'PUBLIC' | 'SOFT' | 'SHADOW' | 'GHOST';
interface Identity {
    id: string;
    type: 'CORE' | 'BURNER' | 'SHADOW';
    displayName: string;
    avatar?: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
}
interface Session {
    id: string;
    token: string;
    identity: Identity;
    createdAt: number;
    expiresAt: number;
    privacyTier: PrivacyTier;
    isBurner: boolean;
    deviceFingerprint?: string;
}
interface IPrivacyKernel {
    getPrivacyTier(): PrivacyTier;
    setPrivacyTier(tier: PrivacyTier): void;
}
interface SessionManager {
    createBurnerSession(): Promise<Session>;
    listActiveSessions(): Session[];
    expireSession(sessionId: string): Promise<void>;
}
/**
 * Reasons why shadow mode can be activated.
 */
export type ActivationReason = 'manual' | 'hotkey' | 'time-based' | 'emotional-state' | 'coercion' | 'panic';
/**
 * Configuration options passed during shadow mode activation.
 */
export interface ActivationOptions {
    /** The activation reason. */
    reason?: ActivationReason;
    /** Whether to auto-create a burner session. */
    switchToBurner?: boolean;
    /** Panel IDs to immediately hide. */
    hidePanels?: string[];
    /** Whether to enable decoy mode. */
    decoyMode?: boolean;
}
/**
 * A trigger that can activate ghost / shadow mode.
 */
export interface GhostTrigger {
    /** Unique trigger identifier. */
    id: string;
    /** Trigger type discriminator. */
    type: 'hotkey' | 'time' | 'emotional' | 'inactivity' | 'coercion';
    /** Type-specific configuration. */
    config: TriggerConfig;
    /** Whether this trigger is currently armed. */
    active: boolean;
}
/**
 * Union of all trigger-specific configurations.
 */
export type TriggerConfig = {
    keyCombo: string;
} | {
    schedule: string;
} | {
    emotion: string;
    threshold: number;
} | {
    timeoutMs: number;
} | {
    duressSignal: string;
};
/**
 * Current stealth status snapshot.
 */
export interface StealthStatus {
    /** Whether shadow mode is currently active. */
    active: boolean;
    /** Timestamp when shadow mode was activated (0 if inactive). */
    since: number;
    /** The activation reason. */
    reason: ActivationReason;
    /** Number of currently hidden panels. */
    hiddenPanels: number;
    /** Whether decoy mode is enabled. */
    decoyEnabled: boolean;
    /** Whether a burner session is active. */
    burnerActive: boolean;
    /** Whether data is encrypted in the current tier. */
    encrypted: boolean;
}
/**
 * Event handler signature for shadow mode lifecycle events.
 */
export type ShadowEventHandler = (event: {
    type: string;
    timestamp: number;
    reason?: ActivationReason;
}) => void;
/**
 * Public interface for the Shadow Mode Controller.
 */
export interface ShadowModeController {
    activate(options?: ActivationOptions): void;
    deactivate(): void;
    isActive(): boolean;
    getActivationReason(): ActivationReason;
    registerTrigger(trigger: GhostTrigger): void;
    removeTrigger(triggerId: string): void;
    listTriggers(): GhostTrigger[];
    getStealthStatus(): StealthStatus;
    setDecoyMode(enabled: boolean): void;
    isDecoyMode(): boolean;
    getHiddenPanels(): string[];
    togglePanelVisibility(panelId: string): void;
    createBurnerSession(): void;
    isBurnerActive(): boolean;
    panic(): void;
    setDuressPassword(password: string): void;
    on(event: 'activate' | 'deactivate' | 'panic', handler: ShadowEventHandler): () => void;
}
export declare class ShadowModeControllerImpl implements ShadowModeController {
    private _active;
    private _activatedAt;
    private _reason;
    private readonly _triggers;
    private readonly _hiddenPanels;
    private _decoyMode;
    private _burnerActive;
    private _duressPassword;
    private readonly _handlers;
    private readonly _privacyKernel;
    private readonly _sessionManager;
    constructor(privacyKernel: IPrivacyKernel, sessionManager: SessionManager);
    /**
     * Activate shadow mode — the privacy emergency system engages.
     *
     * 1. Set privacy tier to GHOST.
     * 2. Hide specified panels.
     * 3. Optionally enable decoy mode.
     * 4. Optionally create a burner session.
     * 5. Emit the 'activate' event.
     */
    activate(options?: ActivationOptions): void;
    /**
     * Deactivate shadow mode — restore normal operation.
     *
     * 1. Restore privacy tier to SOFT.
     * 2. Show all hidden panels.
     * 3. Disable decoy mode.
     * 4. Reset burner state.
     * 5. Emit the 'deactivate' event.
     */
    deactivate(): void;
    /** Returns whether shadow mode is currently active. */
    isActive(): boolean;
    /** Returns the most recent activation reason. */
    getActivationReason(): ActivationReason;
    /**
     * Register a new ghost trigger.
     *
     * Validates the trigger type and config shape before storing.
     */
    registerTrigger(trigger: GhostTrigger): void;
    /** Remove a trigger by its id. */
    removeTrigger(triggerId: string): void;
    /** List all registered triggers. */
    listTriggers(): GhostTrigger[];
    /**
     * Evaluate all active triggers and return matching trigger IDs.
     *
     * This is called by the trigger scheduler / event loop. It checks
     * each active trigger against the current system state and returns
     * a list of trigger IDs that have fired.
     */
    checkTriggers(context?: {
        emotion?: string;
        stress?: number;
    }): string[];
    /** Get a snapshot of the current stealth status. */
    getStealthStatus(): StealthStatus;
    /** Enable or disable decoy mode. */
    setDecoyMode(enabled: boolean): void;
    /** Returns whether decoy mode is currently enabled. */
    isDecoyMode(): boolean;
    /** Returns a list of currently hidden panel IDs. */
    getHiddenPanels(): string[];
    /** Toggle a panel's visibility (hide if visible, show if hidden). */
    togglePanelVisibility(panelId: string): void;
    /** Create a burner session via the session manager. */
    createBurnerSession(): void;
    /** Returns whether a burner session is active. */
    isBurnerActive(): boolean;
    /**
     * Immediate full lockdown — PANIC mode.
     *
     * 1. Activate ghost mode with reason 'panic'.
     * 2. Burn all active sessions (expunge them).
     * 3. Set privacy tier to GHOST (maximum).
     * 4. Enable decoy mode.
     * 5. Emit the 'panic' event.
     */
    panic(): void;
    /** Set the duress password — entering this password triggers panic mode. */
    setDuressPassword(password: string): void;
    /**
     * Check whether the supplied password matches the duress password.
     *
     * If it matches, automatically triggers panic mode and returns true.
     * Otherwise returns false.
     */
    checkDuressPassword(password: string): boolean;
    /**
     * Subscribe to a shadow mode lifecycle event.
     *
     * Returns an unsubscribe function.
     */
    on(event: 'activate' | 'deactivate' | 'panic', handler: ShadowEventHandler): () => void;
    private _emit;
}
/**
 * Create a new ShadowModeController instance.
 */
export declare function createShadowModeController(privacyKernel: IPrivacyKernel, sessionManager: SessionManager): ShadowModeController;
export {};
//# sourceMappingURL=shadow-mode-controller.d.ts.map