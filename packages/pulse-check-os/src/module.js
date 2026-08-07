// ============================================================
// PulseCheckOS Module — Emotional Vitals Dashboard
// Compute overall status from VAD+stress, track history,
// detect trend direction, generate alerts for critical states.
// ============================================================
// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------
export const pulse_check_os_module = {
    id: 'pulse-check-os',
    name: 'PulseCheckOS',
    category: 'emotional',
    version: '0.1.0',
    permissions: ['telemetry:read', 'events:emit', 'history:write'],
    description: 'Emotional vitals dashboard — VAD+stress monitoring with trend detection and alerts',
};
// ------------------------------------------------------------------
// PulseCheckOS Implementation
// ------------------------------------------------------------------
export class PulseCheckOS {
    state = {
        current: null,
        history: [],
        trendDirection: 'stable',
        alerts: [],
    };
    _bus;
    _maxHistory;
    _enableTrendDetection;
    _enableAlerts;
    constructor(bus, options) {
        this._bus = bus;
        void this._bus;
        this._maxHistory = options?.maxHistory ?? 100;
        this._enableTrendDetection = options?.enableTrendDetection ?? true;
        this._enableAlerts = options?.enableAlerts ?? true;
    }
    async init() {
        return Promise.resolve();
    }
    // ----------------------------------------------------------------
    // Vital Signs Processing
    // ----------------------------------------------------------------
    /**
     * Process a new emotion input, compute vital signs, update state.
     * @param emotion - Raw emotion input with VAD+stress values
     * @returns Computed vital signs
     */
    checkVitals(emotion) {
        const overall = this.computeOverall(emotion);
        const vitals = {
            valence: this.clamp(emotion.valence, -1, 1),
            arousal: this.clamp(emotion.arousal, 0, 1),
            dominance: this.clamp(emotion.dominance, 0, 1),
            stress: this.clamp(emotion.stress, 0, 1),
            timestamp: Date.now(),
            overall,
        };
        this.state.current = vitals;
        this.state.history.push(vitals);
        // Trim history to max size
        if (this.state.history.length > this._maxHistory) {
            this.state.history = this.state.history.slice(-this._maxHistory);
        }
        if (this._enableTrendDetection) {
            this.state.trendDirection = this.detectTrend();
        }
        if (this._enableAlerts) {
            this.state.alerts = this.getAlerts();
        }
        return { ...vitals };
    }
    // ----------------------------------------------------------------
    // Overall Status Computation
    // ----------------------------------------------------------------
    /**
     * Compute overall status from emotion input.
     * Mapping: stress<0.3 + valence>0.3 = thriving,
     *          stress<0.6 = stable,
     *          stress<0.8 = declining,
     *          else critical.
     * @param emotion - Emotion input with stress and valence
     * @returns Overall status category
     */
    computeOverall(emotion) {
        const stress = this.clamp(emotion.stress, 0, 1);
        const valence = this.clamp(emotion.valence, -1, 1);
        if (stress < 0.3 && valence > 0.3)
            return 'thriving';
        if (stress < 0.6)
            return 'stable';
        if (stress < 0.8)
            return 'declining';
        return 'critical';
    }
    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }
    // ----------------------------------------------------------------
    // Trend Detection
    // ----------------------------------------------------------------
    /**
     * Detect trend direction from history.
     * Compares recent stress values to earlier ones.
     * @returns Trend direction: improving, stable, or worsening
     */
    detectTrend() {
        if (this.state.history.length < 3)
            return 'stable';
        // Use last N entries for trend detection
        const windowSize = Math.min(this.state.history.length, 10);
        const recent = this.state.history.slice(-windowSize);
        // Compare first half vs second half average stress
        const half = Math.floor(recent.length / 2);
        const firstHalfAvg = recent.slice(0, half).reduce((sum, v) => sum + v.stress, 0) / half;
        const secondHalfAvg = recent.slice(half).reduce((sum, v) => sum + v.stress, 0) /
            (recent.length - half);
        const threshold = 0.05;
        if (secondHalfAvg < firstHalfAvg - threshold)
            return 'improving';
        if (secondHalfAvg > firstHalfAvg + threshold)
            return 'worsening';
        return 'stable';
    }
    // ----------------------------------------------------------------
    // Alert Generation
    // ----------------------------------------------------------------
    /**
     * Generate alerts based on current and recent vital signs.
     * @returns Array of alert messages
     */
    getAlerts() {
        const alerts = [];
        if (!this.state.current)
            return alerts;
        const current = this.state.current;
        if (current.overall === 'critical') {
            alerts.push('CRITICAL: Stress levels are dangerously high. Immediate intervention recommended.');
        }
        else if (current.overall === 'declining') {
            alerts.push('WARNING: Stress levels are elevated. Consider using calm-switch or echo-silence.');
        }
        if (current.valence < -0.5) {
            alerts.push('LOW_VALENCE: Negative emotional state detected. Self-care recommended.');
        }
        if (current.dominance < 0.2) {
            alerts.push('LOW_DOMINANCE: Feeling out of control. Grounding exercises may help.');
        }
        // Trend-based alerts
        if (this.state.trendDirection === 'worsening' && this.state.history.length >= 5) {
            alerts.push('TREND: Stress trend is worsening over the last several readings.');
        }
        return alerts;
    }
    // ----------------------------------------------------------------
    // Getters
    // ----------------------------------------------------------------
    /**
     * Get the current vital signs, or null.
     * @returns Current vital signs copy
     */
    getCurrentVitals() {
        return this.state.current ? { ...this.state.current } : null;
    }
    /**
     * Get the full vital signs history.
     * @returns Array of vital signs copies
     */
    getHistory() {
        return this.state.history.map((v) => ({ ...v }));
    }
    /**
     * Get the current trend direction.
     * @returns Current trend
     */
    getTrendDirection() {
        return this.state.trendDirection;
    }
    /**
     * Get the number of history entries.
     * @returns History count
     */
    getHistoryCount() {
        return this.state.history.length;
    }
    /**
     * Get the full current state.
     * @returns Deep-cloned state snapshot
     */
    getState() {
        return {
            current: this.state.current ? { ...this.state.current } : null,
            history: this.state.history.map((v) => ({ ...v })),
            trendDirection: this.state.trendDirection,
            alerts: [...this.state.alerts],
        };
    }
    // ----------------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------------
    async destroy() {
        this.state = {
            current: null,
            history: [],
            trendDirection: 'stable',
            alerts: [],
        };
        this._bus = undefined;
        return Promise.resolve();
    }
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
export function createPulseCheckOSModule(bus, options) {
    return new PulseCheckOS(bus, options);
}
//# sourceMappingURL=module.js.map