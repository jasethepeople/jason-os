// ============================================================
// Emotional Telemetry Engine — Test Suite
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EmotionalTelemetryEngineImpl,
  createEmotionalTelemetryEngine,
  type EmotionalSample,
  type EmotionalBaseline,
} from './telemetry-engine.js';

describe('EmotionalTelemetryEngine', () => {
  let engine: EmotionalTelemetryEngineImpl;

  beforeEach(() => {
    engine = new EmotionalTelemetryEngineImpl();
  });

  // Helper: create a sample with optional overrides
  const sample = (overrides: Partial<EmotionalSample> = {}): EmotionalSample => ({
    valence: 0,
    arousal: 0.5,
    dominance: 0.5,
    stress: 0.2,
    source: 'test-module',
    timestamp: Date.now(),
    ...overrides,
  });

  // ----------------------------------------------------------------
  // 1. Capture sample updates current state
  // ----------------------------------------------------------------
  it('capture sample updates current state', () => {
    const before = engine.getCurrentState();
    expect(before.confidence).toBe(0);

    engine.captureSample(sample({ valence: 0.8, arousal: 0.7, dominance: 0.6, stress: 0.3 }));

    const after = engine.getCurrentState();
    expect(after.confidence).toBeGreaterThan(0);
    expect(after.valence).toBeCloseTo(0.8, 5);
    expect(after.arousal).toBeCloseTo(0.7, 5);
    expect(after.dominance).toBeCloseTo(0.6, 5);
    expect(after.stress).toBeCloseTo(0.3, 5);
  });

  // ----------------------------------------------------------------
  // 2. Default baseline is neutral
  // ----------------------------------------------------------------
  it('default baseline is neutral', () => {
    const baseline = engine.getBaseline();
    expect(baseline.valence).toBe(0);
    expect(baseline.arousal).toBe(0.5);
    expect(baseline.dominance).toBe(0.5);
    expect(baseline.stress).toBe(0.2);
    expect(baseline.sampleCount).toBe(0);
  });

  // ----------------------------------------------------------------
  // 3. Set custom baseline
  // ----------------------------------------------------------------
  it('set custom baseline', () => {
    const custom: EmotionalBaseline = {
      valence: 0.3,
      arousal: 0.6,
      dominance: 0.7,
      stress: 0.1,
      sampleCount: 50,
    };
    engine.setBaseline(custom);

    const baseline = engine.getBaseline();
    expect(baseline.valence).toBeCloseTo(0.3, 5);
    expect(baseline.arousal).toBeCloseTo(0.6, 5);
    expect(baseline.dominance).toBeCloseTo(0.7, 5);
    expect(baseline.stress).toBeCloseTo(0.1, 5);
    expect(baseline.sampleCount).toBe(50);
  });

  // ----------------------------------------------------------------
  // 4. Rolling average computed correctly
  // ----------------------------------------------------------------
  it('rolling average computed correctly', () => {
    engine.captureSample(sample({ valence: 0.5, arousal: 0.5, dominance: 0.5, stress: 0.5 }));
    engine.captureSample(sample({ valence: -0.5, arousal: 0.3, dominance: 0.7, stress: 0.1 }));

    const state = engine.getCurrentState();
    expect(state.valence).toBeCloseTo(0, 5);
    expect(state.arousal).toBeCloseTo(0.4, 5);
    expect(state.dominance).toBeCloseTo(0.6, 5);
    expect(state.stress).toBeCloseTo(0.3, 5);
  });

  // ----------------------------------------------------------------
  // 5. Stress spike detected when stress jumps
  // ----------------------------------------------------------------
  it('stress spike detected when stress jumps', () => {
    // First establish a low-stress baseline
    for (let i = 0; i < 5; i++) {
      engine.captureSample(sample({ stress: 0.1, timestamp: Date.now() + i }));
    }
    // Now spike stress
    engine.captureSample(sample({ stress: 0.9, timestamp: Date.now() + 10 }));
    expect(engine.detectStressSpike()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 6. No stress spike when stress normal
  // ----------------------------------------------------------------
  it('no stress spike when stress normal', () => {
    engine.captureSample(sample({ stress: 0.2 }));
    engine.captureSample(sample({ stress: 0.3 }));
    expect(engine.detectStressSpike()).toBe(false);
  });

  // ----------------------------------------------------------------
  // 7. Emotional drift detected when deviating from baseline
  // ----------------------------------------------------------------
  it('emotional drift detected when deviating from baseline', () => {
    // Set a known baseline
    engine.setBaseline({
      valence: 0,
      arousal: 0.5,
      dominance: 0.5,
      stress: 0.2,
      sampleCount: 100,
    });

    // Push valence far from baseline — use extreme value + fewer samples
    // to ensure baseline learning doesn't dilute the drift magnitude
    for (let i = 0; i < 3; i++) {
      engine.captureSample(sample({ valence: -0.95, timestamp: Date.now() + i * 1000 }));
    }

    const drift = engine.detectEmotionalDrift();
    expect(drift).not.toBeNull();
    expect(drift!.dimension).toBe('valence');
    expect(drift!.direction).toBe('decreasing');
    expect(drift!.severity).toBe('severe');
  });

  // ----------------------------------------------------------------
  // 8. No drift when near baseline
  // ----------------------------------------------------------------
  it('no drift when near baseline', () => {
    engine.setBaseline({
      valence: 0,
      arousal: 0.5,
      dominance: 0.5,
      stress: 0.2,
      sampleCount: 100,
    });

    // Samples close to baseline
    for (let i = 0; i < 5; i++) {
      engine.captureSample(sample({ valence: 0.05, arousal: 0.52, stress: 0.22 }));
    }

    expect(engine.detectEmotionalDrift()).toBeNull();
  });

  // ----------------------------------------------------------------
  // 9. Hourly report has correct period
  // ----------------------------------------------------------------
  it('hourly report has correct period', () => {
    engine.captureSample(sample());
    const report = engine.getHourlyReport();
    expect(report.period).toBe('hourly');
  });

  // ----------------------------------------------------------------
  // 10. Daily report aggregates correctly
  // ----------------------------------------------------------------
  it('daily report aggregates correctly', () => {
    const now = Date.now();
    engine.captureSample(sample({ valence: 0.5, stress: 0.2, timestamp: now - 3600_000 }));
    engine.captureSample(sample({ valence: -0.3, stress: 0.8, timestamp: now - 1800_000 }));
    engine.captureSample(sample({ valence: 0.1, stress: 0.4, timestamp: now - 600_000 }));

    const report = engine.getDailyReport();
    expect(report.period).toBe('daily');
    expect(report.sampleCount).toBe(3);
    expect(report.average.valence).toBeCloseTo(0.1, 5);
  });

  // ----------------------------------------------------------------
  // 11. Weekly report has trend
  // ----------------------------------------------------------------
  it('weekly report has trend', () => {
    const now = Date.now();
    // First half: negative valence, high stress
    for (let i = 0; i < 5; i++) {
      engine.captureSample(
        sample({ valence: -0.6, stress: 0.8, timestamp: now - 3 * 86400_000 + i * 3600_000 })
      );
    }
    // Second half: positive valence, low stress
    for (let i = 0; i < 5; i++) {
      engine.captureSample(
        sample({ valence: 0.6, stress: 0.2, timestamp: now - 86400_000 + i * 3600_000 })
      );
    }

    const report = engine.getWeeklyReport();
    expect(report.period).toBe('weekly');
    expect(report.trend).toBe('improving');
  });

  // ----------------------------------------------------------------
  // 12. Stress handler called on spike
  // ----------------------------------------------------------------
  it('stress handler called on spike', () => {
    const handler = vi.fn();
    const unsubscribe = engine.onStressSpike(handler);

    // Establish low baseline
    for (let i = 0; i < 5; i++) {
      engine.captureSample(sample({ stress: 0.1, timestamp: Date.now() + i }));
    }
    // Spike
    engine.captureSample(sample({ stress: 0.9, timestamp: Date.now() + 100 }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(0.9);

    unsubscribe();
  });

  // ----------------------------------------------------------------
  // 13. Drift handler called on drift
  // ----------------------------------------------------------------
  it('drift handler called on drift', () => {
    const handler = vi.fn();
    const unsubscribe = engine.onDrift(handler);

    engine.setBaseline({
      valence: 0,
      arousal: 0.5,
      dominance: 0.5,
      stress: 0.2,
      sampleCount: 100,
    });

    for (let i = 0; i < 10; i++) {
      engine.captureSample(sample({ valence: -0.8, timestamp: Date.now() + i * 1000 }));
    }

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0]![0].dimension).toBe('valence');

    unsubscribe();
  });

  // ----------------------------------------------------------------
  // 14. Privacy mode full exports all data
  // ----------------------------------------------------------------
  it('privacy mode full exports all data', () => {
    engine.captureSample(sample({ valence: 0.5, source: 'test-module' }));
    engine.setPrivacyMode('full');
    const data = engine.exportData();

    expect(data.samples.length).toBe(1);
    expect(data.samples[0]!.source).toBe('test-module');
    expect(data.baseline).toBeDefined();
    expect(data.exportedAt).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 15. Privacy mode anonymized strips sources
  // ----------------------------------------------------------------
  it('privacy mode anonymized strips sources', () => {
    engine.captureSample(sample({ valence: 0.5, source: 'sensitive-module' }));
    engine.setPrivacyMode('anonymized');
    const data = engine.exportData();

    expect(data.samples.length).toBe(1);
    expect(data.samples[0]!.source).toBeUndefined();
    expect(data.samples[0]!.valence).toBe(0.5);
  });

  // ----------------------------------------------------------------
  // 16. Privacy mode minimal exports only trends
  // ----------------------------------------------------------------
  it('privacy mode minimal exports only trends', () => {
    engine.captureSample(sample());
    engine.setPrivacyMode('minimal');
    const data = engine.exportData();

    expect(data.samples.length).toBe(0);
    expect(data.reports.length).toBe(3); // hourly + daily + weekly
    expect(data.baseline).toBeDefined();
  });

  // ----------------------------------------------------------------
  // 17. Clear history removes samples
  // ----------------------------------------------------------------
  it('clear history removes samples', () => {
    engine.captureSample(sample());
    engine.captureSample(sample());
    expect(engine.getCurrentState().confidence).toBeGreaterThan(0);

    engine.clearHistory();
    expect(engine.getCurrentState().confidence).toBe(0);
    expect(engine.getCurrentState().valence).toBe(0);
  });

  // ----------------------------------------------------------------
  // 18. Baseline learning adjusts over time
  // ----------------------------------------------------------------
  it('baseline learning adjusts over time', () => {
    const initialBaseline = engine.getBaseline();
    expect(initialBaseline.valence).toBe(0);

    // Feed consistently positive valence
    for (let i = 0; i < 20; i++) {
      engine.captureSample(sample({ valence: 0.8, timestamp: Date.now() + i }));
    }

    const learnedBaseline = engine.getBaseline();
    expect(learnedBaseline.valence).toBeGreaterThan(0);
    expect(learnedBaseline.sampleCount).toBe(20);
  });

  // ----------------------------------------------------------------
  // 19. Confidence increases with more samples
  // ----------------------------------------------------------------
  it('confidence increases with more samples', () => {
    engine.captureSample(sample());
    const c1 = engine.getCurrentState().confidence;

    for (let i = 0; i < 50; i++) {
      engine.captureSample(sample({ timestamp: Date.now() + i }));
    }
    const c2 = engine.getCurrentState().confidence;

    expect(c2).toBeGreaterThan(c1);
  });

  // ----------------------------------------------------------------
  // 20. Sample source tracked
  // ----------------------------------------------------------------
  it('sample source tracked', () => {
    engine.captureSample(sample({ source: 'module-a' }));
    engine.setPrivacyMode('full');
    const data = engine.exportData();
    expect(data.samples[0]!.source).toBe('module-a');
  });

  // ----------------------------------------------------------------
  // 21. Report trend: improving
  // ----------------------------------------------------------------
  it('report trend improving', () => {
    const now = Date.now();
    // First half: bad
    for (let i = 0; i < 4; i++) {
      engine.captureSample(
        sample({ valence: -0.8, stress: 0.9, timestamp: now - 2000 + i * 100 })
      );
    }
    // Second half: good
    for (let i = 0; i < 4; i++) {
      engine.captureSample(
        sample({ valence: 0.8, stress: 0.1, timestamp: now - 1000 + i * 100 })
      );
    }

    const report = engine.getHourlyReport();
    expect(report.trend).toBe('improving');
  });

  // ----------------------------------------------------------------
  // 22. Report trend: declining
  // ----------------------------------------------------------------
  it('report trend declining', () => {
    const now = Date.now();
    // First half: good
    for (let i = 0; i < 4; i++) {
      engine.captureSample(
        sample({ valence: 0.8, stress: 0.1, timestamp: now - 2000 + i * 100 })
      );
    }
    // Second half: bad
    for (let i = 0; i < 4; i++) {
      engine.captureSample(
        sample({ valence: -0.8, stress: 0.9, timestamp: now - 1000 + i * 100 })
      );
    }

    const report = engine.getHourlyReport();
    expect(report.trend).toBe('declining');
  });

  // ----------------------------------------------------------------
  // 23. Report trend: stable
  // ----------------------------------------------------------------
  it('report trend stable', () => {
    const now = Date.now();
    // Consistent samples
    for (let i = 0; i < 8; i++) {
      engine.captureSample(
        sample({ valence: 0.1, stress: 0.3, timestamp: now - 4000 + i * 100 })
      );
    }

    const report = engine.getHourlyReport();
    expect(report.trend).toBe('stable');
  });

  // ----------------------------------------------------------------
  // 24. Stress incidents counted in report
  // ----------------------------------------------------------------
  it('stress incidents counted in report', () => {
    const now = Date.now();
    // Low stress
    engine.captureSample(sample({ stress: 0.1, timestamp: now - 3000 }));
    // Spike 1
    engine.captureSample(sample({ stress: 0.9, timestamp: now - 2000 }));
    // Back down
    engine.captureSample(sample({ stress: 0.2, timestamp: now - 1500 }));
    // Spike 2
    engine.captureSample(sample({ stress: 0.95, timestamp: now - 1000 }));

    const report = engine.getHourlyReport();
    expect(report.stressIncidents).toBe(2);
  });
});

describe('createEmotionalTelemetryEngine factory', () => {
  it('returns a working engine instance', () => {
    const eng = createEmotionalTelemetryEngine();
    expect(eng).toBeDefined();
    eng.captureSample({
      valence: 0.5,
      arousal: 0.5,
      dominance: 0.5,
      stress: 0.2,
      source: 'factory-test',
    });
    expect(eng.getCurrentState().confidence).toBeGreaterThan(0);
  });
});
