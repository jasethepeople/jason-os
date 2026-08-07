export const ghost_rhythm_module = {
    id: 'ghost-rhythm',
    name: 'GhostRhythm',
    category: 'privacy',
    version: '0.1.0',
    permissions: ['storage:write', 'telemetry:read'],
    description: 'Privacy-protected habit tracker with stealth logging',
};
export class GhostRhythm {
    state = {
        habits: [],
        totalCompletions: 0,
        hiddenFromUI: true,
    };
    _bus;
    constructor(bus) {
        this._bus = bus;
    }
    async init() {
        /* no-op */
    }
    createHabit(name, category, hidden = true) {
        const habit = {
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
    complete(id) {
        const habit = this.state.habits.find((h) => h.id === id);
        if (!habit)
            return;
        const dayMs = 86400000;
        if (habit.lastCompletedAt && Date.now() - habit.lastCompletedAt < dayMs * 2) {
            habit.streak++;
        }
        else {
            habit.streak = 1;
        }
        habit.lastCompletedAt = Date.now();
        this.state.totalCompletions++;
        this.emit('ghost-rhythm:completed', { habitId: id, streak: habit.streak });
    }
    getVisibleHabits() {
        return this.state.habits.filter((h) => !h.hidden);
    }
    getAllHabits(authToken) {
        if (!authToken)
            return this.getVisibleHabits();
        return [...this.state.habits];
    }
    getState() {
        return { ...this.state, habits: [...this.state.habits] };
    }
    async destroy() {
        /* no-op */
    }
    emit(type, data) {
        if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
            const b = this._bus;
            if (b.emit && typeof b.emit === 'function') {
                b.emit({
                    type,
                    data,
                    source: 'ghost-rhythm',
                });
            }
        }
    }
}
export function createGhostRhythmModule(bus) {
    return new GhostRhythm(bus);
}
//# sourceMappingURL=module.js.map