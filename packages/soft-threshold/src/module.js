/**
 * SoftThreshold — Stress Boundary + Affiliate Suppression (Emotional)
 * Module definition and class implementation.
 */
/** Module metadata for the SoftThreshold emotional module */
export const soft_threshold_module = {
    id: 'soft-threshold',
    name: 'SoftThreshold',
    category: 'emotional',
    version: '0.1.0',
    permissions: ['telemetry:read', 'events:emit'],
    description: 'Stress boundary detection with affiliate offer suppression',
};
/**
 * Detects when stress levels breach a configurable threshold and
 * suppresses affiliate offers for a cooldown period when breached.
 * Emits events via the event bus for threshold breaches and affiliate actions.
 */
export class SoftThreshold {
    state = {
        active: false,
        threshold: 0.75,
        currentStress: 0,
        suppressed: false,
        lastWarningAt: null,
    };
    _bus;
    _suppressionTimer = null;
    constructor(bus) {
        this._bus = bus;
    }
    /** Initialize the module — no-op for SoftThreshold */
    async init() {
        /* no-op */
    }
    /**
     * Check whether the given stress level breaches the threshold.
     * If breached, activates suppression and emits events.
     */
    checkBoundary(stress) {
        this.state.currentStress = stress;
        if (stress > this.state.threshold) {
            this.state.active = true;
            this.state.lastWarningAt = Date.now();
            this.suppressAffiliate();
            this.emit('soft-threshold:breached', {
                stress,
                threshold: this.state.threshold,
            });
        }
        else {
            this.state.active = false;
        }
    }
    /**
     * Activate affiliate suppression for 120 seconds.
     * Emits 'affiliate:suppress' immediately and 'affiliate:release' after cooldown.
     */
    suppressAffiliate() {
        this.state.suppressed = true;
        this.emit('affiliate:suppress', {
            reason: 'stress-threshold',
            duration: 120000,
        });
        if (this._suppressionTimer) {
            clearTimeout(this._suppressionTimer);
        }
        this._suppressionTimer = setTimeout(() => {
            this.state.suppressed = false;
            this.emit('affiliate:release', {});
        }, 120000);
    }
    /**
     * Set the stress threshold, clamped to [0.1, 1.0].
     */
    setThreshold(t) {
        this.state.threshold = Math.max(0.1, Math.min(1.0, t));
    }
    /** Return a cloned snapshot of current state */
    getState() {
        return { ...this.state };
    }
    /** Destroy the module, clearing any active suppression timer */
    async destroy() {
        if (this._suppressionTimer) {
            clearTimeout(this._suppressionTimer);
        }
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
                    source: 'soft-threshold',
                });
            }
        }
    }
}
/** Factory function to create a SoftThreshold module instance */
export function createSoftThresholdModule(bus) {
    return new SoftThreshold(bus);
}
//# sourceMappingURL=module.js.map