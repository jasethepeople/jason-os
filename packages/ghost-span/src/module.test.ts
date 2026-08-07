// ============================================================
// GhostSpan — Test Suite
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GhostSpan,
  createGhostSpanModule,
  ghost_span_module,
} from './module.js';
import type { EmotionDataPoint, GhostSpanState } from './types.js';

describe('GhostSpan', () => {
  let ghost: GhostSpan;

  beforeEach(() => {
    ghost = new GhostSpan();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = ghost.getState();
    expect(state.active).toBe(false);
    expect(state.schedule).toEqual([]);
    expect(state.currentSlot).toBeNull();
    expect(state.adjustmentsMade).toBe(0);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(ghost.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. generateSchedule creates schedule from emotion history
  // ----------------------------------------------------------------
  it('generateSchedule creates schedule from emotion history', () => {
    const history: EmotionDataPoint[] = [
      { hour: 9, valence: 0.5, arousal: 0.6 },
      { hour: 14, valence: 0.3, arousal: 0.4 },
    ];
    ghost.generateSchedule(history);
    const state = ghost.getState();
    expect(state.active).toBe(true);
    expect(state.schedule.length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 4. computeFocusScore peaks at moderate valence and arousal
  // ----------------------------------------------------------------
  it('computeFocusScore peaks at moderate valence and arousal', () => {
    const score = ghost.computeFocusScore(0.3, 0.5);
    expect(score).toBeGreaterThan(0.8);
  });

  // ----------------------------------------------------------------
  // 5. computeFocusScore is low at extreme valence
  // ----------------------------------------------------------------
  it('computeFocusScore is low at extreme valence', () => {
    const score = ghost.computeFocusScore(-1.0, 0.5);
    expect(score).toBeLessThan(0.3);
  });

  // ----------------------------------------------------------------
  // 6. computeFocusScore is low at extreme arousal
  // ----------------------------------------------------------------
  it('computeFocusScore is low at extreme arousal', () => {
    const score = ghost.computeFocusScore(0.3, 1.0);
    expect(score).toBeLessThan(0.8);
  });

  // ----------------------------------------------------------------
  // 7. computeFocusScore is clamped to [0, 1]
  // ----------------------------------------------------------------
  it('computeFocusScore is clamped to [0, 1]', () => {
    expect(ghost.computeFocusScore(-1, 0)).toBe(0);
    expect(ghost.computeFocusScore(0.3, 0.5)).toBeLessThanOrEqual(1);
    expect(ghost.computeFocusScore(0.3, 0.5)).toBeGreaterThanOrEqual(0);
  });

  // ----------------------------------------------------------------
  // 8. suggestTaskType returns creative for high valence + high arousal
  // ----------------------------------------------------------------
  it('suggestTaskType returns creative for high valence + high arousal', () => {
    expect(ghost.suggestTaskType(0.5, 0.7)).toBe('creative');
  });

  // ----------------------------------------------------------------
  // 9. suggestTaskType returns deep-work for moderate valence + low arousal
  // ----------------------------------------------------------------
  it('suggestTaskType returns deep-work for moderate valence + low arousal', () => {
    expect(ghost.suggestTaskType(0.3, 0.3)).toBe('deep-work');
  });

  // ----------------------------------------------------------------
  // 10. suggestTaskType returns admin for negative valence
  // ----------------------------------------------------------------
  it('suggestTaskType returns admin for negative valence', () => {
    expect(ghost.suggestTaskType(-0.1, 0.5)).toBe('admin');
  });

  // ----------------------------------------------------------------
  // 11. suggestTaskType returns routine as default
  // ----------------------------------------------------------------
  it('suggestTaskType returns routine as default', () => {
    expect(ghost.suggestTaskType(0.1, 0.5)).toBe('routine');
  });

  // ----------------------------------------------------------------
  // 12. getCurrentSlot returns matching slot
  // ----------------------------------------------------------------
  it('getCurrentSlot returns matching slot', () => {
    const history: EmotionDataPoint[] = [
      { hour: 9, valence: 0.5, arousal: 0.6 },
      { hour: 14, valence: 0.3, arousal: 0.4 },
    ];
    ghost.generateSchedule(history);
    const slot = ghost.getCurrentSlot(9);
    expect(slot).not.toBeNull();
    expect(slot!.hour).toBe(9);
  });

  // ----------------------------------------------------------------
  // 13. getCurrentSlot returns null for unknown hour
  // ----------------------------------------------------------------
  it('getCurrentSlot returns null for unknown hour', () => {
    const history: EmotionDataPoint[] = [
      { hour: 9, valence: 0.5, arousal: 0.6 },
    ];
    ghost.generateSchedule(history);
    const slot = ghost.getCurrentSlot(99);
    expect(slot).toBeNull();
  });

  // ----------------------------------------------------------------
  // 14. getBestSlot returns highest focus slot
  // ----------------------------------------------------------------
  it('getBestSlot returns highest focus slot', () => {
    const history: EmotionDataPoint[] = [
      { hour: 9, valence: -0.9, arousal: 0.1 }, // low focus
      { hour: 10, valence: 0.3, arousal: 0.5 }, // high focus
      { hour: 11, valence: 0.0, arousal: 0.5 }, // medium focus
    ];
    ghost.generateSchedule(history);
    const best = ghost.getBestSlot();
    expect(best).not.toBeNull();
    expect(best!.hour).toBe(10);
  });

  // ----------------------------------------------------------------
  // 15. getBestSlot returns null with no schedule
  // ----------------------------------------------------------------
  it('getBestSlot returns null with no schedule', () => {
    expect(ghost.getBestSlot()).toBeNull();
  });

  // ----------------------------------------------------------------
  // 16. getSlotsByTaskType filters correctly
  // ----------------------------------------------------------------
  it('getSlotsByTaskType filters correctly', () => {
    const history: EmotionDataPoint[] = [
      { hour: 9, valence: 0.5, arousal: 0.7 }, // creative
      { hour: 10, valence: 0.3, arousal: 0.3 }, // deep-work
      { hour: 11, valence: 0.5, arousal: 0.7 }, // creative
    ];
    ghost.generateSchedule(history);
    const creative = ghost.getSlotsByTaskType('creative');
    expect(creative.length).toBe(2);
    expect(creative[0]!.hour).toBe(9);
    expect(creative[1]!.hour).toBe(11);
  });

  // ----------------------------------------------------------------
  // 17. getAverageFocusScore computes average
  // ----------------------------------------------------------------
  it('getAverageFocusScore computes average', () => {
    const history: EmotionDataPoint[] = [
      { hour: 9, valence: 0.3, arousal: 0.5 }, // ~1.0 focus
      { hour: 10, valence: -0.9, arousal: 0.1 }, // ~0 focus
    ];
    ghost.generateSchedule(history);
    const avg = ghost.getAverageFocusScore();
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThan(1);
  });

  // ----------------------------------------------------------------
  // 18. getAverageFocusScore returns 0 with no schedule
  // ----------------------------------------------------------------
  it('getAverageFocusScore returns 0 with no schedule', () => {
    expect(ghost.getAverageFocusScore()).toBe(0);
  });

  // ----------------------------------------------------------------
  // 19. adjustSlot modifies existing slot
  // ----------------------------------------------------------------
  it('adjustSlot modifies existing slot', () => {
    const history: EmotionDataPoint[] = [
      { hour: 9, valence: 0.5, arousal: 0.6 },
    ];
    ghost.generateSchedule(history);
    ghost.adjustSlot(9, { optimalFocus: 0.99, taskType: 'deep-work' });
    const state = ghost.getState();
    expect(state.adjustmentsMade).toBe(1);
    const slot = state.schedule.find((s) => s.hour === 9);
    expect(slot!.optimalFocus).toBe(0.99);
    expect(slot!.taskType).toBe('deep-work');
  });

  // ----------------------------------------------------------------
  // 20. adjustSlot ignores unknown hour
  // ----------------------------------------------------------------
  it('adjustSlot ignores unknown hour', () => {
    const history: EmotionDataPoint[] = [
      { hour: 9, valence: 0.5, arousal: 0.6 },
    ];
    ghost.generateSchedule(history);
    ghost.adjustSlot(99, { optimalFocus: 0.99 });
    expect(ghost.getState().adjustmentsMade).toBe(0);
  });

  // ----------------------------------------------------------------
  // 21. isActive returns false before generateSchedule
  // ----------------------------------------------------------------
  it('isActive returns false before generateSchedule', () => {
    expect(ghost.isActive()).toBe(false);
  });

  // ----------------------------------------------------------------
  // 22. isActive returns true after generateSchedule
  // ----------------------------------------------------------------
  it('isActive returns true after generateSchedule', () => {
    ghost.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
    expect(ghost.isActive()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 23. clearSchedule resets schedule but keeps adjustmentsMade
  // ----------------------------------------------------------------
  it('clearSchedule resets schedule but keeps adjustmentsMade', () => {
    ghost.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
    ghost.adjustSlot(9, { optimalFocus: 0.99 });
    ghost.clearSchedule();
    const state = ghost.getState();
    expect(state.active).toBe(false);
    expect(state.schedule.length).toBe(0);
    expect(state.adjustmentsMade).toBe(1);
  });

  // ----------------------------------------------------------------
  // 24. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    ghost.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
    ghost.adjustSlot(9, { optimalFocus: 0.99 });
    await ghost.destroy();
    const state = ghost.getState();
    expect(state.active).toBe(false);
    expect(state.schedule.length).toBe(0);
    expect(state.currentSlot).toBeNull();
    expect(state.adjustmentsMade).toBe(0);
  });

  // ----------------------------------------------------------------
  // 25. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    ghost.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
    const state1: GhostSpanState = ghost.getState();
    ghost.adjustSlot(9, { optimalFocus: 0.5 });
    const state2: GhostSpanState = ghost.getState();
    expect(state1.schedule[0]!.optimalFocus).not.toBe(
      state2.schedule[0]!.optimalFocus
    );
  });

  // ----------------------------------------------------------------
  // 26. generateSchedule with empty array
  // ----------------------------------------------------------------
  it('generateSchedule with empty array', () => {
    ghost.generateSchedule([]);
    expect(ghost.isActive()).toBe(true);
    expect(ghost.getState().schedule.length).toBe(0);
  });

  // ----------------------------------------------------------------
  // 27. generateSchedule with 24-hour data
  // ----------------------------------------------------------------
  it('generateSchedule with 24-hour data', () => {
    const history: EmotionDataPoint[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      valence: Math.sin(i / 24 * Math.PI * 2) * 0.5,
      arousal: 0.3 + Math.cos(i / 24 * Math.PI * 2) * 0.2,
    }));
    ghost.generateSchedule(history);
    expect(ghost.getState().schedule.length).toBe(24);
  });

  // ----------------------------------------------------------------
  // 28. suggestTaskType boundary cases
  // ----------------------------------------------------------------
  it('suggestTaskType boundary cases', () => {
    // Boundary for creative: valence > 0.4 && arousal > 0.6
    expect(ghost.suggestTaskType(0.41, 0.61)).toBe('creative');
    // Boundary for deep-work: valence > 0.2 && arousal < 0.4
    expect(ghost.suggestTaskType(0.21, 0.39)).toBe('deep-work');
    // Negative valence always admin
    expect(ghost.suggestTaskType(-0.01, 0.9)).toBe('admin');
    // Default case
    expect(ghost.suggestTaskType(0.3, 0.5)).toBe('routine');
  });
});

describe('createGhostSpanModule factory', () => {
  // ----------------------------------------------------------------
  // 29. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createGhostSpanModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(GhostSpan);
    instance.generateSchedule([
      { hour: 9, valence: 0.5, arousal: 0.6 },
    ]);
    expect(instance.isActive()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 30. Factory accepts optional bus parameter
  // ----------------------------------------------------------------
  it('factory accepts optional bus parameter', () => {
    const bus = { emit: () => undefined };
    const instance = createGhostSpanModule(bus);
    expect(instance).toBeDefined();
  });
});

describe('ghost_span_module metadata', () => {
  // ----------------------------------------------------------------
  // 31. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(ghost_span_module.id).toBe('ghost-span');
    expect(ghost_span_module.name).toBe('GhostSpan');
    expect(ghost_span_module.category).toBe('productivity');
    expect(ghost_span_module.version).toBe('0.1.0');
    expect(ghost_span_module.permissions).toEqual([
      'telemetry:read',
      'schedule',
    ]);
    expect(ghost_span_module.description).toBeDefined();
  });
});
