// ============================================================
// SoftPhase — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SoftPhase,
  createSoftPhaseModule,
  soft_phase_module,
} from './module.js';
import type { EmotionInput, PhaseState } from './types.js';

describe('SoftPhase', () => {
  let phase: SoftPhase;

  beforeEach(() => {
    phase = new SoftPhase();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = phase.getState();
    expect(state.phase).toBe('unknown');
    expect(state.day).toBe(0);
    expect(state.emotionalCorrelation).toBeNull();
    expect(state.predictions).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(phase.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. inferPhase returns menstrual for days 1-5
  // ----------------------------------------------------------------
  it('inferPhase returns menstrual for days 1-5', () => {
    expect(phase.inferPhase(1)).toBe('menstrual');
    expect(phase.inferPhase(3)).toBe('menstrual');
    expect(phase.inferPhase(5)).toBe('menstrual');
  });

  // ----------------------------------------------------------------
  // 4. inferPhase returns follicular for days 6-13
  // ----------------------------------------------------------------
  it('inferPhase returns follicular for days 6-13', () => {
    expect(phase.inferPhase(6)).toBe('follicular');
    expect(phase.inferPhase(10)).toBe('follicular');
    expect(phase.inferPhase(13)).toBe('follicular');
  });

  // ----------------------------------------------------------------
  // 5. inferPhase returns ovulatory for days 14-16
  // ----------------------------------------------------------------
  it('inferPhase returns ovulatory for days 14-16', () => {
    expect(phase.inferPhase(14)).toBe('ovulatory');
    expect(phase.inferPhase(15)).toBe('ovulatory');
    expect(phase.inferPhase(16)).toBe('ovulatory');
  });

  // ----------------------------------------------------------------
  // 6. inferPhase returns luteal for days 17-28
  // ----------------------------------------------------------------
  it('inferPhase returns luteal for days 17-28', () => {
    expect(phase.inferPhase(17)).toBe('luteal');
    expect(phase.inferPhase(22)).toBe('luteal');
    expect(phase.inferPhase(28)).toBe('luteal');
  });

  // ----------------------------------------------------------------
  // 7. inferPhase returns unknown for day 0
  // ----------------------------------------------------------------
  it('inferPhase returns unknown for day 0', () => {
    expect(phase.inferPhase(0)).toBe('unknown');
  });

  // ----------------------------------------------------------------
  // 8. inferPhase returns unknown for day 29+
  // ----------------------------------------------------------------
  it('inferPhase returns unknown for day 29+', () => {
    expect(phase.inferPhase(29)).toBe('unknown');
    expect(phase.inferPhase(100)).toBe('unknown');
  });

  // ----------------------------------------------------------------
  // 9. setDay updates day and phase
  // ----------------------------------------------------------------
  it('setDay updates day and phase', () => {
    phase.setDay(10);
    expect(phase.getDay()).toBe(10);
    expect(phase.getPhase()).toBe('follicular');
  });

  // ----------------------------------------------------------------
  // 10. setDay emits phase-change event on bus
  // ----------------------------------------------------------------
  it('setDay emits phase-change event on bus', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new SoftPhase(bus);
    instance.setDay(10);
    expect(emitFn).toHaveBeenCalledTimes(1);
    expect(emitFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'soft-phase:phase-change',
        data: { phase: 'follicular', day: 10 },
        source: 'soft-phase',
      })
    );
  });

  // ----------------------------------------------------------------
  // 11. correlateEmotion sets correlation for menstrual phase
  // ----------------------------------------------------------------
  it('correlateEmotion sets correlation for menstrual phase', () => {
    phase.setDay(3);
    phase.correlateEmotion({ valence: -0.2, stress: 0.5 });
    const state = phase.getState();
    expect(state.emotionalCorrelation).not.toBeNull();
    expect(state.emotionalCorrelation!.valenceDelta).toBe(-0.2);
    expect(state.emotionalCorrelation!.stressDelta).toBe(0.3);
  });

  // ----------------------------------------------------------------
  // 12. correlateEmotion sets correlation for follicular phase
  // ----------------------------------------------------------------
  it('correlateEmotion sets correlation for follicular phase', () => {
    phase.setDay(10);
    phase.correlateEmotion({ valence: 0.5, stress: 0.1 });
    const state = phase.getState();
    expect(state.emotionalCorrelation!.valenceDelta).toBe(0.15);
    expect(state.emotionalCorrelation!.stressDelta).toBe(-0.1);
  });

  // ----------------------------------------------------------------
  // 13. correlateEmotion sets correlation for ovulatory phase
  // ----------------------------------------------------------------
  it('correlateEmotion sets correlation for ovulatory phase', () => {
    phase.setDay(15);
    phase.correlateEmotion({ valence: 0.6, stress: 0.1 });
    const state = phase.getState();
    expect(state.emotionalCorrelation!.valenceDelta).toBe(0.2);
    expect(state.emotionalCorrelation!.stressDelta).toBe(-0.15);
  });

  // ----------------------------------------------------------------
  // 14. correlateEmotion sets correlation for luteal phase
  // ----------------------------------------------------------------
  it('correlateEmotion sets correlation for luteal phase', () => {
    phase.setDay(20);
    phase.correlateEmotion({ valence: 0.1, stress: 0.4 });
    const state = phase.getState();
    expect(state.emotionalCorrelation!.valenceDelta).toBe(-0.1);
    expect(state.emotionalCorrelation!.stressDelta).toBe(0.2);
  });

  // ----------------------------------------------------------------
  // 15. correlateEmotion with unknown phase returns zero deltas
  // ----------------------------------------------------------------
  it('correlateEmotion with unknown phase returns zero deltas', () => {
    phase.setDay(29);
    phase.correlateEmotion({ valence: 0.0, stress: 0.0 });
    const state = phase.getState();
    expect(state.emotionalCorrelation!.valenceDelta).toBe(0);
    expect(state.emotionalCorrelation!.stressDelta).toBe(0);
  });

  // ----------------------------------------------------------------
  // 16. getPhaseCorrelation returns correlation without changing state
  // ----------------------------------------------------------------
  it('getPhaseCorrelation returns correlation without changing state', () => {
    const corr = phase.getPhaseCorrelation('menstrual');
    expect(corr.valenceDelta).toBe(-0.2);
    expect(corr.stressDelta).toBe(0.3);
    // State should not be changed
    expect(phase.getState().phase).toBe('unknown');
  });

  // ----------------------------------------------------------------
  // 17. predict generates correct number of predictions
  // ----------------------------------------------------------------
  it('predict generates correct number of predictions', () => {
    phase.setDay(1);
    phase.predict(28);
    expect(phase.getState().predictions.length).toBe(28);
  });

  // ----------------------------------------------------------------
  // 18. predict generates phase predictions with dates
  // ----------------------------------------------------------------
  it('predict generates phase predictions with dates', () => {
    phase.setDay(1);
    phase.predict(7);
    const predictions = phase.getState().predictions;
    expect(predictions.length).toBe(7);
    expect(predictions[0]!.date).toBeGreaterThan(Date.now());
    expect(predictions[0]!.predictedPhase).toBeDefined();
  });

  // ----------------------------------------------------------------
  // 19. predict cycles through phases correctly
  // ----------------------------------------------------------------
  it('predict cycles through phases correctly', () => {
    phase.setDay(4); // menstrual
    phase.predict(5);
    const predictions = phase.getState().predictions;
    // Day 5: menstrual, Day 6: follicular, Day 7: follicular, Day 8: follicular, Day 9: follicular
    expect(predictions[0]!.predictedPhase).toBe('menstrual'); // day 5
    expect(predictions[1]!.predictedPhase).toBe('follicular'); // day 6
  });

  // ----------------------------------------------------------------
  // 20. predict wraps around after day 28
  // ----------------------------------------------------------------
  it('predict wraps around after day 28', () => {
    phase.setDay(28); // luteal
    phase.predict(3);
    const predictions = phase.getState().predictions;
    // Day 29 wraps to day 1 (menstrual), day 2 (menstrual)
    expect(predictions[0]!.predictedPhase).toBe('unknown'); // day 29 wraps to unknown
  });

  // ----------------------------------------------------------------
  // 21. getPhase returns current phase
  // ----------------------------------------------------------------
  it('getPhase returns current phase', () => {
    expect(phase.getPhase()).toBe('unknown');
    phase.setDay(10);
    expect(phase.getPhase()).toBe('follicular');
  });

  // ----------------------------------------------------------------
  // 22. getDay returns current day
  // ----------------------------------------------------------------
  it('getDay returns current day', () => {
    expect(phase.getDay()).toBe(0);
    phase.setDay(15);
    expect(phase.getDay()).toBe(15);
  });

  // ----------------------------------------------------------------
  // 23. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    phase.setDay(10);
    phase.correlateEmotion({ valence: 0.5, stress: 0.2 });
    const state1: PhaseState = phase.getState();
    phase.setDay(20);
    const state2: PhaseState = phase.getState();
    expect(state1.phase).toBe('follicular');
    expect(state2.phase).toBe('luteal');
  });

  // ----------------------------------------------------------------
  // 24. reset clears all state
  // ----------------------------------------------------------------
  it('reset clears all state', () => {
    phase.setDay(10);
    phase.correlateEmotion({ valence: 0.5, stress: 0.2 });
    phase.predict(7);
    phase.reset();
    expect(phase.getPhase()).toBe('unknown');
    expect(phase.getDay()).toBe(0);
    expect(phase.getState().emotionalCorrelation).toBeNull();
    expect(phase.getState().predictions.length).toBe(0);
  });

  // ----------------------------------------------------------------
  // 25. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    phase.setDay(10);
    phase.correlateEmotion({ valence: 0.5, stress: 0.2 });
    phase.predict(7);
    await phase.destroy();
    expect(phase.getPhase()).toBe('unknown');
    expect(phase.getDay()).toBe(0);
    expect(phase.getState().emotionalCorrelation).toBeNull();
    expect(phase.getState().predictions.length).toBe(0);
  });

  // ----------------------------------------------------------------
  // 26. setDay with bus that has no emit does not throw
  // ----------------------------------------------------------------
  it('setDay with bus that has no emit does not throw', () => {
    const bus = {};
    const instance = new SoftPhase(bus);
    expect(() => instance.setDay(10)).not.toThrow();
  });

  // ----------------------------------------------------------------
  // 27. setDay without bus does not throw
  // ----------------------------------------------------------------
  it('setDay without bus does not throw', () => {
    expect(() => phase.setDay(10)).not.toThrow();
  });

  // ----------------------------------------------------------------
  // 28. All phase correlations have expected values
  // ----------------------------------------------------------------
  it('all phase correlations have expected values', () => {
    expect(phase.getPhaseCorrelation('menstrual')).toEqual({
      valenceDelta: -0.2,
      stressDelta: 0.3,
    });
    expect(phase.getPhaseCorrelation('follicular')).toEqual({
      valenceDelta: 0.15,
      stressDelta: -0.1,
    });
    expect(phase.getPhaseCorrelation('ovulatory')).toEqual({
      valenceDelta: 0.2,
      stressDelta: -0.15,
    });
    expect(phase.getPhaseCorrelation('luteal')).toEqual({
      valenceDelta: -0.1,
      stressDelta: 0.2,
    });
    expect(phase.getPhaseCorrelation('unknown')).toEqual({
      valenceDelta: 0,
      stressDelta: 0,
    });
  });
});

describe('createSoftPhaseModule factory', () => {
  // ----------------------------------------------------------------
  // 29. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createSoftPhaseModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(SoftPhase);
    instance.setDay(10);
    expect(instance.getPhase()).toBe('follicular');
  });

  // ----------------------------------------------------------------
  // 30. Factory accepts optional bus parameter
  // ----------------------------------------------------------------
  it('factory accepts optional bus parameter', () => {
    const bus = { emit: () => undefined };
    const instance = createSoftPhaseModule(bus);
    expect(instance).toBeDefined();
  });
});

describe('soft_phase_module metadata', () => {
  // ----------------------------------------------------------------
  // 31. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(soft_phase_module.id).toBe('soft-phase');
    expect(soft_phase_module.name).toBe('SoftPhase');
    expect(soft_phase_module.category).toBe('emotional');
    expect(soft_phase_module.version).toBe('0.1.0');
    expect(soft_phase_module.permissions).toEqual([
      'telemetry:read',
      'storage:write',
    ]);
    expect(soft_phase_module.description).toBeDefined();
  });
});
