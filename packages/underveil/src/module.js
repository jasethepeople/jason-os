export const underveil_module = {
    id: 'underveil',
    name: 'Underveil',
    category: 'communication',
    version: '0.1.0',
    permissions: ['identity:read', 'storage:write'],
    description: 'Consent-based communication veils for identity protection',
};
export class Underveil {
    state = {
        veils: [],
        consentGiven: false,
        consentTimestamp: null,
        activeVeilId: null,
    };
    _bus;
    constructor(bus) {
        this._bus = bus;
    }
    async init() {
        /* no-op */
    }
    giveConsent() {
        this.state.consentGiven = true;
        this.state.consentTimestamp = Date.now();
        this.emit('underveil:consent-given', {});
    }
    revokeConsent() {
        this.state.consentGiven = false;
        this.state.consentTimestamp = null;
        this.state.activeVeilId = null;
        this.emit('underveil:consent-revoked', {});
    }
    createVeil(label) {
        const veil = {
            id: `veil-${Date.now()}`,
            label,
            active: false,
            createdAt: Date.now(),
        };
        this.state.veils.push(veil);
        return veil;
    }
    activateVeil(id) {
        if (!this.state.consentGiven) {
            throw new Error('Consent required before activating veil');
        }
        this.state.veils.forEach((v) => {
            v.active = v.id === id;
        });
        this.state.activeVeilId = id;
    }
    getActiveVeil() {
        return this.state.veils.find((v) => v.id === this.state.activeVeilId) ?? null;
    }
    getState() {
        return { ...this.state, veils: [...this.state.veils] };
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
                    source: 'underveil',
                });
            }
        }
    }
}
export function createUnderveilModule(bus) {
    return new Underveil(bus);
}
//# sourceMappingURL=module.js.map