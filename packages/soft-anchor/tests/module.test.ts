import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoftAnchor, createSoftAnchorModule, soft_anchor_module } from '../src/module.js';
import type { AnchorState } from '../src/types.js';

describe('soft_anchor_module', () => {
  it('should export correct module metadata', () => {
    expect(soft_anchor_module.id).toBe('soft-anchor');
    expect(soft_anchor_module.name).toBe('SoftAnchor');
    expect(soft_anchor_module.category).toBe('emotional');
    expect(soft_anchor_module.version).toBe('0.1.0');
    expect(soft_anchor_module.permissions).toEqual([
      'telemetry:read',
      'storage:write',
    ]);
    expect(soft_anchor_module.description).toBe(
      'Emotional re-anchoring system on stress spikes'
    );
  });
});

describe('SoftAnchor', () => {
  let softAnchor: SoftAnchor;

  beforeEach(() => {
    softAnchor = new SoftAnchor();
  });

  describe('lifecycle', () => {
    it('should initialize without error', async () => {
      await expect(softAnchor.init()).resolves.toBeUndefined();
    });

    it('should destroy without error', async () => {
      await expect(softAnchor.destroy()).resolves.toBeUndefined();
    });

    it('should return initial state', () => {
      const state = softAnchor.getState();
      expect(state.stable).toBe(true);
      expect(state.trigger).toBeNull();
      expect(state.reanchoredAt).toBeNull();
      expect(state.anchorCount).toBe(0);
    });
  });

  describe('reanchor', () => {
    it('should set stable to true', () => {
      softAnchor.reanchor('stress-spike');
      const state = softAnchor.getState();
      expect(state.stable).toBe(true);
    });

    it('should record the trigger', () => {
      softAnchor.reanchor('external-trigger');
      const state = softAnchor.getState();
      expect(state.trigger).toBe('external-trigger');
    });

    it('should set reanchoredAt to current timestamp', () => {
      const before = Date.now();
      softAnchor.reanchor('test-trigger');
      const after = Date.now();
      const state = softAnchor.getState();

      expect(state.reanchoredAt).not.toBeNull();
      expect(state.reanchoredAt!).toBeGreaterThanOrEqual(before);
      expect(state.reanchoredAt!).toBeLessThanOrEqual(after);
    });

    it('should increment anchorCount', () => {
      softAnchor.reanchor('trigger-1');
      softAnchor.reanchor('trigger-2');
      softAnchor.reanchor('trigger-3');

      const state = softAnchor.getState();
      expect(state.anchorCount).toBe(3);
    });

    it('should emit reanchored event on bus', () => {
      const emitFn = vi.fn();
      const bus = { emit: emitFn };
      const softAnchorWithBus = new SoftAnchor(bus);

      softAnchorWithBus.reanchor('stress-spike');

      expect(emitFn).toHaveBeenCalledTimes(1);
      const callArg = emitFn.mock.calls[0][0] as {
        type: string;
        data: { trigger: string };
        source: string;
      };
      expect(callArg.type).toBe('soft-anchor:reanchored');
      expect(callArg.data.trigger).toBe('stress-spike');
      expect(callArg.source).toBe('soft-anchor');
    });

    it('should not throw if bus is undefined', () => {
      expect(() => softAnchor.reanchor('no-bus')).not.toThrow();
    });

    it('should not throw if bus has no emit method', () => {
      const softAnchorNoEmit = new SoftAnchor({});
      expect(() => softAnchorNoEmit.reanchor('no-emit')).not.toThrow();
    });
  });

  describe('getState', () => {
    it('should return a copy of state, not a reference', () => {
      softAnchor.reanchor('trigger');
      const state1 = softAnchor.getState();
      const state2 = softAnchor.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });
});

describe('createSoftAnchorModule', () => {
  it('should create a SoftAnchor instance', () => {
    const mod = createSoftAnchorModule();
    expect(mod).toBeInstanceOf(SoftAnchor);
  });

  it('should pass bus to constructor', () => {
    const bus = { emit: vi.fn() };
    const mod = createSoftAnchorModule(bus);
    expect(mod).toBeInstanceOf(SoftAnchor);
  });
});
