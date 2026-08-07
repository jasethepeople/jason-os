// ============================================================
// PulseCheckOS — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PulseCheckOS,
  createPulseCheckOSModule,
  pulse_check_os_module,
} from './module.js';
import type { EmotionInput, PulseCheckState } from './types.js';

describe('PulseCheckOS', () => {
  let pulse: PulseCheckOS;

  beforeEach(() => {
    pulse = new PulseCheckOS();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = pulse.getState();
    expect(state.current).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.trendDirection).toBe('stable');
    expect(state.alerts).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(pulse.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. checkVitals returns vital signs with correct structure
  // ----------------------------------------------------------------
  it('checkVitals returns vital signs with correct structure', () => {
    const emotion: EmotionInput = {
      valence: 0.5,
      arousal: 0.6,
      dominance: 0.7,
      stress: 0.2,
    };
    const vitals = pulse.checkVitals(emotion);
    expect(vitals.valence).toBe(0.5);
    expect(vitals.arousal).toBe(0.6);
    expect(vitals.dominance).toBe(0.7);
    expect(vitals.stress).toBe(0.2);
    expect(vitals.timestamp).toBeGreaterThan(0);
    expect(vitals.overall).toBeDefined();
  });

  // ----------------------------------------------------------------
  // 4. checkVitals sets current vitals
  // ----------------------------------------------------------------
  it('checkVitals sets current vitals', () => {
    const emotion: EmotionInput = {
      valence: 0.5,
      arousal: 0.5,
      dominance: 0.5,
      stress: 0.2,
    };
    pulse.checkVitals(emotion);
    const current = pulse.getCurrentVitals();
    expect(current).not.toBeNull();
    expect(current!.valence).toBe(0.5);
  });

  // ----------------------------------------------------------------
  // 5. checkVitals adds to history
  // ----------------------------------------------------------------
  it('checkVitals adds to history', () => {
    pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.2 });
    pulse.checkVitals({ valence: 0.6, arousal: 0.5, dominance: 0.5, stress: 0.3 });
    expect(pulse.getHistoryCount()).toBe(2);
  });

  // ----------------------------------------------------------------
  // 6. checkVitals clamps values out of range
  // ----------------------------------------------------------------
  it('checkVitals clamps values out of range', () => {
    const vitals = pulse.checkVitals({
      valence: 2.0,
      arousal: -0.5,
      dominance: 1.5,
      stress: -0.1,
    });
    expect(vitals.valence).toBe(1);
    expect(vitals.arousal).toBe(0);
    expect(vitals.dominance).toBe(1);
    expect(vitals.stress).toBe(0);
  });

  // ----------------------------------------------------------------
  // 7. computeOverall: stress<0.3 + valence>0.3 = thriving
  // ----------------------------------------------------------------
  it('computeOverall returns thriving for low stress + positive valence', () => {
    const status = pulse.computeOverall({ stress: 0.2, valence: 0.5 });
    expect(status).toBe('thriving');
  });

  // ----------------------------------------------------------------
  // 8. computeOverall: stress<0.6 = stable
  // ----------------------------------------------------------------
  it('computeOverall returns stable for moderate stress', () => {
    const status = pulse.computeOverall({ stress: 0.5, valence: 0.1 });
    expect(status).toBe('stable');
  });

  // ----------------------------------------------------------------
  // 9. computeOverall: stress<0.8 = declining
  // ----------------------------------------------------------------
  it('computeOverall returns declining for high stress', () => {
    const status = pulse.computeOverall({ stress: 0.7, valence: -0.5 });
    expect(status).toBe('declining');
  });

  // ----------------------------------------------------------------
  // 10. computeOverall: stress>=0.8 = critical
  // ----------------------------------------------------------------
  it('computeOverall returns critical for very high stress', () => {
    const status = pulse.computeOverall({ stress: 0.9, valence: -0.2 });
    expect(status).toBe('critical');
  });

  // ----------------------------------------------------------------
  // 11. computeOverall clamps stress to [0, 1]
  // ----------------------------------------------------------------
  it('computeOverall clamps stress to valid range', () => {
    // stress=-0.5 clamped to 0, valence=0.5 > 0.3 => thriving
    expect(pulse.computeOverall({ stress: -0.5, valence: 0.5 })).toBe('thriving');
    // stress=1.5 clamped to 1, valence=0 => critical (stress >= 0.8)
    expect(pulse.computeOverall({ stress: 1.5, valence: 0 })).toBe('critical');
  });

  // ----------------------------------------------------------------
  // 12. detectTrend returns stable with insufficient history
  // ----------------------------------------------------------------
  it('detectTrend returns stable with insufficient history', () => {
    pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.5 });
    pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.5 });
    expect(pulse.detectTrend()).toBe('stable');
  });

  // ----------------------------------------------------------------
  // 13. detectTrend detects improving trend (stress decreasing)
  // ----------------------------------------------------------------
  it('detectTrend detects improving trend', () => {
    for (let i = 0; i < 6; i++) {
      pulse.checkVitals({
        valence: 0.5,
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.7 - i * 0.1,
      });
    }
    expect(pulse.detectTrend()).toBe('improving');
  });

  // ----------------------------------------------------------------
  // 14. detectTrend detects worsening trend (stress increasing)
  // ----------------------------------------------------------------
  it('detectTrend detects worsening trend', () => {
    for (let i = 0; i < 6; i++) {
      pulse.checkVitals({
        valence: 0.5,
        arousal: 0.5,
        dominance: 0.5,
        stress: 0.2 + i * 0.1,
      });
    }
    expect(pulse.detectTrend()).toBe('worsening');
  });

  // ----------------------------------------------------------------
  // 15. getAlerts returns empty when no current vitals
  // ----------------------------------------------------------------
  it('getAlerts returns empty when no current vitals', () => {
    const alerts = pulse.getAlerts();
    expect(alerts).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 16. getAlerts returns critical alert
  // ----------------------------------------------------------------
  it('getAlerts returns critical alert', () => {
    pulse.checkVitals({ valence: -0.5, arousal: 0.9, dominance: 0.1, stress: 0.9 });
    const alerts = pulse.getAlerts();
    expect(alerts.some((a) => a.includes('CRITICAL'))).toBe(true);
  });

  // ----------------------------------------------------------------
  // 17. getAlerts returns declining warning
  // ----------------------------------------------------------------
  it('getAlerts returns declining warning', () => {
    pulse.checkVitals({ valence: 0, arousal: 0.5, dominance: 0.5, stress: 0.7 });
    const alerts = pulse.getAlerts();
    expect(alerts.some((a) => a.includes('WARNING'))).toBe(true);
  });

  // ----------------------------------------------------------------
  // 18. getAlerts returns low valence alert
  // ----------------------------------------------------------------
  it('getAlerts returns low valence alert', () => {
    pulse.checkVitals({ valence: -0.8, arousal: 0.5, dominance: 0.5, stress: 0.2 });
    const alerts = pulse.getAlerts();
    expect(alerts.some((a) => a.includes('LOW_VALENCE'))).toBe(true);
  });

  // ----------------------------------------------------------------
  // 19. getAlerts returns low dominance alert
  // ----------------------------------------------------------------
  it('getAlerts returns low dominance alert', () => {
    pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.1, stress: 0.2 });
    const alerts = pulse.getAlerts();
    expect(alerts.some((a) => a.includes('LOW_DOMINANCE'))).toBe(true);
  });

  // ----------------------------------------------------------------
  // 20. getCurrentVitals returns independent copy
  // ----------------------------------------------------------------
  it('getCurrentVitals returns independent copy', () => {
    pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.2 });
    const v1 = pulse.getCurrentVitals()!;
    v1.valence = 999;
    const v2 = pulse.getCurrentVitals()!;
    expect(v2.valence).toBe(0.5);
  });

  // ----------------------------------------------------------------
  // 21. getHistory returns independent copies
  // ----------------------------------------------------------------
  it('getHistory returns independent copies', () => {
    pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.2 });
    const h1 = pulse.getHistory();
    h1[0]!.valence = 999;
    const h2 = pulse.getHistory();
    expect(h2[0]!.valence).toBe(0.5);
  });

  // ----------------------------------------------------------------
  // 22. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.2 });
    const state1: PulseCheckState = pulse.getState();
    pulse.checkVitals({ valence: 0.6, arousal: 0.5, dominance: 0.5, stress: 0.3 });
    const state2: PulseCheckState = pulse.getState();
    expect(state1.history.length).toBe(1);
    expect(state2.history.length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 23. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.2 });
    await pulse.destroy();
    const state = pulse.getState();
    expect(state.current).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.trendDirection).toBe('stable');
    expect(state.alerts).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 24. History respects maxHistory limit
  // ----------------------------------------------------------------
  it('history respects maxHistory limit', () => {
    const limited = new PulseCheckOS(undefined, { maxHistory: 5 });
    for (let i = 0; i < 10; i++) {
      limited.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: i * 0.1 });
    }
    expect(limited.getHistoryCount()).toBe(5);
  });

  // ----------------------------------------------------------------
  // 25. Trend detection can be disabled
  // ----------------------------------------------------------------
  it('trend detection can be disabled', () => {
    const noTrend = new PulseCheckOS(undefined, { enableTrendDetection: false });
    for (let i = 0; i < 6; i++) {
      noTrend.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.2 + i * 0.1 });
    }
    // Trend stays at default 'stable' since detection is disabled
    expect(noTrend.getTrendDirection()).toBe('stable');
  });

  // ----------------------------------------------------------------
  // 26. Alerts can be disabled
  // ----------------------------------------------------------------
  it('alerts can be disabled', () => {
    const noAlerts = new PulseCheckOS(undefined, { enableAlerts: false });
    noAlerts.checkVitals({ valence: -0.9, arousal: 0.9, dominance: 0.1, stress: 0.95 });
    // Alerts array stays empty since generation is disabled
    expect(noAlerts.getState().alerts).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 27. Multiple vitals produce correct overall statuses
  // ----------------------------------------------------------------
  it('multiple vitals produce correct overall statuses', () => {
    expect(pulse.computeOverall({ stress: 0.1, valence: 0.5 })).toBe('thriving');
    expect(pulse.computeOverall({ stress: 0.29, valence: 0.31 })).toBe('thriving');
    expect(pulse.computeOverall({ stress: 0.5, valence: -0.5 })).toBe('stable');
    expect(pulse.computeOverall({ stress: 0.6, valence: 0.5 })).toBe('declining');
    expect(pulse.computeOverall({ stress: 0.8, valence: 0.9 })).toBe('critical');
    expect(pulse.computeOverall({ stress: 1.0, valence: 1.0 })).toBe('critical');
  });

  // ----------------------------------------------------------------
  // 28. Stable trend detected when stress is flat
  // ----------------------------------------------------------------
  it('stable trend detected when stress is flat', () => {
    for (let i = 0; i < 6; i++) {
      pulse.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.5 });
    }
    expect(pulse.detectTrend()).toBe('stable');
  });

  // ----------------------------------------------------------------
  // 29. Constructor accepts options
  // ----------------------------------------------------------------
  it('constructor accepts options', () => {
    const instance = new PulseCheckOS(undefined, {
      maxHistory: 50,
      enableTrendDetection: false,
      enableAlerts: false,
    });
    expect(instance).toBeDefined();
  });
});

describe('createPulseCheckOSModule factory', () => {
  // ----------------------------------------------------------------
  // 30. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createPulseCheckOSModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(PulseCheckOS);
    instance.checkVitals({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.2 });
    expect(instance.getHistoryCount()).toBe(1);
  });

  // ----------------------------------------------------------------
  // 31. Factory accepts bus and options
  // ----------------------------------------------------------------
  it('factory accepts bus and options', () => {
    const bus = { emit: () => undefined };
    const instance = createPulseCheckOSModule(bus, { maxHistory: 10 });
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(PulseCheckOS);
  });
});

describe('pulse_check_os_module metadata', () => {
  // ----------------------------------------------------------------
  // 32. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(pulse_check_os_module.id).toBe('pulse-check-os');
    expect(pulse_check_os_module.name).toBe('PulseCheckOS');
    expect(pulse_check_os_module.category).toBe('emotional');
    expect(pulse_check_os_module.version).toBe('0.1.0');
    expect(pulse_check_os_module.permissions).toEqual([
      'telemetry:read',
      'events:emit',
      'history:write',
    ]);
    expect(pulse_check_os_module.description).toBeDefined();
  });
});
