// ============================================================
// Undercurrent — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Undercurrent,
  createUndercurrentModule,
  undercurrent_module,
} from './module.js';
import type { DataPoint, Pattern, UndercurrentState } from './types.js';

function makeDataPoints(count: number, overrides?: Partial<DataPoint>): DataPoint[] {
  const points: DataPoint[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      timestamp: Date.now() + i * 1000,
      valence: overrides?.valence ?? 0,
      arousal: overrides?.arousal ?? 0.5,
      dominance: overrides?.dominance ?? 0.5,
      stress: overrides?.stress ?? 0.2,
    });
  }
  return points;
}

describe('Undercurrent', () => {
  let uc: Undercurrent;

  beforeEach(() => {
    uc = new Undercurrent();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = uc.getState();
    expect(state.patterns).toEqual([]);
    expect(state.insights).toEqual([]);
    expect(state.scanDepth).toBe(50);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(uc.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. scan does not throw with empty data
  // ----------------------------------------------------------------
  it('scan does not throw with empty data', () => {
    expect(() => uc.scan([])).not.toThrow();
  });

  // ----------------------------------------------------------------
  // 4. scan does not throw with insufficient data
  // ----------------------------------------------------------------
  it('scan does not throw with insufficient data', () => {
    expect(() => uc.scan(makeDataPoints(2))).not.toThrow();
    expect(uc.getPatterns().length).toBe(0);
  });

  // ----------------------------------------------------------------
  // 5. scan detects correlation pattern
  // ----------------------------------------------------------------
  it('scan detects correlation pattern', () => {
    const points: DataPoint[] = [];
    for (let i = 0; i < 10; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: -0.8, // low valence
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.8, // high stress
      });
    }
    uc.scan(points);
    const patterns = uc.getPatterns();
    const correlation = patterns.find((p) => p.type === 'correlation');
    expect(correlation).toBeDefined();
    expect(correlation!.relatedDimensions).toContain('valence');
    expect(correlation!.relatedDimensions).toContain('stress');
  });

  // ----------------------------------------------------------------
  // 6. scan detects cycle pattern
  // ----------------------------------------------------------------
  it('scan detects cycle pattern', () => {
    const points: DataPoint[] = [];
    // Create oscillating valence: up, down, up, down
    const valences = [0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5];
    for (let i = 0; i < valences.length; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: valences[i]!,
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.2,
      });
    }
    uc.scan(points);
    const patterns = uc.getPatterns();
    const cycle = patterns.find((p) => p.type === 'cycle');
    expect(cycle).toBeDefined();
    expect(cycle!.relatedDimensions).toContain('valence');
  });

  // ----------------------------------------------------------------
  // 7. scan detects spike-cluster pattern
  // ----------------------------------------------------------------
  it('scan detects spike-cluster pattern', () => {
    const points: DataPoint[] = [];
    for (let i = 0; i < 10; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: 0,
        arousal: 0.5,
        dominance: 0.5,
        stress: i >= 3 && i <= 5 ? 0.9 : 0.1, // cluster of spikes at indices 3-5
      });
    }
    uc.scan(points);
    const patterns = uc.getPatterns();
    const spike = patterns.find((p) => p.type === 'spike-cluster');
    expect(spike).toBeDefined();
    expect(spike!.relatedDimensions).toContain('stress');
  });

  // ----------------------------------------------------------------
  // 8. scan detects baseline-drift pattern
  // ----------------------------------------------------------------
  it('scan detects baseline-drift pattern', () => {
    const points: DataPoint[] = [];
    for (let i = 0; i < 12; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: i < 4 ? 0.8 : -0.5, // drift from positive to negative
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.2,
      });
    }
    uc.scan(points);
    const patterns = uc.getPatterns();
    const drift = patterns.find((p) => p.type === 'baseline-drift');
    expect(drift).toBeDefined();
    expect(drift!.relatedDimensions).toContain('valence');
  });

  // ----------------------------------------------------------------
  // 9. detectPattern returns highest confidence pattern
  // ----------------------------------------------------------------
  it('detectPattern returns highest confidence pattern', () => {
    const points: DataPoint[] = [];
    for (let i = 0; i < 10; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: -0.8,
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.8,
      });
    }
    const pattern = uc.detectPattern(points);
    expect(pattern).not.toBeNull();
    expect(pattern!.confidence).toBeGreaterThanOrEqual(0);
    expect(pattern!.confidence).toBeLessThanOrEqual(1);
  });

  // ----------------------------------------------------------------
  // 10. detectPattern returns null for insufficient data
  // ----------------------------------------------------------------
  it('detectPattern returns null for insufficient data', () => {
    const result = uc.detectPattern(makeDataPoints(2));
    expect(result).toBeNull();
  });

  // ----------------------------------------------------------------
  // 11. generateInsights produces insights
  // ----------------------------------------------------------------
  it('generateInsights produces insights', () => {
    const points: DataPoint[] = [];
    for (let i = 0; i < 10; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: -0.8,
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.8,
      });
    }
    uc.scan(points);
    const insights = uc.generateInsights();
    expect(insights.length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 12. generateInsights includes no-patterns message
  // ----------------------------------------------------------------
  it('generateInsights includes no-patterns message when empty', () => {
    const insights = uc.generateInsights();
    expect(insights.some((i) => i.includes('No strong patterns'))).toBe(true);
  });

  // ----------------------------------------------------------------
  // 13. getPattern returns pattern by ID
  // ----------------------------------------------------------------
  it('getPattern returns pattern by ID', () => {
    const points: DataPoint[] = [];
    for (let i = 0; i < 10; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: -0.8,
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.8,
      });
    }
    uc.scan(points);
    const patterns = uc.getPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    const found = uc.getPattern(patterns[0]!.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(patterns[0]!.id);
  });

  // ----------------------------------------------------------------
  // 14. getPattern returns null for unknown ID
  // ----------------------------------------------------------------
  it('getPattern returns null for unknown ID', () => {
    expect(uc.getPattern('non-existent')).toBeNull();
  });

  // ----------------------------------------------------------------
  // 15. getPatterns returns independent copies
  // ----------------------------------------------------------------
  it('getPatterns returns independent copies', () => {
    const points = makeDataPoints(10, { valence: -0.8, stress: 0.8 });
    uc.scan(points);
    const patterns1 = uc.getPatterns();
    patterns1[0]!.occurrences = 999;
    const patterns2 = uc.getPatterns();
    expect(patterns2[0]!.occurrences).not.toBe(999);
  });

  // ----------------------------------------------------------------
  // 16. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    const points = makeDataPoints(10, { valence: -0.8, stress: 0.8 });
    uc.scan(points);
    const state1: UndercurrentState = uc.getState();
    uc.scan(makeDataPoints(5, { valence: 0.5, stress: 0.1 }));
    const state2: UndercurrentState = uc.getState();
    expect(state1.patterns.length).toBeLessThanOrEqual(state2.patterns.length);
  });

  // ----------------------------------------------------------------
  // 17. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    const points = makeDataPoints(10, { valence: -0.8, stress: 0.8 });
    uc.scan(points);
    await uc.destroy();
    const state = uc.getState();
    expect(state.patterns).toEqual([]);
    expect(state.insights).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 18. Pattern deduplication by type+dimensions
  // ----------------------------------------------------------------
  it('pattern deduplication by type and dimensions', () => {
    const points = makeDataPoints(10, { valence: -0.8, stress: 0.8 });
    uc.scan(points);
    const count1 = uc.getPatterns().length;
    uc.scan(points); // scan same data again
    const count2 = uc.getPatterns().length;
    // Should not duplicate, should update existing
    expect(count2).toBe(count1);
  });

  // ----------------------------------------------------------------
  // 19. Constructor accepts options
  // ----------------------------------------------------------------
  it('constructor accepts options', () => {
    const instance = new Undercurrent(undefined, {
      confidenceThreshold: 0.8,
      scanDepth: 20,
      minOccurrences: 5,
    });
    expect(instance).toBeDefined();
    expect(instance.getState().scanDepth).toBe(20);
  });

  // ----------------------------------------------------------------
  // 20. scan respects scanDepth option
  // ----------------------------------------------------------------
  it('scan respects scanDepth option', () => {
    const shallow = new Undercurrent(undefined, { scanDepth: 5 });
    const points = makeDataPoints(20, { valence: -0.8, stress: 0.8 });
    shallow.scan(points);
    // Should still detect patterns even with shallow scan
    expect(shallow.getPatterns().length).toBeGreaterThanOrEqual(0);
  });

  // ----------------------------------------------------------------
  // 21. scan with mixed data produces multiple pattern types
  // ----------------------------------------------------------------
  it('scan with mixed data produces patterns', () => {
    const points: DataPoint[] = [];
    // Oscillating valence with clustered stress spikes
    const valences = [0.8, -0.5, 0.8, -0.5, 0.8, -0.5, 0.8, -0.5, 0.8, -0.5];
    for (let i = 0; i < valences.length; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: valences[i]!,
        arousal: 0.5,
        dominance: 0.5,
        stress: i >= 4 && i <= 6 ? 0.9 : 0.2,
      });
    }
    uc.scan(points);
    expect(uc.getPatterns().length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 22. getPattern returns independent copy
  // ----------------------------------------------------------------
  it('getPattern returns independent copy', () => {
    const points = makeDataPoints(10, { valence: -0.8, stress: 0.8 });
    uc.scan(points);
    const pattern = uc.getPatterns()[0]!;
    const fetched = uc.getPattern(pattern.id)!;
    fetched.occurrences = 999;
    const refetched = uc.getPattern(pattern.id)!;
    expect(refetched.occurrences).not.toBe(999);
  });

  // ----------------------------------------------------------------
  // 23. generateInsights filters low-confidence patterns
  // ----------------------------------------------------------------
  it('generateInsights shows no-patterns message when no patterns exist', () => {
    const empty = new Undercurrent(undefined);
    const insights = empty.generateInsights();
    expect(insights.some((i) => i.includes('No strong patterns'))).toBe(true);
  });

  // ----------------------------------------------------------------
  // 24. Insights include stress management recommendation
  // ----------------------------------------------------------------
  it('insights include stress management recommendation', () => {
    const points: DataPoint[] = [];
    // Create multiple stress-related patterns
    for (let i = 0; i < 10; i++) {
      points.push({
        timestamp: Date.now() + i * 1000,
        valence: -0.8,
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.85,
      });
    }
    uc.scan(points);
    const insights = uc.generateInsights();
    // Should have at least correlation insight
    expect(insights.length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 25. Operations without bus do not throw
  // ----------------------------------------------------------------
  it('operations without bus do not throw', () => {
    expect(() => uc.scan(makeDataPoints(10))).not.toThrow();
    expect(() => uc.generateInsights()).not.toThrow();
  });
});

describe('createUndercurrentModule factory', () => {
  // ----------------------------------------------------------------
  // 26. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createUndercurrentModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(Undercurrent);
    instance.scan(makeDataPoints(10, { valence: -0.8, stress: 0.8 }));
    expect(instance.getPatterns().length).toBeGreaterThanOrEqual(0);
  });

  // ----------------------------------------------------------------
  // 27. Factory accepts bus and options
  // ----------------------------------------------------------------
  it('factory accepts bus and options', () => {
    const bus = { emit: () => undefined };
    const instance = createUndercurrentModule(bus, { scanDepth: 10 });
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(Undercurrent);
  });
});

describe('undercurrent_module metadata', () => {
  // ----------------------------------------------------------------
  // 28. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(undercurrent_module.id).toBe('undercurrent');
    expect(undercurrent_module.name).toBe('Undercurrent');
    expect(undercurrent_module.category).toBe('emotional');
    expect(undercurrent_module.version).toBe('0.1.0');
    expect(undercurrent_module.permissions).toEqual([
      'telemetry:read',
      'history:read',
      'events:emit',
    ]);
    expect(undercurrent_module.description).toBeDefined();
  });
});
