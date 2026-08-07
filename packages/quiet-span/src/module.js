/**
 * QuietSpan — Focus Session Manager (Productivity)
 * Module definition and class implementation.
 */
/** Module metadata for the QuietSpan productivity module */
export const quiet_span_module = {
    id: 'quiet-span',
    name: 'QuietSpan',
    category: 'productivity',
    version: '0.1.0',
    permissions: ['timer', 'focus', 'storage:write'],
    description: 'Timed focus sessions with emotional context tracking',
};
/**
 * Manages timed focus sessions with emotional context tracking.
 * Provides lifecycle methods (init/getState/destroy) for the Jason-OS module system.
 */
export class QuietSpan {
    state = {
        sessions: [],
        activeSession: null,
        focusScore: 0,
        emotionAtStart: null,
        emotionAtEnd: null,
    };
    _bus;
    constructor(bus) {
        this._bus = bus;
        void this._bus;
    }
    /** Initialize the module — no-op for QuietSpan */
    async init() {
        /* no-op */
    }
    /**
     * Start a new focus session.
     * @throws {Error} If a session is already active
     */
    startSession(durationMin, tag) {
        if (this.state.activeSession) {
            throw new Error('Session already active');
        }
        const session = {
            id: `qs-${Date.now()}`,
            startedAt: Date.now(),
            endedAt: null,
            durationMin,
            breakTaken: false,
            notes: '',
            tag: tag ?? 'default',
        };
        this.state.activeSession = session;
        return session;
    }
    /**
     * End the currently active session.
     * @throws {Error} If no session is active
     */
    endSession(notes) {
        if (!this.state.activeSession) {
            throw new Error('No active session');
        }
        this.state.activeSession.endedAt = Date.now();
        this.state.activeSession.notes = notes ?? '';
        this.state.sessions.push(this.state.activeSession);
        const result = this.state.activeSession;
        this.state.activeSession = null;
        this.updateFocusScore();
        return result;
    }
    /** Mark that a break was taken during the active session */
    markBreakTaken() {
        if (this.state.activeSession) {
            this.state.activeSession.breakTaken = true;
        }
    }
    /** Get elapsed minutes for the active session */
    getActiveMinutes() {
        if (!this.state.activeSession)
            return 0;
        return Math.floor((Date.now() - this.state.activeSession.startedAt) / 60000);
    }
    /** Capture emotional state at session start */
    captureEmotionAtStart(emotion) {
        this.state.emotionAtStart = emotion;
    }
    /** Capture emotional state at session end */
    captureEmotionAtEnd(emotion) {
        this.state.emotionAtEnd = emotion;
    }
    /** Compute emotional shift between start and end */
    getEmotionShift() {
        if (!this.state.emotionAtStart || !this.state.emotionAtEnd)
            return null;
        return {
            valenceDelta: this.state.emotionAtEnd.valence - this.state.emotionAtStart.valence,
            stressDelta: this.state.emotionAtEnd.stress - this.state.emotionAtStart.stress,
        };
    }
    /** Return a deep-cloned snapshot of current state */
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }
    /** Destroy the module — no-op for QuietSpan */
    async destroy() {
        /* no-op */
    }
    /** Recalculate focusScore from completed sessions */
    updateFocusScore() {
        const completed = this.state.sessions.filter((s) => s.endedAt !== null);
        const totalDuration = completed.reduce((sum, s) => {
            const end = s.endedAt ?? Date.now();
            return sum + (end - s.startedAt);
        }, 0);
        const avgDuration = completed.length > 0 ? totalDuration / completed.length : 0;
        this.state.focusScore = Math.min(completed.length * 10 + Math.floor(avgDuration / 60000), 100);
    }
}
/** Factory function to create a QuietSpan module instance */
export function createQuietSpanModule(bus) {
    return new QuietSpan(bus);
}
//# sourceMappingURL=module.js.map