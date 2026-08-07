// ============================================================
// SoftLockstep — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SoftLockstep,
  createSoftLockstepModule,
  soft_lockstep_module,
} from './module.js';
import type { LockstepPartner, LockstepState } from './types.js';

const mockPartner: LockstepPartner = {
  id: 'partner-1',
  displayName: 'Alice',
  focusScore: 0.8,
  lastPingAt: Date.now(),
};

describe('SoftLockstep', () => {
  let lockstep: SoftLockstep;

  beforeEach(() => {
    lockstep = new SoftLockstep();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = lockstep.getState();
    expect(state.active).toBe(false);
    expect(state.partner).toBeNull();
    expect(state.sessionStart).toBeNull();
    expect(state.mutualFocusScore).toBe(0);
    expect(state.syncStatus).toBe('solo');
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(lockstep.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. startPairedSession sets active state and partner
  // ----------------------------------------------------------------
  it('startPairedSession sets active state and partner', () => {
    lockstep.startPairedSession(mockPartner);
    expect(lockstep.isActive()).toBe(true);
    expect(lockstep.getPartner()).toEqual(mockPartner);
    expect(lockstep.getState().syncStatus).toBe('paired');
  });

  // ----------------------------------------------------------------
  // 4. startPairedSession sets sessionStart
  // ----------------------------------------------------------------
  it('startPairedSession sets sessionStart', () => {
    const before = Date.now();
    lockstep.startPairedSession(mockPartner);
    const after = Date.now();
    const state = lockstep.getState();
    expect(state.sessionStart).not.toBeNull();
    expect(state.sessionStart).toBeGreaterThanOrEqual(before);
    expect(state.sessionStart).toBeLessThanOrEqual(after);
  });

  // ----------------------------------------------------------------
  // 5. startPairedSession computes mutualFocusScore
  // ----------------------------------------------------------------
  it('startPairedSession computes mutualFocusScore', () => {
    lockstep.startPairedSession(mockPartner);
    const score = lockstep.getMutualFocusScore();
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  // ----------------------------------------------------------------
  // 6. endSession resets all state
  // ----------------------------------------------------------------
  it('endSession resets all state', () => {
    lockstep.startPairedSession(mockPartner);
    lockstep.endSession();
    const state = lockstep.getState();
    expect(state.active).toBe(false);
    expect(state.partner).toBeNull();
    expect(state.sessionStart).toBeNull();
    expect(state.mutualFocusScore).toBe(0);
    expect(state.syncStatus).toBe('solo');
  });

  // ----------------------------------------------------------------
  // 7. endSession emits unpaired event
  // ----------------------------------------------------------------
  it('endSession emits unpaired event', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new SoftLockstep(bus);
    instance.startPairedSession(mockPartner);
    instance.endSession();
    expect(emitFn).toHaveBeenCalledTimes(2);
    const unpairedCall = emitFn.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'lockstep:unpaired'
    );
    expect(unpairedCall).toBeDefined();
  });

  // ----------------------------------------------------------------
  // 8. updatePartnerScore updates partner focusScore
  // ----------------------------------------------------------------
  it('updatePartnerScore updates partner focusScore', () => {
    lockstep.startPairedSession(mockPartner);
    lockstep.updatePartnerScore({ valence: 0.9, arousal: 0.7 }, 0.95);
    const partner = lockstep.getPartner();
    expect(partner?.focusScore).toBe(0.95);
  });

  // ----------------------------------------------------------------
  // 9. updatePartnerScore computes score from emotion when not provided
  // ----------------------------------------------------------------
  it('updatePartnerScore computes score from emotion when not provided', () => {
    lockstep.startPairedSession(mockPartner);
    lockstep.updatePartnerScore({ valence: 1.0, arousal: 1.0 });
    const partner = lockstep.getPartner();
    expect(partner?.focusScore).toBeGreaterThan(0);
    expect(partner?.focusScore).toBeLessThanOrEqual(1);
  });

  // ----------------------------------------------------------------
  // 10. updatePartnerScore updates lastPingAt
  // ----------------------------------------------------------------
  it('updatePartnerScore updates lastPingAt', () => {
    const oldPartner: LockstepPartner = { ...mockPartner, lastPingAt: 0 };
    lockstep.startPairedSession(oldPartner);
    lockstep.updatePartnerScore({ valence: 0.5, arousal: 0.5 });
    const partner = lockstep.getPartner();
    expect(partner!.lastPingAt).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 11. updatePartnerScore does nothing when no partner
  // ----------------------------------------------------------------
  it('updatePartnerScore does nothing when no partner', () => {
    expect(() =>
      lockstep.updatePartnerScore({ valence: 0.5, arousal: 0.5 })
    ).not.toThrow();
    expect(lockstep.getMutualFocusScore()).toBe(0);
  });

  // ----------------------------------------------------------------
  // 12. getMutualFocusScore returns current score
  // ----------------------------------------------------------------
  it('getMutualFocusScore returns current score', () => {
    lockstep.startPairedSession(mockPartner);
    const score = lockstep.getMutualFocusScore();
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  // ----------------------------------------------------------------
  // 13. ping updates partner lastPingAt
  // ----------------------------------------------------------------
  it('ping updates partner lastPingAt', () => {
    lockstep.startPairedSession({ ...mockPartner, lastPingAt: 0 });
    lockstep.ping();
    expect(lockstep.getPartner()!.lastPingAt).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 14. ping does nothing without partner
  // ----------------------------------------------------------------
  it('ping does nothing without partner', () => {
    expect(() => lockstep.ping()).not.toThrow();
  });

  // ----------------------------------------------------------------
  // 15. isPartnerAlive returns true for recent ping
  // ----------------------------------------------------------------
  it('isPartnerAlive returns true for recent ping', () => {
    lockstep.startPairedSession(mockPartner);
    expect(lockstep.isPartnerAlive()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 16. isPartnerAlive returns false for stale partner
  // ----------------------------------------------------------------
  it('isPartnerAlive returns false for stale partner', () => {
    const stalePartner: LockstepPartner = {
      ...mockPartner,
      lastPingAt: Date.now() - 99999,
    };
    lockstep.startPairedSession(stalePartner);
    expect(lockstep.isPartnerAlive()).toBe(false);
  });

  // ----------------------------------------------------------------
  // 17. isPartnerAlive returns false without partner
  // ----------------------------------------------------------------
  it('isPartnerAlive returns false without partner', () => {
    expect(lockstep.isPartnerAlive()).toBe(false);
  });

  // ----------------------------------------------------------------
  // 18. setSyncStatus updates status
  // ----------------------------------------------------------------
  it('setSyncStatus updates status', () => {
    lockstep.setSyncStatus('group');
    expect(lockstep.getSyncStatus()).toBe('group');
    lockstep.setSyncStatus('paired');
    expect(lockstep.getSyncStatus()).toBe('paired');
    lockstep.setSyncStatus('solo');
    expect(lockstep.getSyncStatus()).toBe('solo');
  });

  // ----------------------------------------------------------------
  // 19. getPartner returns independent copy
  // ----------------------------------------------------------------
  it('getPartner returns independent copy', () => {
    lockstep.startPairedSession(mockPartner);
    const p1 = lockstep.getPartner();
    lockstep.updatePartnerScore({ valence: 0.2, arousal: 0.3 }, 0.1);
    const p2 = lockstep.getPartner();
    expect(p1!.focusScore).toBe(mockPartner.focusScore);
    expect(p2!.focusScore).toBe(0.1);
  });

  // ----------------------------------------------------------------
  // 20. getSessionDuration returns elapsed time
  // ----------------------------------------------------------------
  it('getSessionDuration returns elapsed time', () => {
    lockstep.startPairedSession(mockPartner);
    const duration = lockstep.getSessionDuration();
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  // ----------------------------------------------------------------
  // 21. getSessionDuration returns 0 when no session
  // ----------------------------------------------------------------
  it('getSessionDuration returns 0 when no session', () => {
    expect(lockstep.getSessionDuration()).toBe(0);
  });

  // ----------------------------------------------------------------
  // 22. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    lockstep.startPairedSession(mockPartner);
    const state1: LockstepState = lockstep.getState();
    lockstep.endSession();
    const state2: LockstepState = lockstep.getState();
    expect(state1.active).toBe(true);
    expect(state2.active).toBe(false);
  });

  // ----------------------------------------------------------------
  // 23. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    lockstep.startPairedSession(mockPartner);
    await lockstep.destroy();
    const state = lockstep.getState();
    expect(state.active).toBe(false);
    expect(state.partner).toBeNull();
    expect(state.sessionStart).toBeNull();
    expect(state.mutualFocusScore).toBe(0);
    expect(state.syncStatus).toBe('solo');
  });

  // ----------------------------------------------------------------
  // 24. startPairedSession emits paired event
  // ----------------------------------------------------------------
  it('startPairedSession emits paired event', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new SoftLockstep(bus);
    instance.startPairedSession(mockPartner);
    expect(emitFn).toHaveBeenCalledTimes(1);
    expect(emitFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lockstep:paired',
        data: { partnerId: 'partner-1', displayName: 'Alice' },
        source: 'soft-lockstep',
      })
    );
  });

  // ----------------------------------------------------------------
  // 25. Operations without bus do not throw
  // ----------------------------------------------------------------
  it('operations without bus do not throw', () => {
    expect(() => lockstep.startPairedSession(mockPartner)).not.toThrow();
    expect(() => lockstep.endSession()).not.toThrow();
  });

  // ----------------------------------------------------------------
  // 26. Multiple start/end cycles work correctly
  // ----------------------------------------------------------------
  it('multiple start/end cycles work correctly', () => {
    lockstep.startPairedSession(mockPartner);
    lockstep.endSession();
    const partner2: LockstepPartner = { ...mockPartner, id: 'partner-2' };
    lockstep.startPairedSession(partner2);
    expect(lockstep.isActive()).toBe(true);
    expect(lockstep.getPartner()!.id).toBe('partner-2');
  });

  // ----------------------------------------------------------------
  // 27. Constructor accepts options
  // ----------------------------------------------------------------
  it('constructor accepts options', () => {
    const instance = new SoftLockstep(undefined, {
      heartbeatMs: 1000,
      partnerTimeoutMs: 5000,
    });
    expect(instance).toBeDefined();
  });

  // ----------------------------------------------------------------
  // 28. Constructor accepts bus and options
  // ----------------------------------------------------------------
  it('constructor accepts bus and options', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new SoftLockstep(bus, { heartbeatMs: 1000 });
    instance.startPairedSession(mockPartner);
    expect(emitFn).toHaveBeenCalledTimes(1);
  });
});

describe('createSoftLockstepModule factory', () => {
  // ----------------------------------------------------------------
  // 29. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createSoftLockstepModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(SoftLockstep);
    instance.startPairedSession(mockPartner);
    expect(instance.isActive()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 30. Factory accepts bus and options
  // ----------------------------------------------------------------
  it('factory accepts bus and options', () => {
    const bus = { emit: () => undefined };
    const instance = createSoftLockstepModule(bus, { heartbeatMs: 1000 });
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(SoftLockstep);
  });
});

describe('soft_lockstep_module metadata', () => {
  // ----------------------------------------------------------------
  // 31. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(soft_lockstep_module.id).toBe('soft-lockstep');
    expect(soft_lockstep_module.name).toBe('SoftLockstep');
    expect(soft_lockstep_module.category).toBe('productivity');
    expect(soft_lockstep_module.version).toBe('0.1.0');
    expect(soft_lockstep_module.permissions).toEqual([
      'telemetry:read',
      'events:emit',
      'partner:connect',
    ]);
    expect(soft_lockstep_module.description).toBeDefined();
  });
});
