/**
 * SoftAnchor — Emotional Re-anchoring (Emotional)
 * Module definition and class implementation.
 */
/** Module metadata for the SoftAnchor emotional module */
export const soft_anchor_module = {
    id: 'soft-anchor',
    name: 'SoftAnchor',
    category: 'emotional',
    version: '0.1.0',
    permissions: ['telemetry:read', 'storage:write'],
    description: 'Emotional re-anchoring system on stress spikes',
};
/**
 * Provides emotional re-anchoring when stress spikes are detected.
 * Emits events via the event bus when re-anchoring occurs.
 */
export class SoftAnchor {
    state = {
        stable: true,
        trigger: null,
        reanchoredAt: null,
        anchorCount: 0,
    };
    _bus;
    constructor(bus) {
        this._bus = bus;
    }
    /** Initialize the module — no-op for SoftAnchor */
    async init() {
        /* no-op */
    }
    /**
     * Perform a re-anchor operation, resetting stability and recording the trigger.
     * Emits a 'soft-anchor:reanchored' event on the event bus.
     */
    reanchor(trigger) {
        this.state.stable = true;
        this.state.trigger = trigger;
        this.state.reanchoredAt = Date.now();
        this.state.anchorCount++;
        this.emit('soft-anchor:reanchored', { trigger });
    }
    /** Return a shallow-cloned snapshot of current state */
    getState() {
        return { ...this.state };
    }
    /** Destroy the module — no-op for SoftAnchor */
    async destroy() {
        /* no-op */
    }
    /** Emit an event to the event bus, if available */
    emit(type, data) {
        if (this._bus &&
            typeof this._bus === 'object' &&
            this._bus !== null) {
            const b = this._bus;
            if (b.emit && typeof b.emit === 'function') {
                b.emit({
                    type,
                    data,
                    source: 'soft-anchor',
                });
            }
        }
    }
}
/** Factory function to create a SoftAnchor module instance */
export function createSoftAnchorModule(bus) {
    return new SoftAnchor(bus);
}
//# sourceMappingURL=module.js.map