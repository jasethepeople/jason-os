export const echo_silence_module = {
    id: 'echo-silence',
    name: 'EchoSilence',
    category: 'emotional',
    version: '0.1.0',
    permissions: ['timer', 'audio', 'telemetry:read'],
    description: 'Meditation and silence companion with personalized quiet spaces',
};
export class EchoSilence {
    state = {
        active: false,
        sessionDurationSec: 0,
        breathCount: 0,
        ambientLevel: 'silent',
        streakDays: 0,
        lastSessionAt: null,
    };
    _bus;
    _timer = null;
    constructor(bus) {
        this._bus = bus;
    }
    async init() {
        /* no-op */
    }
    startSession(ambientLevel = 'silent') {
        this.state.active = true;
        this.state.ambientLevel = ambientLevel;
        this.state.sessionDurationSec = 0;
        this.state.breathCount = 0;
        this._timer = setInterval(() => {
            this.state.sessionDurationSec++;
        }, 1000);
        this.emit('echo-silence:session-started', { ambientLevel });
    }
    recordBreath() {
        this.state.breathCount++;
    }
    endSession() {
        if (this._timer)
            clearInterval(this._timer);
        this.state.active = false;
        this.state.lastSessionAt = Date.now();
        this.updateStreak();
        this.emit('echo-silence:session-ended', {
            duration: this.state.sessionDurationSec,
            breaths: this.state.breathCount,
        });
    }
    updateStreak() {
        const now = Date.now();
        const dayMs = 86400000;
        if (this.state.lastSessionAt && now - this.state.lastSessionAt < dayMs * 2) {
            this.state.streakDays++;
        }
        else {
            this.state.streakDays = 1;
        }
    }
    getState() {
        return { ...this.state };
    }
    async destroy() {
        if (this._timer)
            clearInterval(this._timer);
    }
    emit(type, data) {
        if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
            const b = this._bus;
            if (b.emit && typeof b.emit === 'function') {
                b.emit({
                    type,
                    data,
                    source: 'echo-silence',
                });
            }
        }
    }
}
export function createEchoSilenceModule(bus) {
    return new EchoSilence(bus);
}
//# sourceMappingURL=module.js.map