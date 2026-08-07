// ============================================================
// QuietFrame — Test Suite
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  QuietFrame,
  createQuietFrameModule,
  quiet_frame_module,
} from './module.js';
import type { FrameState } from './types.js';

describe('QuietFrame', () => {
  let frame: QuietFrame;

  beforeEach(() => {
    frame = new QuietFrame();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = frame.getState();
    expect(state.softened).toBe(false);
    expect(state.originalText).toBeNull();
    expect(state.softenedText).toBeNull();
    expect(state.softensApplied).toBe(0);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(frame.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. soften replaces harsh language with softer alternatives
  // ----------------------------------------------------------------
  it('soften replaces harsh language with softer alternatives', () => {
    const result = frame.soften('you must complete this task');
    expect(result).toBe('you might consider complete this task');
    expect(frame.wasSoftened()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 4. soften handles multiple replacements in one text
  // ----------------------------------------------------------------
  it('soften handles multiple replacements in one text', () => {
    const result = frame.soften(
      'You must always fail because you are stupid'
    );
    expect(result).toBe(
      'You might consider often did not succeed yet because you are challenging'
    );
    expect(frame.getSoftensApplied()).toBe(4);
  });

  // ----------------------------------------------------------------
  // 5. soften is case-insensitive
  // ----------------------------------------------------------------
  it('soften is case-insensitive', () => {
    const result = frame.soften('You MUST Always FAIL');
    expect(result).toBe('You might consider Often did not succeed yet');
    expect(frame.getSoftensApplied()).toBe(3);
  });

  // ----------------------------------------------------------------
  // 6. soften tracks original text
  // ----------------------------------------------------------------
  it('soften tracks original text', () => {
    const original = 'you must do this';
    frame.soften(original);
    expect(frame.restore()).toBe(original);
  });

  // ----------------------------------------------------------------
  // 7. soften updates softened state flag
  // ----------------------------------------------------------------
  it('soften updates softened state flag', () => {
    frame.soften('this is nice text');
    expect(frame.wasSoftened()).toBe(false);
  });

  // ----------------------------------------------------------------
  // 8. getSoftenedText returns the softened text
  // ----------------------------------------------------------------
  it('getSoftenedText returns the softened text', () => {
    frame.soften('you must go');
    expect(frame.getSoftenedText()).toBe('you might consider go');
  });

  // ----------------------------------------------------------------
  // 9. getState returns a complete snapshot
  // ----------------------------------------------------------------
  it('getState returns a complete snapshot', () => {
    frame.soften('you must always try');
    const state: FrameState = frame.getState();
    expect(state.softened).toBe(true);
    expect(state.originalText).toBe('you must always try');
    expect(state.softenedText).toBe('you might consider often try');
    expect(state.softensApplied).toBe(2);
  });

  // ----------------------------------------------------------------
  // 10. soften accumulates softensApplied across calls
  // ----------------------------------------------------------------
  it('soften accumulates softensApplied across calls', () => {
    frame.soften('you must');
    expect(frame.getSoftensApplied()).toBe(1);
    frame.soften('you always fail');
    expect(frame.getSoftensApplied()).toBe(3);
  });

  // ----------------------------------------------------------------
  // 11. softenWithPatterns uses custom replacements
  // ----------------------------------------------------------------
  it('softenWithPatterns uses custom replacements', () => {
    const customPatterns: Array<[RegExp, string]> = [
      [/\bproblem\b/gi, 'opportunity'],
      [/\bbad\b/gi, 'learning moment'],
    ];
    const result = frame.softenWithPatterns(
      'this is a bad problem',
      customPatterns
    );
    expect(result).toBe('this is a learning moment opportunity');
    expect(frame.wasSoftened()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 12. softenWithPatterns does not affect default patterns
  // ----------------------------------------------------------------
  it('softenWithPatterns does not affect default patterns', () => {
    const customPatterns: Array<[RegExp, string]> = [
      [/\bcustom\b/gi, 'replaced'],
    ];
    const result = frame.softenWithPatterns(
      'you must use a custom word',
      customPatterns
    );
    // "you must" is NOT replaced by custom patterns
    expect(result).toBe('you must use a replaced word');
    expect(frame.getSoftensApplied()).toBe(1);
  });

  // ----------------------------------------------------------------
  // 13. restore returns null before any soften call
  // ----------------------------------------------------------------
  it('restore returns null before any soften call', () => {
    expect(frame.restore()).toBeNull();
  });

  // ----------------------------------------------------------------
  // 14. getSoftenedText returns null before any soften call
  // ----------------------------------------------------------------
  it('getSoftenedText returns null before any soften call', () => {
    expect(frame.getSoftenedText()).toBeNull();
  });

  // ----------------------------------------------------------------
  // 15. reset clears all state
  // ----------------------------------------------------------------
  it('reset clears all state', () => {
    frame.soften('you must always fail');
    expect(frame.getSoftensApplied()).toBeGreaterThan(0);
    frame.reset();
    const state = frame.getState();
    expect(state.softened).toBe(false);
    expect(state.originalText).toBeNull();
    expect(state.softenedText).toBeNull();
    expect(state.softensApplied).toBe(0);
  });

  // ----------------------------------------------------------------
  // 16. destroy resets and clears bus reference
  // ----------------------------------------------------------------
  it('destroy resets and clears bus reference', async () => {
    frame.soften('you must go');
    await frame.destroy();
    const state = frame.getState();
    expect(state.softened).toBe(false);
    expect(state.originalText).toBeNull();
    expect(state.softensApplied).toBe(0);
  });

  // ----------------------------------------------------------------
  // 17. soften handles empty string
  // ----------------------------------------------------------------
  it('soften handles empty string', () => {
    const result = frame.soften('');
    expect(result).toBe('');
    expect(frame.wasSoftened()).toBe(false);
  });

  // ----------------------------------------------------------------
  // 18. soften handles text with no matches
  // ----------------------------------------------------------------
  it('soften handles text with no matches', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const result = frame.soften(text);
    expect(result).toBe(text);
    expect(frame.wasSoftened()).toBe(false);
    expect(frame.getSoftensApplied()).toBe(0);
  });

  // ----------------------------------------------------------------
  // 19. soften handles all default patterns at once
  // ----------------------------------------------------------------
  it('soften handles all default patterns at once', () => {
    const harsh =
      'you must, you have to, always, never, should, need to, fail, stupid, hate, disaster';
    const softened = frame.soften(harsh);
    expect(softened).toContain('you might consider');
    expect(softened).toContain('it could help to');
    expect(softened).toContain('often');
    expect(softened).toContain('sometimes not');
    expect(softened).toContain('could');
    expect(softened).toContain('might want to');
    expect(softened).toContain('did not succeed yet');
    expect(softened).toContain('challenging');
    expect(softened).toContain('find difficult');
    expect(softened).toContain('a situation worth care');
    expect(frame.getSoftensApplied()).toBe(10);
  });

  // ----------------------------------------------------------------
  // 20. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    frame.soften('you must run');
    const state1 = frame.getState();
    frame.soften('you should try');
    const state2 = frame.getState();
    expect(state1.softensApplied).toBe(1);
    expect(state2.softensApplied).toBe(2);
  });

  // ----------------------------------------------------------------
  // 21. soften replaces hate
  // ----------------------------------------------------------------
  it('soften replaces hate', () => {
    const result = frame.soften('I hate this job');
    expect(result).toBe('I find difficult this job');
  });

  // ----------------------------------------------------------------
  // 22. soften replaces disaster
  // ----------------------------------------------------------------
  it('soften replaces disaster', () => {
    const result = frame.soften('This is a total disaster');
    expect(result).toBe('This is a total a situation worth care');
  });

  // ----------------------------------------------------------------
  // 23. soften replaces should
  // ----------------------------------------------------------------
  it('soften replaces should', () => {
    const result = frame.soften('You should work harder');
    expect(result).toBe('You could work harder');
  });

  // ----------------------------------------------------------------
  // 24. soften replaces need to
  // ----------------------------------------------------------------
  it('soften replaces need to', () => {
    const result = frame.soften('You need to fix this');
    expect(result).toBe('You might want to fix this');
  });

  // ----------------------------------------------------------------
  // 25. soften handles repeated calls with different texts
  // ----------------------------------------------------------------
  it('soften handles repeated calls with different texts', () => {
    const r1 = frame.soften('you must leave');
    const r2 = frame.soften('never give up');
    expect(r1).toBe('you might consider leave');
    expect(r2).toBe('sometimes not give up');
    expect(frame.getSoftensApplied()).toBe(2);
  });
});

describe('createQuietFrameModule factory', () => {
  // ----------------------------------------------------------------
  // 26. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createQuietFrameModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(QuietFrame);
    const result = instance.soften('you must try');
    expect(result).toBe('you might consider try');
  });

  // ----------------------------------------------------------------
  // 27. Factory accepts optional bus parameter
  // ----------------------------------------------------------------
  it('factory accepts optional bus parameter', () => {
    const bus = { emit: () => undefined };
    const instance = createQuietFrameModule(bus);
    expect(instance).toBeDefined();
  });
});

describe('quiet_frame_module metadata', () => {
  // ----------------------------------------------------------------
  // 28. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(quiet_frame_module.id).toBe('quiet-frame');
    expect(quiet_frame_module.name).toBe('QuietFrame');
    expect(quiet_frame_module.category).toBe('emotional');
    expect(quiet_frame_module.version).toBe('0.1.0');
    expect(quiet_frame_module.permissions).toEqual([
      'input:read',
      'transform',
    ]);
    expect(quiet_frame_module.description).toBeDefined();
  });
});
