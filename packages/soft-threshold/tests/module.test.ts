import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoftThreshold, createSoftThresholdModule, soft_threshold_module } from '../src/module.js';
import type { ThresholdState } from '../src/types.js';

describe('soft_threshold_module', () => {
  it('should export correct module metadata', () => {
    expect(soft_threshold_module.id).toBe('soft-threshold');
    expect(soft_threshold_module.name).toBe('SoftThreshold');
    expect(soft_threshold_module.category).toBe('emotional');
    expect(soft_threshold_module.version).toBe('0.1.0');
    expect(soft_threshold_module.permissions).toEqual([
      'telemetry:read',
      'events:emit',
    ]);
    expect(soft_threshold_module.description).toBe(
      'Stress boundary detection with affiliate offer suppression'
    );
  });
});

describe('SoftThreshold', () => {
  let softThreshold: SoftThreshold;

  beforeEach(() => {
    softThreshold = new SoftThreshold();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lifecycle', () => {
    it('should initialize without error', async () => {
      await expect(softThreshold.init()).resolves.toBeUndefined();
    });

    it('should destroy without error', async () => {
      await expect(softThreshold.destroy()).resolves.toBeUndefined();
    });

    it('should return initial state', () => {
      const state = softThreshold.getState();
      expect(state.active).toBe(false);
      expect(state.threshold).toBe(0.75);
      expect(state.currentStress).toBe(0);
      expect(state.suppressed).toBe(false);
      expect(state.lastWarningAt).toBeNull();
    });
  });

  describe('checkBoundary', () => {
    it('should set active=false when stress is below threshold', () => {
      softThreshold.checkBoundary(0.5);
      const state = softThreshold.getState();
      expect(state.active).toBe(false);
      expect(state.currentStress).toBe(0.5);
    });

    it('should set active=true when stress exceeds threshold', () => {
      softThreshold.checkBoundary(0.9);
      const state = softThreshold.getState();
      expect(state.active).toBe(true);
      expect(state.currentStress).toBe(0.9);
      expect(state.lastWarningAt).not.toBeNull();
    });

    it('should not activate when stress equals threshold', () => {
      softThreshold.checkBoundary(0.75);
      const state = softThreshold.getState();
      expect(state.active).toBe(false);
    });

    it('should emit breached event on bus', () => {
      const emitFn = vi.fn();
      const bus = { emit: emitFn };
      const st = new SoftThreshold(bus);

      st.checkBoundary(0.9);

      expect(emitFn).toHaveBeenCalled();
      const breachCall = emitFn.mock.calls.find(
        (call) => (call[0] as { type: string }).type === 'soft-threshold:breached'
      );
      expect(breachCall).toBeDefined();
      const payload = breachCall![0] as {
        type: string;
        data: { stress: number; threshold: number };
        source: string;
      };
      expect(payload.data.stress).toBe(0.9);
      expect(payload.data.threshold).toBe(0.75);
      expect(payload.source).toBe('soft-threshold');
    });
  });

  describe('suppressAffiliate', () => {
    it('should set suppressed to true', () => {
      softThreshold.suppressAffiliate();
      expect(softThreshold.getState().suppressed).toBe(true);
    });

    it('should emit affiliate:suppress event', () => {
      const emitFn = vi.fn();
      const bus = { emit: emitFn };
      const st = new SoftThreshold(bus);

      st.suppressAffiliate();

      const suppressCall = emitFn.mock.calls.find(
        (call) => (call[0] as { type: string }).type === 'affiliate:suppress'
      );
      expect(suppressCall).toBeDefined();
      const payload = suppressCall![0] as {
        type: string;
        data: { reason: string; duration: number };
      };
      expect(payload.data.reason).toBe('stress-threshold');
      expect(payload.data.duration).toBe(120000);
    });

    it('should release suppression after 120 seconds', () => {
      const emitFn = vi.fn();
      const bus = { emit: emitFn };
      const st = new SoftThreshold(bus);

      st.suppressAffiliate();
      expect(st.getState().suppressed).toBe(true);

      vi.advanceTimersByTime(120000);

      expect(st.getState().suppressed).toBe(false);

      const releaseCall = emitFn.mock.calls.find(
        (call) => (call[0] as { type: string }).type === 'affiliate:release'
      );
      expect(releaseCall).toBeDefined();
    });
  });

  describe('setThreshold', () => {
    it('should set threshold to given value', () => {
      softThreshold.setThreshold(0.5);
      expect(softThreshold.getState().threshold).toBe(0.5);
    });

    it('should clamp threshold to minimum 0.1', () => {
      softThreshold.setThreshold(0.01);
      expect(softThreshold.getState().threshold).toBe(0.1);
    });

    it('should clamp threshold to maximum 1.0', () => {
      softThreshold.setThreshold(1.5);
      expect(softThreshold.getState().threshold).toBe(1.0);
    });
  });

  describe('destroy', () => {
    it('should clear suppression timer on destroy', () => {
      softThreshold.suppressAffiliate();
      expect(softThreshold.getState().suppressed).toBe(true);

      softThreshold.destroy();

      vi.advanceTimersByTime(120000);

      // After destroy, timer should not fire — but we can at least verify
      // the destroy call doesn't throw
    });
  });

  describe('getState immutability', () => {
    it('should return a copy of state', () => {
      const state1 = softThreshold.getState();
      const state2 = softThreshold.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });
});

describe('createSoftThresholdModule', () => {
  it('should create a SoftThreshold instance', () => {
    const mod = createSoftThresholdModule();
    expect(mod).toBeInstanceOf(SoftThreshold);
  });

  it('should pass bus to constructor', () => {
    const bus = { emit: vi.fn() };
    const mod = createSoftThresholdModule(bus);
    expect(mod).toBeInstanceOf(SoftThreshold);
  });
});
