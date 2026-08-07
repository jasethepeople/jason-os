import type { Habit, GhostRhythmState } from './types.js';

export const ghost_rhythm_module = {
  id: 'ghost-rhythm',
  name: 'GhostRhythm',
  category: 'privacy' as const,
  version: '0.1.0',
  permissions: ['storage:write', 'telemetry:read'] as const,
  description: 'Privacy-protected habit tracker with stealth logging',
};

export class GhostRhythm {
  private state: GhostRhythmState = {
    habits: [],
    totalCompletions: 0,
    hiddenFromUI: true,
  };
  private _bus: unknown;

  constructor(bus?: unknown) {
    this._bus = bus;
  }

  async init(): Promise<void> {
    /* no-op */
  }

  createHabit(name: string, category: string, hidden = true): Habit {
    const habit: Habit = {
      id: `habit-${Date.now()}`,
      name,
      streak: 0,
      lastCompletedAt: null,
      hidden,
      category,
    };
    this.state.habits.push(habit);
    return habit;
  }

  complete(id: string): void {
    const habit = this.state.habits.find((h) => h.id === id);
    if (!habit) return;
    const dayMs = 86400000;
    if (habit.lastCompletedAt && Date.now() - habit.lastCompletedAt < dayMs * 2) {
      habit.streak++;
    } else {
      habit.streak = 1;
    }
    habit.lastCompletedAt = Date.now();
    this.state.totalCompletions++;
    this.emit('ghost-rhythm:completed', { habitId: id, streak: habit.streak });
  }

  getVisibleHabits(): Habit[] {
    return this.state.habits.filter((h) => !h.hidden);
  }

  getAllHabits(authToken?: string): Habit[] {
    if (!authToken) return this.getVisibleHabits();
    return this.state.habits.map(h => ({ ...h }));
  }

  getState(): GhostRhythmState {
    return { ...this.state, habits: [...this.state.habits] };
  }

  async destroy(): Promise<void> {
    /* no-op */
  }

  private emit(type: string, data: unknown): void {
    if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (...args: unknown[]) => void)({
          type,
          data,
          source: 'ghost-rhythm',
        });
      }
    }
  }
}

export function createGhostRhythmModule(bus?: unknown): GhostRhythm {
  return new GhostRhythm(bus);
}
