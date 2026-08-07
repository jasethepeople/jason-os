// ============================================================
// SoftBarrier — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SoftBarrier,
  createSoftBarrierModule,
  soft_barrier_module,
} from './module.js';
import type { SoftBarrierState } from './types.js';

describe('SoftBarrier', () => {
  let barrier: SoftBarrier;

  beforeEach(() => {
    barrier = new SoftBarrier();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = barrier.getState();
    expect(state.boundaries).toEqual([]);
    expect(state.globalEnforcement).toBe(true);
    expect(state.breachCount).toBe(0);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(barrier.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. setBoundary creates a boundary
  // ----------------------------------------------------------------
  it('setBoundary creates a boundary', () => {
    const b = barrier.setBoundary({ dimension: 'time', limit: 120 });
    expect(b.dimension).toBe('time');
    expect(b.limit).toBe(120);
    expect(b.current).toBe(0);
    expect(b.breached).toBe(false);
    expect(b.cooldownMs).toBe(60000);
    expect(b.lastBreachedAt).toBeNull();
  });

  // ----------------------------------------------------------------
  // 4. setBoundary with custom cooldown
  // ----------------------------------------------------------------
  it('setBoundary with custom cooldown', () => {
    const b = barrier.setBoundary({ dimension: 'emotional', limit: 5, cooldownMs: 30000 });
    expect(b.cooldownMs).toBe(30000);
  });

  // ----------------------------------------------------------------
  // 5. setBoundary with initial current value
  // ----------------------------------------------------------------
  it('setBoundary with initial current value', () => {
    const b = barrier.setBoundary({ dimension: 'social', limit: 10, initialCurrent: 3 });
    expect(b.current).toBe(3);
  });

  // ----------------------------------------------------------------
  // 6. setBoundary replaces existing dimension boundary
  // ----------------------------------------------------------------
  it('setBoundary replaces existing dimension boundary', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    barrier.setBoundary({ dimension: 'time', limit: 200 });
    const state = barrier.getState();
    expect(state.boundaries.length).toBe(1);
    expect(state.boundaries[0]!.limit).toBe(200);
  });

  // ----------------------------------------------------------------
  // 7. reportUsage within limits
  // ----------------------------------------------------------------
  it('reportUsage within limits', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    const report = barrier.reportUsage('time', 50);
    expect(report.withinLimits).toBe(true);
    expect(report.breached).toBe(false);
    expect(report.remaining).toBe(50);
  });

  // ----------------------------------------------------------------
  // 8. reportUsage exceeds limit triggers breach
  // ----------------------------------------------------------------
  it('reportUsage exceeds limit triggers breach', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    const report = barrier.reportUsage('time', 150);
    expect(report.withinLimits).toBe(false);
    expect(report.breached).toBe(true);
    expect(report.remaining).toBe(0);
  });

  // ----------------------------------------------------------------
  // 9. reportUsage throws for unconfigured dimension
  // ----------------------------------------------------------------
  it('reportUsage throws for unconfigured dimension', () => {
    expect(() => barrier.reportUsage('time', 10)).toThrow(
      'No boundary configured for dimension "time"'
    );
  });

  // ----------------------------------------------------------------
  // 10. isBreached returns true after breach
  // ----------------------------------------------------------------
  it('isBreached returns true after breach', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    expect(barrier.isBreached('time')).toBe(false);
    barrier.reportUsage('time', 150);
    expect(barrier.isBreached('time')).toBe(true);
  });

  // ----------------------------------------------------------------
  // 11. isBreached throws for unconfigured dimension
  // ----------------------------------------------------------------
  it('isBreached throws for unconfigured dimension', () => {
    expect(() => barrier.isBreached('time')).toThrow(
      'No boundary configured for dimension "time"'
    );
  });

  // ----------------------------------------------------------------
  // 12. checkUsage returns current status without modifying
  // ----------------------------------------------------------------
  it('checkUsage returns current status without modifying', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100, initialCurrent: 30 });
    const report1 = barrier.checkUsage('time');
    expect(report1.withinLimits).toBe(true);
    expect(report1.remaining).toBe(70);
    const report2 = barrier.checkUsage('time');
    expect(report2.remaining).toBe(70);
  });

  // ----------------------------------------------------------------
  // 13. getCooldownRemaining returns 0 when not in cooldown
  // ----------------------------------------------------------------
  it('getCooldownRemaining returns 0 when not in cooldown', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    expect(barrier.getCooldownRemaining('time')).toBe(0);
  });

  // ----------------------------------------------------------------
  // 14. isInCooldown returns false when not breached
  // ----------------------------------------------------------------
  it('isInCooldown returns false when not breached', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    expect(barrier.isInCooldown('time')).toBe(false);
  });

  // ----------------------------------------------------------------
  // 15. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    const state1: SoftBarrierState = barrier.getState();
    barrier.setBoundary({ dimension: 'social', limit: 50 });
    const state2: SoftBarrierState = barrier.getState();
    expect(state1.boundaries.length).toBe(1);
    expect(state2.boundaries.length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 16. enable/disable enforcement
  // ----------------------------------------------------------------
  it('enable/disable enforcement', () => {
    expect(barrier.isEnforcementEnabled()).toBe(true);
    barrier.disableEnforcement();
    expect(barrier.isEnforcementEnabled()).toBe(false);
    barrier.enableEnforcement();
    expect(barrier.isEnforcementEnabled()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 17. getDimensions returns configured dimensions
  // ----------------------------------------------------------------
  it('getDimensions returns configured dimensions', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    barrier.setBoundary({ dimension: 'emotional', limit: 5 });
    expect(barrier.getDimensions()).toEqual(['time', 'emotional']);
  });

  // ----------------------------------------------------------------
  // 18. getBoundary returns boundary by dimension
  // ----------------------------------------------------------------
  it('getBoundary returns boundary by dimension', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    const b = barrier.getBoundary('time');
    expect(b).toBeDefined();
    expect(b!.limit).toBe(100);
  });

  // ----------------------------------------------------------------
  // 19. getBoundary returns undefined for unconfigured dimension
  // ----------------------------------------------------------------
  it('getBoundary returns undefined for unconfigured dimension', () => {
    expect(barrier.getBoundary('time')).toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 20. resetUsage resets current to 0
  // ----------------------------------------------------------------
  it('resetUsage resets current to 0', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    barrier.reportUsage('time', 80);
    expect(barrier.checkUsage('time').remaining).toBe(20);
    barrier.resetUsage('time');
    expect(barrier.checkUsage('time').current).toBe(0);
    expect(barrier.checkUsage('time').remaining).toBe(100);
  });

  // ----------------------------------------------------------------
  // 21. resetUsage clears breached flag
  // ----------------------------------------------------------------
  it('resetUsage clears breached flag', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    barrier.reportUsage('time', 150);
    expect(barrier.isBreached('time')).toBe(true);
    barrier.resetUsage('time');
    expect(barrier.isBreached('time')).toBe(false);
  });

  // ----------------------------------------------------------------
  // 22. removeBoundary removes a dimension
  // ----------------------------------------------------------------
  it('removeBoundary removes a dimension', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    barrier.removeBoundary('time');
    expect(barrier.getDimensions()).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 23. removeBoundary throws for unconfigured dimension
  // ----------------------------------------------------------------
  it('removeBoundary throws for unconfigured dimension', () => {
    expect(() => barrier.removeBoundary('time')).toThrow(
      'No boundary configured for dimension "time"'
    );
  });

  // ----------------------------------------------------------------
  // 24. getBreachCount tracks total breaches
  // ----------------------------------------------------------------
  it('getBreachCount tracks total breaches', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    barrier.setBoundary({ dimension: 'social', limit: 10 });
    expect(barrier.getBreachCount()).toBe(0);
    barrier.reportUsage('time', 150);
    expect(barrier.getBreachCount()).toBe(1);
    barrier.reportUsage('social', 20);
    expect(barrier.getBreachCount()).toBe(2);
  });

  // ----------------------------------------------------------------
  // 25. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    barrier.reportUsage('time', 150);
    barrier.disableEnforcement();
    await barrier.destroy();
    const state = barrier.getState();
    expect(state.boundaries).toEqual([]);
    expect(state.globalEnforcement).toBe(true);
    expect(state.breachCount).toBe(0);
  });

  // ----------------------------------------------------------------
  // 26. emits barrier:breached event
  // ----------------------------------------------------------------
  it('emits barrier:breached event', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new SoftBarrier(bus);
    instance.setBoundary({ dimension: 'time', limit: 100 });
    instance.reportUsage('time', 150);
    expect(emitFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'barrier:breached',
        data: expect.objectContaining({
          dimension: 'time',
          limit: 100,
          current: 150,
        }),
        source: 'soft-barrier',
      })
    );
  });

  // ----------------------------------------------------------------
  // 27. emits barrier:cooldown-started event
  // ----------------------------------------------------------------
  it('emits barrier:cooldown-started event', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new SoftBarrier(bus);
    instance.setBoundary({ dimension: 'time', limit: 100, cooldownMs: 30000 });
    instance.reportUsage('time', 150);
    expect(emitFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'barrier:cooldown-started',
        data: expect.objectContaining({
          dimension: 'time',
          cooldownMs: 30000,
        }),
        source: 'soft-barrier',
      })
    );
  });

  // ----------------------------------------------------------------
  // 28. all four dimensions can be configured
  // ----------------------------------------------------------------
  it('all four dimensions can be configured', () => {
    barrier.setBoundary({ dimension: 'time', limit: 120 });
    barrier.setBoundary({ dimension: 'emotional', limit: 5 });
    barrier.setBoundary({ dimension: 'social', limit: 20 });
    barrier.setBoundary({ dimension: 'digital', limit: 240 });
    expect(barrier.getDimensions()).toEqual([
      'time', 'emotional', 'social', 'digital',
    ]);
  });

  // ----------------------------------------------------------------
  // 29. reportUsage accumulates current
  // ----------------------------------------------------------------
  it('reportUsage accumulates current', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    barrier.reportUsage('time', 30);
    barrier.reportUsage('time', 40);
    expect(barrier.checkUsage('time').current).toBe(70);
    expect(barrier.checkUsage('time').remaining).toBe(30);
  });

  // ----------------------------------------------------------------
  // 30. checkUsage throws for unconfigured dimension
  // ----------------------------------------------------------------
  it('checkUsage throws for unconfigured dimension', () => {
    expect(() => barrier.checkUsage('time')).toThrow(
      'No boundary configured for dimension "time"'
    );
  });

  // ----------------------------------------------------------------
  // 31. getCooldownRemaining throws for unconfigured dimension
  // ----------------------------------------------------------------
  it('getCooldownRemaining returns 0 for unconfigured dimension', () => {
    expect(barrier.getCooldownRemaining('time')).toBe(0);
  });

  // ----------------------------------------------------------------
  // 32. cumulative usage can trigger breach
  // ----------------------------------------------------------------
  it('cumulative usage can trigger breach', () => {
    barrier.setBoundary({ dimension: 'digital', limit: 100 });
    const r1 = barrier.reportUsage('digital', 60);
    expect(r1.withinLimits).toBe(true);
    const r2 = barrier.reportUsage('digital', 50);
    expect(r2.withinLimits).toBe(false);
    expect(r2.breached).toBe(true);
  });

  // ----------------------------------------------------------------
  // 33. reportUsage inCooldown is false initially
  // ----------------------------------------------------------------
  it('reportUsage inCooldown is false initially', () => {
    barrier.setBoundary({ dimension: 'time', limit: 100 });
    const report = barrier.reportUsage('time', 10);
    expect(report.inCooldown).toBe(false);
    expect(report.cooldownRemaining).toBe(0);
  });
});

describe('createSoftBarrierModule factory', () => {
  // ----------------------------------------------------------------
  // 34. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createSoftBarrierModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(SoftBarrier);
  });

  // ----------------------------------------------------------------
  // 35. Factory accepts bus parameter
  // ----------------------------------------------------------------
  it('factory accepts bus parameter', () => {
    const bus = { emit: () => undefined };
    const instance = createSoftBarrierModule(bus);
    expect(instance).toBeDefined();
  });
});

describe('soft_barrier_module metadata', () => {
  // ----------------------------------------------------------------
  // 36. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(soft_barrier_module.id).toBe('soft-barrier');
    expect(soft_barrier_module.name).toBe('SoftBarrier');
    expect(soft_barrier_module.category).toBe('emotional');
    expect(soft_barrier_module.version).toBe('0.1.0');
    expect(soft_barrier_module.permissions).toEqual([
      'events:emit',
      'events:listen',
    ]);
    expect(soft_barrier_module.description).toBeDefined();
  });
});
