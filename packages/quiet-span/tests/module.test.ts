import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuietSpan, createQuietSpanModule, quiet_span_module } from '../src/module.js';
import type { FocusSession, QuietSpanState } from '../src/types.js';

describe('quiet_span_module', () => {
  it('should export correct module metadata', () => {
    expect(quiet_span_module.id).toBe('quiet-span');
    expect(quiet_span_module.name).toBe('QuietSpan');
    expect(quiet_span_module.category).toBe('productivity');
    expect(quiet_span_module.version).toBe('0.1.0');
    expect(quiet_span_module.permissions).toEqual([
      'timer',
      'focus',
      'storage:write',
    ]);
    expect(quiet_span_module.description).toBe(
      'Timed focus sessions with emotional context tracking'
    );
  });
});

describe('QuietSpan', () => {
  let quietSpan: QuietSpan;

  beforeEach(() => {
    quietSpan = new QuietSpan();
  });

  describe('lifecycle', () => {
    it('should initialize without error', async () => {
      await expect(quietSpan.init()).resolves.toBeUndefined();
    });

    it('should destroy without error', async () => {
      await expect(quietSpan.destroy()).resolves.toBeUndefined();
    });

    it('should getState after init', async () => {
      await quietSpan.init();
      const state = quietSpan.getState();
      expect(state).toBeDefined();
      expect(state.sessions).toEqual([]);
      expect(state.activeSession).toBeNull();
      expect(state.focusScore).toBe(0);
    });
  });

  describe('startSession', () => {
    it('should start a new session with given duration and tag', () => {
      const session = quietSpan.startSession(25, 'coding');

      expect(session.id).toMatch(/^qs-\d+$/);
      expect(session.durationMin).toBe(25);
      expect(session.tag).toBe('coding');
      expect(session.startedAt).toBeGreaterThan(0);
      expect(session.endedAt).toBeNull();
      expect(session.breakTaken).toBe(false);
      expect(session.notes).toBe('');
    });

    it('should use default tag when not provided', () => {
      const session = quietSpan.startSession(30);
      expect(session.tag).toBe('default');
    });

    it('should throw if session already active', () => {
      quietSpan.startSession(25);
      expect(() => quietSpan.startSession(30)).toThrow('Session already active');
    });

    it('should set activeSession in state', () => {
      const session = quietSpan.startSession(25, 'deep-work');
      const state = quietSpan.getState();
      expect(state.activeSession).not.toBeNull();
      expect(state.activeSession!.id).toBe(session.id);
    });
  });

  describe('endSession', () => {
    it('should throw if no session is active', () => {
      expect(() => quietSpan.endSession()).toThrow('No active session');
    });

    it('should end the active session and return it', () => {
      const startSession = quietSpan.startSession(25, 'test');
      const endSession = quietSpan.endSession('completed notes');

      expect(endSession.id).toBe(startSession.id);
      expect(endSession.endedAt).not.toBeNull();
      expect(endSession.endedAt).toBeGreaterThanOrEqual(startSession.startedAt);
      expect(endSession.notes).toBe('completed notes');
    });

    it('should move session to completed sessions list', () => {
      quietSpan.startSession(25);
      const ended = quietSpan.endSession();
      const state = quietSpan.getState();

      expect(state.activeSession).toBeNull();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe(ended.id);
    });

    it('should use empty notes when not provided', () => {
      quietSpan.startSession(15);
      const ended = quietSpan.endSession();
      expect(ended.notes).toBe('');
    });
  });

  describe('markBreakTaken', () => {
    it('should mark break taken on active session', () => {
      quietSpan.startSession(25);
      quietSpan.markBreakTaken();
      const state = quietSpan.getState();
      expect(state.activeSession!.breakTaken).toBe(true);
    });

    it('should do nothing when no session active', () => {
      expect(() => quietSpan.markBreakTaken()).not.toThrow();
      const state = quietSpan.getState();
      expect(state.activeSession).toBeNull();
    });
  });

  describe('getActiveMinutes', () => {
    it('should return 0 when no session active', () => {
      expect(quietSpan.getActiveMinutes()).toBe(0);
    });

    it('should return elapsed minutes for active session', () => {
      quietSpan.startSession(60);
      // Mock Date.now to return a consistent value
      const nowSpy = vi
        .spyOn(Date, 'now')
        .mockReturnValue(Date.now() + 5 * 60000); // +5 minutes

      expect(quietSpan.getActiveMinutes()).toBeGreaterThanOrEqual(4);
      nowSpy.mockRestore();
    });
  });

  describe('emotion tracking', () => {
    it('should capture emotion at start', () => {
      quietSpan.captureEmotionAtStart({ valence: 0.7, stress: 0.3 });
      const state = quietSpan.getState();
      expect(state.emotionAtStart).toEqual({ valence: 0.7, stress: 0.3 });
    });

    it('should capture emotion at end', () => {
      quietSpan.captureEmotionAtEnd({ valence: 0.8, stress: 0.1 });
      const state = quietSpan.getState();
      expect(state.emotionAtEnd).toEqual({ valence: 0.8, stress: 0.1 });
    });

    it('should compute emotion shift correctly', () => {
      quietSpan.captureEmotionAtStart({ valence: 0.5, stress: 0.7 });
      quietSpan.captureEmotionAtEnd({ valence: 0.8, stress: 0.2 });
      const shift = quietSpan.getEmotionShift();

      expect(shift).not.toBeNull();
      expect(shift!.valenceDelta).toBeCloseTo(0.3, 5);
      expect(shift!.stressDelta).toBeCloseTo(-0.5, 5);
    });

    it('should return null for emotion shift when data incomplete', () => {
      expect(quietSpan.getEmotionShift()).toBeNull();

      quietSpan.captureEmotionAtStart({ valence: 0.5, stress: 0.5 });
      expect(quietSpan.getEmotionShift()).toBeNull();
    });
  });

  describe('focus score calculation', () => {
    it('should calculate focus score based on completed sessions', () => {
      // Complete 3 sessions
      for (let i = 0; i < 3; i++) {
        quietSpan.startSession(10);
        quietSpan.endSession();
      }

      const state = quietSpan.getState();
      expect(state.focusScore).toBeGreaterThan(0);
      expect(state.focusScore).toBeLessThanOrEqual(100);
    });

    it('should cap focus score at 100', () => {
      // Complete many sessions
      for (let i = 0; i < 20; i++) {
        quietSpan.startSession(60);
        quietSpan.endSession();
      }

      const state = quietSpan.getState();
      expect(state.focusScore).toBe(100);
    });
  });

  describe('getState immutability', () => {
    it('should return a deep clone of state', () => {
      quietSpan.startSession(25);
      const state1 = quietSpan.getState();
      const state2 = quietSpan.getState();

      expect(state1).not.toBe(state2);
      expect(state1.sessions).not.toBe(state2.sessions);
      if (state1.activeSession && state2.activeSession) {
        expect(state1.activeSession).not.toBe(state2.activeSession);
      }
    });
  });
});

describe('createQuietSpanModule', () => {
  it('should create a QuietSpan instance', () => {
    const mod = createQuietSpanModule();
    expect(mod).toBeInstanceOf(QuietSpan);
  });

  it('should pass bus to constructor', () => {
    const bus = { emit: vi.fn() };
    const mod = createQuietSpanModule(bus);
    expect(mod).toBeInstanceOf(QuietSpan);
  });
});
