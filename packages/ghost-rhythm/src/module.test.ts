import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GhostRhythm,
  createGhostRhythmModule,
  ghost_rhythm_module,
} from './module.js';
import type { Habit, GhostRhythmState } from './types.js';

describe('GhostRhythm — module definition', () => {
  it('should export correct module metadata', () => {
    expect(ghost_rhythm_module.id).toBe('ghost-rhythm');
    expect(ghost_rhythm_module.name).toBe('GhostRhythm');
    expect(ghost_rhythm_module.category).toBe('privacy');
    expect(ghost_rhythm_module.version).toBe('0.1.0');
    expect(ghost_rhythm_module.permissions).toEqual([
      'storage:write',
      'telemetry:read',
    ]);
    expect(ghost_rhythm_module.description).toBe(
      'Privacy-protected habit tracker with stealth logging'
    );
  });
});

describe('GhostRhythm — construction', () => {
  it('should create instance without bus', () => {
    const gr = new GhostRhythm();
    expect(gr).toBeDefined();
    expect(gr.getState()).toEqual({
      habits: [],
      totalCompletions: 0,
      hiddenFromUI: true,
    });
  });

  it('should create instance with bus', () => {
    const bus = { emit: vi.fn() };
    const gr = new GhostRhythm(bus);
    expect(gr).toBeDefined();
  });

  it('should init without error', async () => {
    const gr = new GhostRhythm();
    await expect(gr.init()).resolves.toBeUndefined();
  });

  it('should create via factory', () => {
    const gr = createGhostRhythmModule();
    expect(gr).toBeInstanceOf(GhostRhythm);
  });
});

describe('GhostRhythm — habit creation', () => {
  it('should create a hidden habit by default', () => {
    const gr = new GhostRhythm();
    const habit = gr.createHabit('Morning Meditation', 'wellness');
    expect(habit.name).toBe('Morning Meditation');
    expect(habit.category).toBe('wellness');
    expect(habit.hidden).toBe(true);
    expect(habit.streak).toBe(0);
    expect(habit.lastCompletedAt).toBeNull();
    expect(habit.id.startsWith('habit-')).toBe(true);
  });

  it('should create a visible habit', () => {
    const gr = new GhostRhythm();
    const habit = gr.createHabit('Exercise', 'fitness', false);
    expect(habit.hidden).toBe(false);
  });

  it('should create multiple habits', () => {
    const gr = new GhostRhythm();
    gr.createHabit('Habit 1', 'cat-a');
    gr.createHabit('Habit 2', 'cat-b');
    gr.createHabit('Habit 3', 'cat-c');
    expect(gr.getState().habits.length).toBe(3);
  });
});

describe('GhostRhythm — habit completion', () => {
  it('should set streak to 1 on first completion', () => {
    const gr = new GhostRhythm();
    const habit = gr.createHabit('Read', 'learning', false);
    gr.complete(habit.id);
    expect(gr.getState().habits[0].streak).toBe(1);
    expect(gr.getState().habits[0].lastCompletedAt).not.toBeNull();
    expect(gr.getState().totalCompletions).toBe(1);
  });

  it('should increment streak within 2 days', () => {
    const gr = new GhostRhythm();
    const habit = gr.createHabit('Read', 'learning', false);
    // First completion
    gr.complete(habit.id);
    expect(gr.getState().habits[0].streak).toBe(1);
    // Second completion (immediately — within 2 days)
    gr.complete(habit.id);
    expect(gr.getState().habits[0].streak).toBe(2);
  });

  it('should reset streak after more than 2 days', async () => {
    const gr = new GhostRhythm();
    const habit = gr.createHabit('Read', 'learning', false);
    gr.complete(habit.id);
    expect(gr.getState().habits[0].streak).toBe(1);

    // Simulate 3 days passing by manipulating lastCompletedAt
    const h = gr.getState().habits[0];
    const threeDaysAgo = Date.now() - 3 * 86400000;
    // We need to modify the internal state directly for this test
    (gr as unknown as { state: GhostRhythmState }).state.habits[0].lastCompletedAt = threeDaysAgo;

    gr.complete(habit.id);
    expect(gr.getState().habits[0].streak).toBe(1); // Reset, not incremented
  });

  it('should not throw when completing non-existent habit', () => {
    const gr = new GhostRhythm();
    expect(() => gr.complete('nonexistent')).not.toThrow();
  });

  it('should emit completion event', () => {
    const emit = vi.fn();
    const gr = new GhostRhythm({ emit });
    const habit = gr.createHabit('Read', 'learning', false);
    gr.complete(habit.id);
    expect(emit).toHaveBeenCalledWith({
      type: 'ghost-rhythm:completed',
      data: { habitId: habit.id, streak: 1 },
      source: 'ghost-rhythm',
    });
  });
});

describe('GhostRhythm — visibility', () => {
  it('should return only visible habits by default', () => {
    const gr = new GhostRhythm();
    gr.createHabit('Hidden Habit', 'private', true);
    gr.createHabit('Visible Habit', 'public', false);
    const visible = gr.getVisibleHabits();
    expect(visible.length).toBe(1);
    expect(visible[0].name).toBe('Visible Habit');
  });

  it('should return all habits with auth token', () => {
    const gr = new GhostRhythm();
    gr.createHabit('Hidden Habit', 'private', true);
    gr.createHabit('Visible Habit', 'public', false);
    const all = gr.getAllHabits('valid-token');
    expect(all.length).toBe(2);
  });

  it('should return only visible habits without auth token', () => {
    const gr = new GhostRhythm();
    gr.createHabit('Hidden Habit', 'private', true);
    gr.createHabit('Visible Habit', 'public', false);
    const visible = gr.getAllHabits();
    expect(visible.length).toBe(1);
    expect(visible[0].name).toBe('Visible Habit');
  });

  it('should return empty array when no visible habits', () => {
    const gr = new GhostRhythm();
    gr.createHabit('Secret', 'private', true);
    expect(gr.getVisibleHabits().length).toBe(0);
  });
});

describe('GhostRhythm — state immutability', () => {
  it('should return a copy of state', () => {
    const gr = new GhostRhythm();
    gr.createHabit('Test', 'cat', false);
    const state1 = gr.getState();
    state1.habits.push({
      id: 'fake',
      name: 'fake',
      streak: 0,
      lastCompletedAt: null,
      hidden: false,
      category: 'fake',
    });
    expect(gr.getState().habits.length).toBe(1);
  });

  it('should return a copy of habits array', () => {
    const gr = new GhostRhythm();
    gr.createHabit('Test', 'cat', false);
    const habits = gr.getAllHabits('token');
    habits[0].name = 'modified';
    expect(gr.getState().habits[0].name).toBe('Test');
  });
});

describe('GhostRhythm — destroy', () => {
  it('should destroy cleanly', async () => {
    const gr = new GhostRhythm();
    gr.createHabit('Test', 'cat', false);
    await expect(gr.destroy()).resolves.toBeUndefined();
  });
});
