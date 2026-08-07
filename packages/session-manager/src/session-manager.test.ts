import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemorySessionManager, privacyTierFromIdentityType } from './session-manager';
import type { Identity, Session } from '@jason-os/shared';
import { JasonOSError } from '@jason-os/shared';

// ============================================================
// Helpers
// ============================================================

function createTestIdentity(overrides?: Partial<Identity>): Identity {
  return {
    id: 'test-id-1',
    type: 'CORE',
    displayName: 'Test Identity',
    createdAt: Date.now(),
    ...overrides,
  };
}

// ============================================================
// Test Suite
// ============================================================

describe('InMemorySessionManager', () => {
  let manager: InMemorySessionManager;

  beforeEach(() => {
    manager = new InMemorySessionManager();
    vi.useFakeTimers();
  });

  // Test 1: Create session returns valid session with token
  it('createSession returns a valid session with a token', async () => {
    const identity = createTestIdentity();
    const session = await manager.createSession(identity);

    expect(session).toBeDefined();
    expect(session.id).toBeTruthy();
    expect(session.token).toBeTruthy();
    expect(session.token.length).toBeGreaterThan(0);
    expect(session.identity).toEqual(identity);
    expect(session.createdAt).toBeLessThanOrEqual(Date.now());
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(session.isBurner).toBe(false);
    expect(session.privacyTier).toBe('SOFT');
  });

  // Test 2: Resume session with valid token
  it('resumeSession returns the session when given a valid token', async () => {
    const identity = createTestIdentity();
    const created = await manager.createSession(identity);
    const resumed = await manager.resumeSession(created.token);

    expect(resumed).not.toBeNull();
    expect(resumed!.id).toBe(created.id);
    expect(resumed!.token).toBe(created.token);
    expect(resumed!.identity.id).toBe(identity.id);
  });

  // Test 3: Resume with invalid token returns null
  it('resumeSession returns null for an invalid token', async () => {
    const result = await manager.resumeSession('invalid-token-string');
    expect(result).toBeNull();
  });

  // Test 4: Expire session removes it
  it('expireSession removes the session', async () => {
    const identity = createTestIdentity();
    const session = await manager.createSession(identity);

    expect(await manager.resumeSession(session.token)).not.toBeNull();

    await manager.expireSession(session.id);

    expect(await manager.resumeSession(session.token)).toBeNull();
    expect(manager.listActiveSessions()).toHaveLength(0);
  });

  // Test 5: Get active session
  it('getActiveSession returns the most recently created session', async () => {
    const identity1 = createTestIdentity({ id: 'id-1', displayName: 'First' });
    const identity2 = createTestIdentity({ id: 'id-2', displayName: 'Second' });

    const session1 = await manager.createSession(identity1);
    vi.advanceTimersByTime(1000);
    const session2 = await manager.createSession(identity2);

    const active = manager.getActiveSession();

    expect(active).not.toBeNull();
    expect(active!.id).toBe(session2.id);
  });

  // Test 6: List active sessions (multiple)
  it('listActiveSessions returns all active sessions', async () => {
    const identity1 = createTestIdentity({ id: 'id-1', displayName: 'First' });
    const identity2 = createTestIdentity({ id: 'id-2', displayName: 'Second' });
    const identity3 = createTestIdentity({ id: 'id-3', displayName: 'Third' });

    await manager.createSession(identity1);
    await manager.createSession(identity2);
    await manager.createSession(identity3);

    const sessions = manager.listActiveSessions();
    expect(sessions).toHaveLength(3);
  });

  // Test 7: Create burner session (isBurner=true, random identity)
  it('createBurnerSession returns a burner session with auto-generated identity', async () => {
    const session = await manager.createBurnerSession();

    expect(session.isBurner).toBe(true);
    expect(session.identity.type).toBe('BURNER');
    expect(session.identity.displayName).toMatch(/^Burner-/);
    expect(session.identity.id).toBeTruthy();
    expect(session.identity.id.length).toBeGreaterThan(0);
    expect(session.privacyTier).toBe('SHADOW');
  });

  // Test 8: Switch identity updates session
  it('switchIdentity updates the session identity in-place', async () => {
    const identity1 = createTestIdentity({ id: 'id-1', type: 'CORE', displayName: 'Original' });
    const session = await manager.createSession(identity1);

    const newIdentity = createTestIdentity({
      id: 'id-2',
      type: 'SHADOW',
      displayName: 'Switched',
    });

    const updated = await manager.switchIdentity(session.id, newIdentity);

    expect(updated.identity.id).toBe('id-2');
    expect(updated.identity.type).toBe('SHADOW');
    expect(updated.identity.displayName).toBe('Switched');
    expect(updated.privacyTier).toBe('GHOST');

    // Verify via resume
    const resumed = await manager.resumeSession(session.token);
    expect(resumed!.identity.id).toBe('id-2');
  });

  // Test 9: Extend session pushes expiry
  it('extendSession pushes the expiry time forward', async () => {
    const identity = createTestIdentity();
    const session = await manager.createSession(identity);

    const originalExpiry = session.expiresAt;
    const extensionMs = 60 * 60 * 1000; // 1 hour

    await manager.extendSession(session.id, extensionMs);

    const resumed = await manager.resumeSession(session.token);
    expect(resumed!.expiresAt).toBe(originalExpiry + extensionMs);
  });

  // Test 10: Auto-expiry of old sessions
  it('auto-expires old sessions on operations', async () => {
    const identity = createTestIdentity();
    const session = await manager.createSession(identity);

    // Advance time past the default 24h expiry
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);

    // Any operation should trigger cleanup
    const result = await manager.resumeSession(session.token);
    expect(result).toBeNull();

    const sessions = manager.listActiveSessions();
    expect(sessions).toHaveLength(0);
  });

  // Test 11: Session expire callback fires
  it('onSessionExpire callback fires when a session expires', async () => {
    const handler = vi.fn();
    manager.onSessionExpire(handler);

    const identity = createTestIdentity();
    const session = await manager.createSession(identity);

    await manager.expireSession(session.id);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: session.id }));
  });

  // Test 12: Multiple callbacks all fire
  it('all registered onSessionExpire callbacks fire', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    manager.onSessionExpire(handler1);
    manager.onSessionExpire(handler2);
    manager.onSessionExpire(handler3);

    const identity = createTestIdentity();
    const session = await manager.createSession(identity);

    await manager.expireSession(session.id);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
  });

  // Test 13: Unsubscribe callback stops firing
  it('unsubscribing from onSessionExpire stops the callback from firing', async () => {
    const handler = vi.fn();
    const unsubscribe = manager.onSessionExpire(handler);

    const identity = createTestIdentity();
    const session = await manager.createSession(identity);

    // Unsubscribe before expiring
    unsubscribe();

    await manager.expireSession(session.id);

    expect(handler).not.toHaveBeenCalled();
  });

  // Test 14: Burner session has shorter expiry
  it('burner session has shorter expiry than regular session', async () => {
    const regularIdentity = createTestIdentity();
    const regularSession = await manager.createSession(regularIdentity);
    const burnerSession = await manager.createBurnerSession();

    const regularDuration = regularSession.expiresAt - regularSession.createdAt;
    const burnerDuration = burnerSession.expiresAt - burnerSession.createdAt;

    expect(burnerDuration).toBeLessThan(regularDuration);
    expect(burnerDuration).toBe(60 * 60 * 1000); // 1 hour
    expect(regularDuration).toBe(24 * 60 * 60 * 1000); // 24 hours
  });

  // Test 15: Privacy tier derived from identity type
  it('privacyTierFromIdentityType maps identity types to correct privacy tiers', () => {
    expect(privacyTierFromIdentityType('CORE')).toBe('SOFT');
    expect(privacyTierFromIdentityType('BURNER')).toBe('SHADOW');
    expect(privacyTierFromIdentityType('SHADOW')).toBe('GHOST');
  });
});

// ============================================================
// Error Cases
// ============================================================

describe('InMemorySessionManager — error cases', () => {
  let manager: InMemorySessionManager;

  beforeEach(() => {
    manager = new InMemorySessionManager();
    vi.useFakeTimers();
  });

  it('switchIdentity throws for non-existent session', async () => {
    const identity = createTestIdentity();
    await expect(manager.switchIdentity('non-existent-id', identity)).rejects.toThrow(
      JasonOSError
    );
  });

  it('extendSession throws for non-existent session', async () => {
    await expect(manager.extendSession('non-existent-id', 1000)).rejects.toThrow(
      JasonOSError
    );
  });

  it('privacyTierFromIdentityType throws for unknown identity type', () => {
    expect(() =>
      privacyTierFromIdentityType('UNKNOWN' as Identity['type'])
    ).toThrow(JasonOSError);
  });
});
