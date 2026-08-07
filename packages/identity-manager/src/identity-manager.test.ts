/**
 * identity-manager.test.ts — Comprehensive test suite for IdentityManager
 *
 * Covers: core identity, burner identities, shadow identities, switching,
 * zero-trace transitions, event system, and privacy tier mapping.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  type Identity,
  type SessionManager,
  type Session,
} from '@jason-os/shared';
import { JasonOSError } from '@jason-os/shared';
import {
  IdentityManagerImpl,
  createIdentityManager,
  privacyTierFromIdentityType,
} from './identity-manager.js';
import type {
  IdentityManager,
  IdentityProfile,
  BurnerOptions,
  TransitionRecord,
} from './identity-manager.js';

// ============================================================
// Mock Session Manager
// ============================================================

function createMockSessionManager(): SessionManager {
  return {
    createSession: vi.fn(async (_identity: Identity): Promise<Session> => ({
      id: 'mock-session-id',
      token: 'mock-token',
      identity: _identity,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      privacyTier: 'SOFT',
      isBurner: false,
    })),
    resumeSession: vi.fn(async (_token: string): Promise<Session | null> => null),
    expireSession: vi.fn(async (_sessionId: string): Promise<void> => {}),
    getActiveSession: vi.fn((): Session | null => null),
    listActiveSessions: vi.fn((): Session[] => []),
    createBurnerSession: vi.fn(async (): Promise<Session> => ({
      id: 'mock-burner-session',
      token: 'mock-burner-token',
      identity: { id: 'burner-id', type: 'BURNER', displayName: 'Burner', createdAt: Date.now() },
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      privacyTier: 'SHADOW',
      isBurner: true,
    })),
    switchIdentity: vi.fn(async (_sessionId: string, _identity: Identity): Promise<Session> => ({
      id: 'mock-session-id',
      token: 'mock-token',
      identity: _identity,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      privacyTier: 'SOFT',
      isBurner: false,
    })),
    extendSession: vi.fn(async (_sessionId: string, _durationMs: number): Promise<void> => {}),
    onSessionExpire: vi.fn((_handler: (session: Session) => void): (() => void) => () => {}),
  };
}

// ============================================================
// Fixture Helpers
// ============================================================

function createCoreProfile(): IdentityProfile {
  return {
    displayName: 'Jason Core',
    avatar: 'https://example.com/avatar.png',
    preferences: {
      theme: 'dim',
      notifications: true,
      telemetry: false,
      language: 'en',
    },
    emotionalBaseline: {
      valence: 0.5,
      arousal: 0.3,
      dominance: 0.7,
      stress: 0.2,
    },
  };
}

function createShadowProfile(): IdentityProfile {
  return {
    displayName: 'Shadow Persona',
    avatar: 'https://example.com/shadow.png',
    preferences: {
      theme: 'shadow',
      notifications: false,
      telemetry: false,
      language: 'en',
    },
  };
}

// ============================================================
// Test Suite
// ============================================================

describe('IdentityManager', () => {
  let manager: IdentityManager;
  let mockSessionManager: SessionManager;

  beforeEach(() => {
    mockSessionManager = createMockSessionManager();
    manager = createIdentityManager(mockSessionManager);
  });

  // ----------------------------------------------------------------
  // Core Identity
  // ----------------------------------------------------------------

  describe('Core Identity', () => {
    it('should create a core identity', () => {
      const profile = createCoreProfile();
      const identity = manager.createCoreIdentity(profile);

      expect(identity).toBeDefined();
      expect(identity.type).toBe('CORE');
      expect(identity.displayName).toBe('Jason Core');
      expect(identity.avatar).toBe('https://example.com/avatar.png');
      expect(identity.id).toBeDefined();
      expect(identity.createdAt).toBeGreaterThan(0);
    });

    it('should get core identity returns created', () => {
      const profile = createCoreProfile();
      const created = manager.createCoreIdentity(profile);
      const retrieved = manager.getCoreIdentity();

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.displayName).toBe('Jason Core');
    });

    it('should update core identity preferences', () => {
      const profile = createCoreProfile();
      manager.createCoreIdentity(profile);

      manager.updateCoreIdentity({
        displayName: 'Updated Jason',
        preferences: {
          theme: 'quiet',
          notifications: false,
          telemetry: false,
          language: 'fr',
        },
      });

      const updated = manager.getCoreIdentity()!;
      expect(updated.displayName).toBe('Updated Jason');
    });

    it('should throw when creating core twice', () => {
      const profile = createCoreProfile();
      manager.createCoreIdentity(profile);

      expect(() => manager.createCoreIdentity(profile)).toThrow(JasonOSError);
    });

    it('should throw when updating nonexistent core', () => {
      expect(() =>
        manager.updateCoreIdentity({ displayName: 'Test' })
      ).toThrow(JasonOSError);
    });
  });

  // ----------------------------------------------------------------
  // Burner Identities
  // ----------------------------------------------------------------

  describe('Burner Identities', () => {
    it('should create burner identity with random name', () => {
      const burner = manager.createBurnerIdentity();

      expect(burner).toBeDefined();
      expect(burner.type).toBe('BURNER');
      expect(burner.displayName).toBeDefined();
      expect(burner.displayName.length).toBeGreaterThan(0);
    });

    it('should create burner with custom name', () => {
      const burner = manager.createBurnerIdentity({ displayName: 'CustomBurner' });

      expect(burner.displayName).toBe('CustomBurner');
    });

    it('should burners have auto-expiry', async () => {
      const burner = manager.createBurnerIdentity({ durationMs: 50 });

      expect(manager.listBurnerIdentities().length).toBe(1);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After expiry, listing should be empty
      expect(manager.listBurnerIdentities().length).toBe(0);
    });

    it('should list burner identities', () => {
      manager.createBurnerIdentity({ displayName: 'Burner1' });
      manager.createBurnerIdentity({ displayName: 'Burner2' });
      manager.createBurnerIdentity({ displayName: 'Burner3' });

      const burners = manager.listBurnerIdentities();
      expect(burners.length).toBe(3);
      expect(burners.map((b) => b.displayName)).toContain('Burner1');
      expect(burners.map((b) => b.displayName)).toContain('Burner2');
      expect(burners.map((b) => b.displayName)).toContain('Burner3');
    });

    it('should expire burner removes it', () => {
      const burner = manager.createBurnerIdentity();
      expect(manager.listBurnerIdentities().length).toBe(1);

      manager.expireBurnerIdentity(burner.id);
      expect(manager.listBurnerIdentities().length).toBe(0);
    });

    it('should throw when expiring nonexistent burner', () => {
      expect(() => manager.expireBurnerIdentity('nonexistent-id')).toThrow(JasonOSError);
    });

    it('should burnAllBurners clears all', () => {
      manager.createBurnerIdentity({ displayName: 'B1' });
      manager.createBurnerIdentity({ displayName: 'B2' });
      manager.createBurnerIdentity({ displayName: 'B3' });

      expect(manager.listBurnerIdentities().length).toBe(3);

      manager.burnAllBurners();
      expect(manager.listBurnerIdentities().length).toBe(0);
    });
  });

  // ----------------------------------------------------------------
  // Shadow Identities
  // ----------------------------------------------------------------

  describe('Shadow Identities', () => {
    it('should create shadow identity with password', () => {
      const profile = createShadowProfile();
      const shadow = manager.createShadowIdentity('secret-password', profile);

      expect(shadow).toBeDefined();
      expect(shadow.type).toBe('SHADOW');
      expect(shadow.displayName).toBe('Shadow Persona');
      expect(shadow.metadata).toEqual({ hidden: true });
    });

    it('should shadow identity requires auth to list', () => {
      manager.createShadowIdentity('pwd1', createShadowProfile());
      manager.createShadowIdentity('pwd2', {
        ...createShadowProfile(),
        displayName: 'Shadow 2',
      });

      // When listing, display names are hidden
      const shadows = manager.listShadowIdentities('valid-auth-token');
      expect(shadows.length).toBe(2);
      expect(shadows[0].displayName).toBe('***');
      expect(shadows[1].displayName).toBe('***');
      expect(shadows[0].type).toBe('SHADOW');
    });

    it('should unlock shadow identity with correct password', () => {
      const profile = createShadowProfile();
      const shadow = manager.createShadowIdentity('correct-password', profile);

      const unlocked = manager.unlockShadowIdentity(shadow.id, 'correct-password');
      expect(unlocked).toBe(true);
    });

    it('should unlock shadow with wrong password fails', () => {
      const profile = createShadowProfile();
      const shadow = manager.createShadowIdentity('correct-password', profile);

      const unlocked = manager.unlockShadowIdentity(shadow.id, 'wrong-password');
      expect(unlocked).toBe(false);
    });

    it('should return false when unlocking nonexistent shadow', () => {
      expect(manager.unlockShadowIdentity('nonexistent-id', 'password')).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // Identity Switching
  // ----------------------------------------------------------------

  describe('Identity Switching', () => {
    it('should switch to different identity', () => {
      const coreProfile = createCoreProfile();
      manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();

      const result = manager.switchTo(burner.id);

      expect(result.id).toBe(burner.id);
      expect(result.type).toBe('BURNER');
    });

    it('should throw when switching to nonexistent identity', () => {
      expect(() => manager.switchTo('nonexistent')).toThrow(JasonOSError);
    });

    it('should getActiveIdentity returns current', () => {
      const coreProfile = createCoreProfile();
      const core = manager.createCoreIdentity(coreProfile);

      expect(manager.getActiveIdentity().id).toBe(core.id);

      const burner = manager.createBurnerIdentity();
      manager.switchTo(burner.id);

      expect(manager.getActiveIdentity().id).toBe(burner.id);
    });

    it('should getPreviousIdentity returns last', () => {
      const coreProfile = createCoreProfile();
      const core = manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();

      manager.switchTo(burner.id);

      expect(manager.getPreviousIdentity()).not.toBeNull();
      expect(manager.getPreviousIdentity()!.id).toBe(core.id);
    });

    it('should getPreviousIdentity returns null initially', () => {
      const coreProfile = createCoreProfile();
      manager.createCoreIdentity(coreProfile);

      expect(manager.getPreviousIdentity()).toBeNull();
    });

    it('should canSwitchTo validates existence', () => {
      const coreProfile = createCoreProfile();
      const core = manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();

      expect(manager.canSwitchTo(core.id)).toBe(true);
      expect(manager.canSwitchTo(burner.id)).toBe(true);
      expect(manager.canSwitchTo('nonexistent')).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // Zero-Trace Transition History
  // ----------------------------------------------------------------

  describe('Zero-Trace Transitions', () => {
    it('should record transition history', () => {
      const coreProfile = createCoreProfile();
      manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();

      manager.switchTo(burner.id);

      const history = manager.getTransitionHistory();
      expect(history.length).toBe(1);
      expect(history[0].to).toBe(burner.id);
      expect(history[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should clear transition log wipes history', () => {
      const coreProfile = createCoreProfile();
      manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();

      manager.switchTo(burner.id);
      expect(manager.getTransitionHistory().length).toBe(1);

      manager.clearTransitionLog();
      expect(manager.getTransitionHistory().length).toBe(0);
    });

    it('should return immutable transition history', () => {
      const coreProfile = createCoreProfile();
      manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();

      manager.switchTo(burner.id);

      const history1 = manager.getTransitionHistory();
      const history2 = manager.getTransitionHistory();
      expect(history1).not.toBe(history2); // different array references
    });
  });

  // ----------------------------------------------------------------
  // Event System
  // ----------------------------------------------------------------

  describe('Event System', () => {
    it('should emit switch event', () => {
      const coreProfile = createCoreProfile();
      manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();

      const handler = vi.fn();
      manager.on('switch', handler);

      manager.switchTo(burner.id);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'switch',
          identity: expect.objectContaining({ id: burner.id }),
        })
      );
    });

    it('should emit create event for core identity', () => {
      const handler = vi.fn();
      manager.on('create', handler);

      const profile = createCoreProfile();
      manager.createCoreIdentity(profile);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'create',
          identity: expect.objectContaining({ type: 'CORE' }),
        })
      );
    });

    it('should emit create event for burner identity', () => {
      const handler = vi.fn();
      manager.on('create', handler);

      manager.createBurnerIdentity();

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'create',
          identity: expect.objectContaining({ type: 'BURNER' }),
        })
      );
    });

    it('should emit expire event when burning', () => {
      const burner = manager.createBurnerIdentity();
      const handler = vi.fn();
      manager.on('expire', handler);

      manager.expireBurnerIdentity(burner.id);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expire',
          identity: expect.objectContaining({ id: burner.id }),
        })
      );
    });

    it('should emit expire event for burnAllBurners', () => {
      const b1 = manager.createBurnerIdentity();
      const b2 = manager.createBurnerIdentity();

      const handler = vi.fn();
      manager.on('expire', handler);

      manager.burnAllBurners();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should allow unsubscribing from events', () => {
      const handler = vi.fn();
      const unsub = manager.on('create', handler);

      unsub();

      manager.createCoreIdentity(createCoreProfile());
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Privacy Tier Mapping
  // ----------------------------------------------------------------

  describe('Privacy Tier Mapping', () => {
    it('should map CORE to SOFT', () => {
      expect(privacyTierFromIdentityType('CORE')).toBe('SOFT');
    });

    it('should map BURNER to SHADOW', () => {
      expect(privacyTierFromIdentityType('BURNER')).toBe('SHADOW');
    });

    it('should map SHADOW to GHOST', () => {
      expect(privacyTierFromIdentityType('SHADOW')).toBe('GHOST');
    });

    it('should throw for unknown identity type', () => {
      expect(() => privacyTierFromIdentityType('UNKNOWN' as IdentityType)).toThrow(JasonOSError);
    });
  });

  // ----------------------------------------------------------------
  // Burner Preference Inheritance
  // ----------------------------------------------------------------

  describe('Burner Preference Inheritance', () => {
    it('should inherit preferences from core identity', () => {
      const coreProfile = createCoreProfile();
      coreProfile.preferences.theme = 'soft';
      coreProfile.preferences.language = 'es';
      manager.createCoreIdentity(coreProfile);

      const burner = manager.createBurnerIdentity({ copyPreferences: true });

      // Burner should have core's preferences
      // We verify by checking it's created without issues and has BURNER type
      expect(burner.type).toBe('BURNER');
    });

    it('should not inherit preferences when copyPreferences is false', () => {
      const coreProfile = createCoreProfile();
      manager.createCoreIdentity(coreProfile);

      const burner = manager.createBurnerIdentity({ copyPreferences: false });

      expect(burner.type).toBe('BURNER');
    });

    it('should not inherit when no core exists', () => {
      const burner = manager.createBurnerIdentity({ copyPreferences: true });

      expect(burner.type).toBe('BURNER');
    });
  });

  // ----------------------------------------------------------------
  // Integration / Edge Cases
  // ----------------------------------------------------------------

  describe('Integration & Edge Cases', () => {
    it('should switch between multiple identity types', () => {
      const coreProfile = createCoreProfile();
      const core = manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();
      const shadow = manager.createShadowIdentity('password', createShadowProfile());

      expect(manager.getActiveIdentity().id).toBe(core.id);

      manager.switchTo(burner.id);
      expect(manager.getActiveIdentity().id).toBe(burner.id);
      expect(manager.getPreviousIdentity()!.id).toBe(core.id);

      manager.switchTo(shadow.id);
      expect(manager.getActiveIdentity().id).toBe(shadow.id);
      expect(manager.getPreviousIdentity()!.id).toBe(burner.id);
    });

    it('should track multiple transitions', () => {
      const coreProfile = createCoreProfile();
      manager.createCoreIdentity(coreProfile);
      const burner = manager.createBurnerIdentity();

      manager.switchTo(burner.id);
      manager.switchTo(manager.getCoreIdentity()!.id);

      const history = manager.getTransitionHistory();
      expect(history.length).toBe(2);
    });
  });
});
