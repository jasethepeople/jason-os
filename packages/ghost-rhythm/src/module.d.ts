import type { Habit, GhostRhythmState } from './types.js';
export declare const ghost_rhythm_module: {
    id: string;
    name: string;
    category: 'privacy';
    version: string;
    permissions: readonly ['storage:write', 'telemetry:read'];
    description: string;
};
export declare class GhostRhythm {
    private state;
    private _bus;
    constructor(bus?: unknown);
    init(): Promise<void>;
    createHabit(name: string, category: string, hidden?: boolean): Habit;
    complete(id: string): void;
    getVisibleHabits(): Habit[];
    getAllHabits(authToken?: string): Habit[];
    getState(): GhostRhythmState;
    destroy(): Promise<void>;
    private emit;
}
export declare function createGhostRhythmModule(bus?: unknown): GhostRhythm;
//# sourceMappingURL=module.d.ts.map