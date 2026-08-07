export const drift_cell_module = {
    id: 'drift-cell',
    name: 'DriftCell',
    category: 'emotional',
    version: '0.1.0',
    permissions: ['telemetry:read', 'storage:write', 'events:emit'],
    description: 'Detects emotional drift and offers grounding interventions',
};
export class DriftCell {
    state = {
        drifting: false,
        driftScore: 0,
        lastDriftAt: null,
        driftDirection: null,
        interventionsOffered: 0,
    };
    config = { threshold: 0.65, gentleMode: true };
    _bus;
    constructor(bus, config) {
        this._bus = bus;
        if (config)
            this.config = { ...this.config, ...config };
    }
    async init() {
        if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
            const b = this._bus;
            if (b.on && typeof b.on === 'function') {
                b.on('telemetry:update', (e) => {
                    const ev = e;
                    if (ev.data && ev.data.valence !== undefined && ev.data.focus !== undefined) {
                        this.process(ev.data);
                    }
                });
                b.on('emotional:drift', (e) => {
                    const ev = e;
                    if (ev.data)
                        this.handleDrift(ev.data);
                });
            }
        }
    }
    process(telemetry) {
        // Drift detection: low focus + high arousal variance
        const driftScore = (1 - telemetry.focus) * 0.6 + Math.abs(telemetry.valence) * 0.4;
        this.state.driftScore = driftScore;
        if (driftScore > this.config.threshold) {
            this.state.drifting = true;
            this.state.lastDriftAt = Date.now();
            this.state.driftDirection =
                telemetry.valence < -0.3
                    ? 'past'
                    : telemetry.valence > 0.3
                        ? 'future'
                        : 'dissociation';
            this.emit('drift-cell:drift-detected', { ...this.state });
        }
        else {
            this.state.drifting = false;
        }
    }
    handleDrift(data) {
        if (data && typeof data === 'object') {
            const d = data;
            if (d.valence !== undefined && d.arousal !== undefined && d.focus !== undefined) {
                this.process(d);
            }
        }
    }
    offerGrounding() {
        this.state.interventionsOffered++;
        const techniques = [
            {
                technique: '5-4-3-2-1',
                prompt: 'Name 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste.',
            },
            {
                technique: 'soft-anchor',
                prompt: 'Place both feet on the floor. Feel the weight. You are here.',
            },
            {
                technique: 'breath-box',
                prompt: 'Inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat gently.',
            },
            {
                technique: 'body-scan',
                prompt: 'Starting at your toes, slowly move attention up through your body.',
            },
        ];
        return techniques[Math.floor(Math.random() * techniques.length)];
    }
    getState() {
        return { ...this.state };
    }
    async destroy() {
        this.state.drifting = false;
    }
    emit(type, data) {
        if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
            const b = this._bus;
            if (b.emit && typeof b.emit === 'function') {
                b.emit({
                    type,
                    data,
                    source: 'drift-cell',
                });
            }
        }
    }
}
export function createDriftCellModule(bus, config) {
    return new DriftCell(bus, config);
}
//# sourceMappingURL=module.js.map