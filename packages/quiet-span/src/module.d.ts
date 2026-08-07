/**
 * QuietSpan — Focus Session Manager (Productivity)
 * Module definition and class implementation.
 */
import type { FocusSession, QuietSpanState } from './types.js';
/** Module metadata for the QuietSpan productivity module */
export declare const quiet_span_module: {
    id: string;
    name: string;
    category: 'productivity';
    version: string;
    permissions: readonly ['timer', 'focus', 'storage:write'];
    description: string;
};
/**
 * Manages timed focus sessions with emotional context tracking.
 * Provides lifecycle methods (init/getState/destroy) for the Jason-OS module system.
 */
export declare class QuietSpan {
    private state;
    private _bus;
    constructor(bus?: unknown);
    /** Initialize the module — no-op for QuietSpan */
    init(): Promise<void>;
    /**
     * Start a new focus session.
     * @throws {Error} If a session is already active
     */
    startSession(durationMin: number, tag?: string): FocusSession;
    /**
     * End the currently active session.
     * @throws {Error} If no session is active
     */
    endSession(notes?: string): FocusSession;
    /** Mark that a break was taken during the active session */
    markBreakTaken(): void;
    /** Get elapsed minutes for the active session */
    getActiveMinutes(): number;
    /** Capture emotional state at session start */
    captureEmotionAtStart(emotion: {
        valence: number;
        stress: number;
    }): void;
    /** Capture emotional state at session end */
    captureEmotionAtEnd(emotion: {
        valence: number;
        stress: number;
    }): void;
    /** Compute emotional shift between start and end */
    getEmotionShift(): {
        valenceDelta: number;
        stressDelta: number;
    } | null;
    /** Return a deep-cloned snapshot of current state */
    getState(): QuietSpanState;
    /** Destroy the module — no-op for QuietSpan */
    destroy(): Promise<void>;
    /** Recalculate focusScore from completed sessions */
    private updateFocusScore;
}
/** Factory function to create a QuietSpan module instance */
export declare function createQuietSpanModule(bus?: unknown): QuietSpan;
//# sourceMappingURL=module.d.ts.map