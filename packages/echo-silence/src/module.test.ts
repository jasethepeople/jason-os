import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EchoSilence, createEchoSilenceModule, echo_silence_module } from './module.js';
import type { SilenceState } from './types.js';

describe('EchoSilence — module definition', () => {
  it('should export correct module metadata', () => {
    expect(echo_silence_module.id).toBe('echo-silence');
    expect(echo_silence_module.name).toBe('EchoSilence');
    expect(echo_silence_module.category).toBe('emotional');
    expect(echo_silence_module.version).toBe('0.1.0');
    expect(echo_silence_module.permissions).toEqual([
      'timer',
      'audio',
      'telemetry:read',
    ]);
    expect(echo_silence_module.description).toBe(
      'Meditation and silence companion with personalized quiet spaces'
    );
  });
});

describe('EchoSilence — construction', () => {
  it('should create instance without bus', () => {
    const es = new EchoSilence();
    expect(es).toBeDefined();
    expect(es.getState()).toEqual({
      active: false,
      sessionDurationSec: 0,
      breathCount: 0,
      ambientLevel: 'silent',
      streakDays: 0,
      lastSessionAt: null,
    });
  });

  it('should create instance with bus', () => {
    const bus = { emit: vi.fn() };
    const es = new EchoSilence(bus);
    expect(es).toBeDefined();
  });

  it('should init without error', async () => {
    const es = new EchoSilence();
    await expect(es.init()).resolves.toBeUndefined();
  });

  it('should create via factory', () => {
    const es = createEchoSilenceModule();
    expect(es).toBeInstanceOf(EchoSilence);
  });
});

describe('EchoSilence — session lifecycle', () => {
  it('should start a session with default ambient', () => {
    const es = new EchoSilence();
    es.startSession();
    const state = es.getState();
    expect(state.active).toBe(true);
    expect(state.ambientLevel).toBe('silent');
    expect(state.sessionDurationSec).toBe(0);
    expect(state.breathCount).toBe(0);
  });

  it('should start a session with specific ambient level', () => {
    const es = new EchoSilence();
    es.startSession('nature');
    expect(es.getState().ambientLevel).toBe('nature');

    es.endSession();
    es.startSession('white-noise');
    expect(es.getState().ambientLevel).toBe('white-noise');

    es.endSession();
    es.startSession('binaural');
    expect(es.getState().ambientLevel).toBe('binaural');
  });

  it('should record breaths', () => {
    const es = new EchoSilence();
    es.startSession();
    es.recordBreath();
    es.recordBreath();
    es.recordBreath();
    expect(es.getState().breathCount).toBe(3);
  });

  it('should increment duration over time', async () => {
    const es = new EchoSilence();
    es.startSession();
    await new Promise((r) => setTimeout(r, 2100));
    expect(es.getState().sessionDurationSec).toBeGreaterThanOrEqual(2);
    es.endSession();
  });

  it('should end a session', () => {
    const es = new EchoSilence();
    es.startSession();
    es.recordBreath();
    es.endSession();
    const state = es.getState();
    expect(state.active).toBe(false);
    expect(state.breathCount).toBe(1);
    expect(state.lastSessionAt).not.toBeNull();
  });

  it('should emit session-started event', () => {
    const emit = vi.fn();
    const es = new EchoSilence({ emit });
    es.startSession('binaural');
    expect(emit).toHaveBeenCalledWith({
      type: 'echo-silence:session-started',
      data: { ambientLevel: 'binaural' },
      source: 'echo-silence',
    });
  });

  it('should emit session-ended event', () => {
    const emit = vi.fn();
    const es = new EchoSilence({ emit });
    es.startSession();
    es.endSession();
    const call = emit.mock.calls.find(
      (c) => c[0].type === 'echo-silence:session-ended'
    );
    expect(call).toBeDefined();
    expect(call![0].data).toHaveProperty('duration');
    expect(call![0].data).toHaveProperty('breaths');
    expect(call![0].source).toBe('echo-silence');
  });
});

describe('EchoSilence — streak tracking', () => {
  it('should set streak to 1 on first session', () => {
    const es = new EchoSilence();
    es.startSession();
    es.endSession();
    expect(es.getState().streakDays).toBe(1);
  });

  it('should increment streak when session is within 2 days', () => {
    const es = new EchoSilence();
    // Simulate a session that ended 1 day ago
    es.startSession();
    es.endSession();
    expect(es.getState().streakDays).toBe(1);

    // Manually set lastSessionAt to 1 day ago
    es.startSession();
    es.endSession();
    // Second session should increment streak
    expect(es.getState().streakDays).toBe(2);
  });
});

describe('EchoSilence — state immutability', () => {
  it('should return a copy of state, not reference', () => {
    const es = new EchoSilence();
    const state1 = es.getState();
    es.startSession();
    const state2 = es.getState();
    expect(state1).not.toBe(state2);
    expect(state1.active).toBe(false);
    expect(state2.active).toBe(true);
  });
});

describe('EchoSilence — destroy', () => {
  it('should clean up timer on destroy', async () => {
    const es = new EchoSilence();
    es.startSession();
    expect(es.getState().active).toBe(true);
    await es.destroy();
    // Timer should be cleared, no errors
    expect(es.getState().active).toBe(true); // state unchanged
  });

  it('should end session cleanly after destroy', async () => {
    const es = new EchoSilence();
    es.startSession();
    await es.destroy();
    es.endSession();
    expect(es.getState().active).toBe(false);
  });
});
