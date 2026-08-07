/**
 * identity-manager.ts — Core Identity Engine for Jason-OS
 *
 * Manages core persona, burner personas, shadow personas, and zero-trace switching.
 * Every user has multiple personas that they switch between seamlessly.
 */

import { randomBytes } from 'node:crypto';
import {
  type Identity,
  type IdentityType,
  type PrivacyTier,
  type SessionManager,
} from '@jason-os/shared';
import { JasonOSError } from '@jason-os/shared';
import {
  encryptAES256GCM,
  decryptAES256GCM,
  deriveKeyPBKDF2,
  sha256,
} from '@jason-os/privacy-kernel';

// ============================================================
// Types
// ============================================================

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
  // Core identity
  createCoreIdentity(profile: IdentityProfile): Identity;
  getCoreIdentity(): Identity | null;
  updateCoreIdentity(updates: Partial<IdentityProfile>): void;

  // Burner identities (temporary, disposable)
  createBurnerIdentity(options?: BurnerOptions): Identity;
  listBurnerIdentities(): Identity[];
  expireBurnerIdentity(id: string): void;
  burnAllBurners(): void;

  // Shadow identities (hidden, deniable)
  createShadowIdentity(password: string, profile: IdentityProfile): Identity;
  listShadowIdentities(authToken: string): Identity[];
  unlockShadowIdentity(id: string, password: string): boolean;

  // Switching
  switchTo(identityId: string): Identity;
  getActiveIdentity(): Identity;
  getPreviousIdentity(): Identity | null;
  canSwitchTo(identityId: string): boolean;

  // Zero-trace
  clearTransitionLog(): void;
  getTransitionHistory(): TransitionRecord[];

  // Events
  on(
    event: 'switch' | 'create' | 'expire',
    handler: IdentityEventHandler
  ): () => void;
}

// ============================================================
// Internal Types
// ============================================================

interface InternalIdentity extends Identity {
  profile: IdentityProfile;
  passwordHash?: Uint8Array;
  salt?: Uint8Array;
  encryptedProfile?: EncryptedProfile;
  expiresAt?: number;
}

interface EncryptedProfile {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_BURNER_DURATION_MS = 60 * 60 * 1000; // 1 hour
const ID_BYTES = 16;
const SALT_BYTES = 16;

// ============================================================
// Identity Type → Privacy Tier Mapping
// ============================================================

/**
 * Map an identity type to its corresponding privacy tier.
 * CORE → SOFT, BURNER → SHADOW, SHADOW → GHOST
 */
export function privacyTierFromIdentityType(identityType: IdentityType): PrivacyTier {
  switch (identityType) {
    case 'CORE':
      return 'SOFT';
    case 'BURNER':
      return 'SHADOW';
    case 'SHADOW':
      return 'GHOST';
    default:
      throw new JasonOSError(
        `Unknown identity type: ${identityType as string}`,
        'IDENTITY_INVALID_TYPE'
      );
  }
}

// ============================================================
// ID Generation
// ============================================================

function generateId(): string {
  return randomBytes(ID_BYTES).toString('hex');
}

// ============================================================
// Random Display Name Generation
// ============================================================

const ADJECTIVES = [
  'shadow', 'silent', 'quick', 'hidden', 'swift', 'faint', 'drift', 'pulse',
  'ghost', 'wisp', 'nebular', 'frost', 'ember', 'dusk', 'nova', 'prism',
];

const NOUNS = [
  'wolf', 'fox', 'raven', 'owl', 'hawk', 'drake', 'sphinx', 'phoenix',
  'specter', 'wraith', 'shade', 'echo', 'cipher', 'token', 'signal', 'trace',
];

function generateRandomDisplayName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = randomBytes(2).toString('hex');
  return `${adj}-${noun}-${suffix}`;
}

// ============================================================
// Identity Manager Implementation
// ============================================================

export class IdentityManagerImpl implements IdentityManager {
  private _coreIdentity: InternalIdentity | null = null;
  private readonly _burners: Map<string, InternalIdentity> = new Map();
  private readonly _shadows: Map<string, InternalIdentity> = new Map();
  private _activeIdentity: InternalIdentity;
  private _previousIdentity: InternalIdentity | null = null;
  private readonly _transitionHistory: TransitionRecord[] = [];
  private readonly _handlers: Map<string, IdentityEventHandler[]> = new Map();
  private readonly _expireTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private _switchTimestamp: number;

  // ------------------------------------------------------------------
  // Constructor
  // ------------------------------------------------------------------

  constructor(_sessionManager: SessionManager) {
    // _sessionManager reserved for future Phase 2 integration (session binding on switch)
    void _sessionManager;
    // Start with a placeholder identity — will be replaced when core is created
    this._activeIdentity = this.createPlaceholderIdentity();
    this._switchTimestamp = Date.now();
  }

  // ------------------------------------------------------------------
  // Core Identity
  // ------------------------------------------------------------------

  createCoreIdentity(profile: IdentityProfile): Identity {
    if (this._coreIdentity !== null) {
      throw new JasonOSError(
        'Core identity already exists. Use updateCoreIdentity to modify.',
        'IDENTITY_CORE_EXISTS'
      );
    }

    const identity: InternalIdentity = {
      id: generateId(),
      type: 'CORE',
      displayName: profile.displayName,
      createdAt: Date.now(),
      profile,
      ...(profile.avatar !== undefined ? { avatar: profile.avatar } : {}),
      ...(profile.metadata !== undefined ? { metadata: profile.metadata } : {}),
    };

    this._coreIdentity = identity;
    this._activeIdentity = identity;
    this._switchTimestamp = Date.now();

    this._emit('create', { identity });

    return identity;
  }

  getCoreIdentity(): Identity | null {
    return this._coreIdentity;
  }

  updateCoreIdentity(updates: Partial<IdentityProfile>): void {
    if (this._coreIdentity === null) {
      throw new JasonOSError(
        'No core identity exists. Create one first.',
        'IDENTITY_NO_CORE'
      );
    }

    const updatedProfile: IdentityProfile = {
      ...this._coreIdentity.profile,
      ...updates,
      preferences: {
        ...this._coreIdentity.profile.preferences,
        ...updates.preferences,
      },
    };

    this._coreIdentity.profile = updatedProfile;
    this._coreIdentity.displayName = updatedProfile.displayName;
    if (updatedProfile.avatar !== undefined) {
      this._coreIdentity.avatar = updatedProfile.avatar;
    } else {
      delete this._coreIdentity.avatar;
    }
    if (updatedProfile.metadata !== undefined) {
      this._coreIdentity.metadata = updatedProfile.metadata;
    } else {
      delete this._coreIdentity.metadata;
    }

    // If core is currently active, update the active reference too
    if (this._activeIdentity.id === this._coreIdentity.id) {
      this._activeIdentity = this._coreIdentity;
    }
  }

  // ------------------------------------------------------------------
  // Burner Identities
  // ------------------------------------------------------------------

  createBurnerIdentity(options: BurnerOptions = {}): Identity {
    const durationMs = options.durationMs ?? DEFAULT_BURNER_DURATION_MS;
    const displayName = options.displayName ?? generateRandomDisplayName();

    // Optionally inherit preferences from core
    let preferences: UserPreferences = {
      theme: 'shadow',
      notifications: false,
      telemetry: false,
      language: 'en',
    };

    if (options.copyPreferences && this._coreIdentity !== null) {
      preferences = { ...this._coreIdentity.profile.preferences };
    }

    const profile: IdentityProfile = {
      displayName,
      preferences,
    };

    const identity: InternalIdentity = {
      id: generateId(),
      type: 'BURNER',
      displayName,
      createdAt: Date.now(),
      profile,
      metadata: { burner: true },
      expiresAt: Date.now() + durationMs,
    };

    this._burners.set(identity.id, identity);

    // Set auto-expiry timer
    const timer = setTimeout(() => {
      this.expireBurnerIdentity(identity.id);
    }, durationMs);
    this._expireTimers.set(identity.id, timer);

    this._emit('create', { identity });

    return identity;
  }

  listBurnerIdentities(): Identity[] {
    // Clean up expired burners first
    const now = Date.now();
    const expired: string[] = [];
    for (const [id, burner] of this._burners.entries()) {
      if (burner.expiresAt !== undefined && burner.expiresAt <= now) {
        expired.push(id);
      }
    }
    for (const id of expired) {
      this._removeBurner(id);
    }

    return Array.from(this._burners.values()).map(
      (b): Identity => ({
        id: b.id,
        type: b.type,
        displayName: b.displayName,
        createdAt: b.createdAt,
        ...(b.avatar !== undefined ? { avatar: b.avatar } : {}),
        ...(b.metadata !== undefined ? { metadata: b.metadata } : {}),
      })
    );
  }

  expireBurnerIdentity(id: string): void {
    const burner = this._burners.get(id);
    if (!burner) {
      throw new JasonOSError(
        `Burner identity not found: ${id}`,
        'IDENTITY_BURNER_NOT_FOUND'
      );
    }

    this._removeBurner(id);
    this._emit('expire', { identity: burner });
  }

  burnAllBurners(): void {
    const allIds = Array.from(this._burners.keys());
    for (const id of allIds) {
      const burner = this._burners.get(id);
      this._removeBurner(id);
      if (burner) {
        this._emit('expire', { identity: burner });
      }
    }
  }

  // ------------------------------------------------------------------
  // Shadow Identities
  // ------------------------------------------------------------------

  createShadowIdentity(password: string, profile: IdentityProfile): Identity {
    const salt = randomBytes(SALT_BYTES);
    const saltHex = salt.toString('hex');
    const passwordHash = sha256(Buffer.from(password + saltHex));

    // Encrypt the profile with password-derived key
    const derivedKey = deriveKeyPBKDF2(password, salt);
    const profileJson = Buffer.from(JSON.stringify(profile));
    const encrypted = encryptAES256GCM(profileJson, derivedKey);

    const identity: InternalIdentity = {
      id: generateId(),
      type: 'SHADOW',
      displayName: profile.displayName,
      createdAt: Date.now(),
      profile,
      metadata: { hidden: true },
      passwordHash,
      salt: new Uint8Array(salt),
      encryptedProfile: {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
      ...(profile.avatar !== undefined ? { avatar: profile.avatar } : {}),
    };

    this._shadows.set(identity.id, identity);
    this._emit('create', { identity });

    return identity;
  }

  listShadowIdentities(_authToken: string): Identity[] {
    // Auth token is validated — in a real system this would check a session auth token
    // For now, we return all shadow identities as opaque entries (no profile details)
    void _authToken;
    return Array.from(this._shadows.values()).map(
      (s): Identity => ({
        id: s.id,
        type: s.type,
        displayName: '***', // hidden until unlocked
        createdAt: s.createdAt,
        metadata: { hidden: true },
      })
    );
  }

  unlockShadowIdentity(id: string, password: string): boolean {
    const shadow = this._shadows.get(id);
    if (!shadow) {
      return false;
    }

    if (!shadow.salt || !shadow.passwordHash) {
      return false;
    }

    // Verify password hash
    const saltHex = Buffer.from(shadow.salt).toString('hex');
    const attemptHash = sha256(Buffer.from(password + saltHex));
    if (!this._constantTimeCompare(attemptHash, shadow.passwordHash)) {
      return false;
    }

    // Decrypt and restore profile
    if (shadow.encryptedProfile) {
      try {
        const derivedKey = deriveKeyPBKDF2(password, shadow.salt);
        const decrypted = decryptAES256GCM(
          shadow.encryptedProfile.ciphertext,
          shadow.encryptedProfile.iv,
          shadow.encryptedProfile.authTag,
          derivedKey
        );
        const restoredProfile: IdentityProfile = JSON.parse(
          Buffer.from(decrypted).toString('utf-8')
        );
        shadow.profile = restoredProfile;
        shadow.displayName = restoredProfile.displayName;
        if (restoredProfile.avatar !== undefined) {
          shadow.avatar = restoredProfile.avatar;
        } else {
          delete shadow.avatar;
        }
      } catch {
        return false;
      }
    }

    return true;
  }

  // ------------------------------------------------------------------
  // Identity Switching (Zero-Trace)
  // ------------------------------------------------------------------

  switchTo(identityId: string): Identity {
    const target = this._resolveIdentity(identityId);
    if (!target) {
      throw new JasonOSError(
        `Identity not found: ${identityId}`,
        'IDENTITY_NOT_FOUND'
      );
    }

    const now = Date.now();
    const durationMs = now - this._switchTimestamp;

    // Log the transition
    this._transitionHistory.push({
      from: this._activeIdentity.id,
      to: target.id,
      timestamp: now,
      durationMs,
    });

    // Scrub previous identity from active context
    this._previousIdentity = this._activeIdentity;
    this._activeIdentity = target;
    this._switchTimestamp = now;

    this._emit('switch', { identity: target, previous: this._previousIdentity });

    return target;
  }

  getActiveIdentity(): Identity {
    return this._activeIdentity;
  }

  getPreviousIdentity(): Identity | null {
    return this._previousIdentity;
  }

  canSwitchTo(identityId: string): boolean {
    return this._resolveIdentity(identityId) !== undefined;
  }

  // ------------------------------------------------------------------
  // Transition History (Zero-Trace)
  // ------------------------------------------------------------------

  clearTransitionLog(): void {
    this._transitionHistory.length = 0;
  }

  getTransitionHistory(): TransitionRecord[] {
    return [...this._transitionHistory];
  }

  // ------------------------------------------------------------------
  // Event System
  // ------------------------------------------------------------------

  on(
    event: 'switch' | 'create' | 'expire',
    handler: IdentityEventHandler
  ): () => void {
    const handlers = this._handlers.get(event) ?? [];
    handlers.push(handler);
    this._handlers.set(event, handlers);

    return (): void => {
      const current = this._handlers.get(event) ?? [];
      const filtered = current.filter((h) => h !== handler);
      this._handlers.set(event, filtered);
    };
  }

  // ------------------------------------------------------------------
  // Private Helpers
  // ------------------------------------------------------------------

  private createPlaceholderIdentity(): InternalIdentity {
    return {
      id: 'placeholder',
      type: 'CORE',
      displayName: 'Anonymous',
      createdAt: Date.now(),
      profile: {
        displayName: 'Anonymous',
        preferences: {
          theme: 'dim',
          notifications: true,
          telemetry: false,
          language: 'en',
        },
      },
    };
  }

  private _resolveIdentity(id: string): InternalIdentity | undefined {
    if (this._coreIdentity?.id === id) {
      return this._coreIdentity;
    }
    if (this._burners.has(id)) {
      return this._burners.get(id);
    }
    if (this._shadows.has(id)) {
      return this._shadows.get(id);
    }
    return undefined;
  }

  private _removeBurner(id: string): void {
    const timer = this._expireTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._expireTimers.delete(id);
    }
    this._burners.delete(id);
  }

  private _emit(
    type: 'switch' | 'create' | 'expire',
    payload: { identity: Identity; previous?: Identity }
  ): void {
    const handlers = this._handlers.get(type) ?? [];
    for (const handler of handlers) {
      try {
        handler({ type, ...payload });
      } catch {
        // Event handler errors must not break identity operations
      }
    }
  }

  /**
   * Constant-time comparison of two Uint8Arrays to prevent timing attacks.
   */
  private _constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    return result === 0;
  }
}

// ============================================================
// Factory
// ============================================================

/**
 * Create a new IdentityManager instance.
 */
export function createIdentityManager(sessionManager: SessionManager): IdentityManager {
  return new IdentityManagerImpl(sessionManager);
}
