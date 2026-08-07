/**
 * identity-manager.ts — Core Identity Engine for Jason-OS
 *
 * Manages core persona, burner personas, shadow personas, and zero-trace switching.
 * Every user has multiple personas that they switch between seamlessly.
 */
import { type Identity, type IdentityType, type PrivacyTier, type SessionManager } from '@jason-os/shared';
/**
 * User preferences for an identity.
 */
export interface UserPreferences {
    theme: 'dim' | 'soft' | 'shadow' | 'quiet';
    notifications: boolean;
    telemetry: boolean;
    language: string;
}
/**
 * Emotional baseline for an identity.
 */
export interface EmotionalBaseline {
    valence: number;
    arousal: number;
    dominance: number;
    stress: number;
}
/**
 * Profile used to create or update an identity.
 */
export interface IdentityProfile {
    displayName: string;
    avatar?: string;
    preferences: UserPreferences;
    emotionalBaseline?: EmotionalBaseline;
    metadata?: Record<string, unknown>;
}
/**
 * Options for creating a burner identity.
 */
export interface BurnerOptions {
    durationMs?: number;
    displayName?: string;
    copyPreferences?: boolean;
}
/**
 * Record of a transition between identities.
 */
export interface TransitionRecord {
    from: string;
    to: string;
    timestamp: number;
    durationMs: number;
}
/**
 * Event handler for identity lifecycle events.
 */
export type IdentityEventHandler = (event: {
    type: string;
    identity: Identity;
    previous?: Identity;
}) => void;
/**
 * The main Identity Manager interface.
 */
export interface IdentityManager {
    createCoreIdentity(profile: IdentityProfile): Identity;
    getCoreIdentity(): Identity | null;
    updateCoreIdentity(updates: Partial<IdentityProfile>): void;
    createBurnerIdentity(options?: BurnerOptions): Identity;
    listBurnerIdentities(): Identity[];
    expireBurnerIdentity(id: string): void;
    burnAllBurners(): void;
    createShadowIdentity(password: string, profile: IdentityProfile): Identity;
    listShadowIdentities(authToken: string): Identity[];
    unlockShadowIdentity(id: string, password: string): boolean;
    switchTo(identityId: string): Identity;
    getActiveIdentity(): Identity;
    getPreviousIdentity(): Identity | null;
    canSwitchTo(identityId: string): boolean;
    clearTransitionLog(): void;
    getTransitionHistory(): TransitionRecord[];
    on(event: 'switch' | 'create' | 'expire', handler: IdentityEventHandler): () => void;
}
/**
 * Map an identity type to its corresponding privacy tier.
 * CORE → SOFT, BURNER → SHADOW, SHADOW → GHOST
 */
export declare function privacyTierFromIdentityType(identityType: IdentityType): PrivacyTier;
export declare class IdentityManagerImpl implements IdentityManager {
    private _coreIdentity;
    private readonly _burners;
    private readonly _shadows;
    private _activeIdentity;
    private _previousIdentity;
    private readonly _transitionHistory;
    private readonly _handlers;
    private readonly _expireTimers;
    private _switchTimestamp;
    constructor(_sessionManager: SessionManager);
    createCoreIdentity(profile: IdentityProfile): Identity;
    getCoreIdentity(): Identity | null;
    updateCoreIdentity(updates: Partial<IdentityProfile>): void;
    createBurnerIdentity(options?: BurnerOptions): Identity;
    listBurnerIdentities(): Identity[];
    expireBurnerIdentity(id: string): void;
    burnAllBurners(): void;
    createShadowIdentity(password: string, profile: IdentityProfile): Identity;
    listShadowIdentities(_authToken: string): Identity[];
    unlockShadowIdentity(id: string, password: string): boolean;
    switchTo(identityId: string): Identity;
    getActiveIdentity(): Identity;
    getPreviousIdentity(): Identity | null;
    canSwitchTo(identityId: string): boolean;
    clearTransitionLog(): void;
    getTransitionHistory(): TransitionRecord[];
    on(event: 'switch' | 'create' | 'expire', handler: IdentityEventHandler): () => void;
    private createPlaceholderIdentity;
    private _resolveIdentity;
    private _removeBurner;
    private _emit;
    /**
     * Constant-time comparison of two Uint8Arrays to prevent timing attacks.
     */
    private _constantTimeCompare;
}
/**
 * Create a new IdentityManager instance.
 */
export declare function createIdentityManager(sessionManager: SessionManager): IdentityManager;
//# sourceMappingURL=identity-manager.d.ts.map