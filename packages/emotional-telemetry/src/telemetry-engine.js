// ============================================================
// Emotional Telemetry Engine — VAD+Stress Model
// Real-time emotional state capture for Jason-OS
// ============================================================
// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const MAX_SAMPLES = 10_000;
const STRESS_SPIKE_THRESHOLD = 0.6;
const STRESS_BASELINE_MULTIPLIER = 2.0;
const DRIFT_THRESHOLD_MILD = 0.15;
const DRIFT_THRESHOLD_MODERATE = 0.3;
const DRIFT_THRESHOLD_SEVERE = 0.5;
const BASELINE_LEARNING_RATE = 0.05;
const CONFIDENCE_MAX_SAMPLES = 100;
// ------------------------------------------------------------------
// Ring Buffer Implementation
// ------------------------------------------------------------------
class RingBuffer {
    _buffer;
    _size;
    _count;
    _head;
    constructor(capacity) {
        this._buffer = new Array(capacity);
        this._size = capacity;
        this._count = 0;
        this._head = 0;
    }
    push(item) {
        this._buffer[this._head] = item;
        this._head = (this._head + 1) % this._size;
        if (this._count < this._size) {
            this._count++;
        }
    }
    getAll() {
        if (this._count === 0)
            return [];
        const result = new Array(this._count);
        for (let i = 0; i < this._count; i++) {
            const idx = (this._head - this._count + i + this._size) % this._size;
            result[i] = this._buffer[idx];
        }
        return result;
    }
    clear() {
        this._count = 0;
        this._head = 0;
    }
    get length() {
        return this._count;
    }
    get capacity() {
        return this._size;
    }
    latest() {
        if (this._count === 0)
            return undefined;
        return this._buffer[(this._head - 1 + this._size) % this._size];
    }
}
// ------------------------------------------------------------------
// Utility Functions
// ------------------------------------------------------------------
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function computeAverage(samples) {
    if (samples.length === 0) {
        return {
            valence: 0,
            arousal: 0,
            dominance: 0,
            stress: 0,
            timestamp: Date.now(),
            confidence: 0,
        };
    }
    const sum = samples.reduce((acc, s) => ({
        valence: acc.valence + s.valence,
        arousal: acc.arousal + s.arousal,
        dominance: acc.dominance + s.dominance,
        stress: acc.stress + s.stress,
    }), { valence: 0, arousal: 0, dominance: 0, stress: 0 });
    const count = samples.length;
    const confidence = clamp(count / CONFIDENCE_MAX_SAMPLES, 0, 1);
    return {
        valence: sum.valence / count,
        arousal: sum.arousal / count,
        dominance: sum.dominance / count,
        stress: sum.stress / count,
        timestamp: samples[samples.length - 1].timestamp ?? Date.now(),
        confidence,
    };
}
function computeMin(samples) {
    if (samples.length === 0) {
        return {
            valence: 0,
            arousal: 0,
            dominance: 0,
            stress: 0,
            timestamp: Date.now(),
            confidence: 0,
        };
    }
    const confidence = clamp(samples.length / CONFIDENCE_MAX_SAMPLES, 0, 1);
    return {
        valence: Math.min(...samples.map((s) => s.valence)),
        arousal: Math.min(...samples.map((s) => s.arousal)),
        dominance: Math.min(...samples.map((s) => s.dominance)),
        stress: Math.min(...samples.map((s) => s.stress)),
        timestamp: samples[samples.length - 1].timestamp ?? Date.now(),
        confidence,
    };
}
function computeMax(samples) {
    if (samples.length === 0) {
        return {
            valence: 0,
            arousal: 0,
            dominance: 0,
            stress: 0,
            timestamp: Date.now(),
            confidence: 0,
        };
    }
    const confidence = clamp(samples.length / CONFIDENCE_MAX_SAMPLES, 0, 1);
    return {
        valence: Math.max(...samples.map((s) => s.valence)),
        arousal: Math.max(...samples.map((s) => s.arousal)),
        dominance: Math.max(...samples.map((s) => s.dominance)),
        stress: Math.max(...samples.map((s) => s.stress)),
        timestamp: samples[samples.length - 1].timestamp ?? Date.now(),
        confidence,
    };
}
function computeTrend(samples) {
    if (samples.length < 2)
        return 'stable';
    // Split samples into first half and second half
    const mid = Math.floor(samples.length / 2);
    const firstHalf = samples.slice(0, mid);
    const secondHalf = samples.slice(mid);
    if (firstHalf.length === 0 || secondHalf.length === 0)
        return 'stable';
    const firstAvg = computeAverage(firstHalf);
    const secondAvg = computeAverage(secondHalf);
    // Trend is based on valence improvement and stress reduction
    // Improving = higher valence + lower stress
    const valenceDelta = secondAvg.valence - firstAvg.valence;
    const stressDelta = firstAvg.stress - secondAvg.stress; // reversed: lower stress is better
    const compositeScore = valenceDelta + stressDelta * 0.5;
    if (compositeScore > 0.05)
        return 'improving';
    if (compositeScore < -0.05)
        return 'declining';
    return 'stable';
}
function countStressIncidents(samples) {
    let incidents = 0;
    for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1];
        const curr = samples[i];
        // A stress incident is a significant jump in stress
        if (curr.stress - prev.stress > 0.3 && curr.stress > STRESS_SPIKE_THRESHOLD) {
            incidents++;
        }
    }
    return incidents;
}
// ------------------------------------------------------------------
// Emotional Telemetry Engine Implementation
// ------------------------------------------------------------------
export class EmotionalTelemetryEngineImpl {
    _samples;
    _baseline;
    _currentState;
    _reports;
    _stressHandlers;
    _driftHandlers;
    _privacyMode;
    _driftStartTime;
    _lastDriftDimension;
    _stressHistory;
    constructor() {
        this._samples = new RingBuffer(MAX_SAMPLES);
        this._baseline = this._createNeutralBaseline();
        this._currentState = {
            valence: 0,
            arousal: 0,
            dominance: 0,
            stress: 0,
            timestamp: Date.now(),
            confidence: 0,
        };
        this._reports = new Map();
        this._stressHandlers = [];
        this._driftHandlers = [];
        this._privacyMode = 'full';
        this._driftStartTime = null;
        this._lastDriftDimension = null;
        this._stressHistory = new RingBuffer(10);
    }
    _createNeutralBaseline() {
        return {
            valence: 0,
            arousal: 0.5,
            dominance: 0.5,
            stress: 0.2,
            sampleCount: 0,
        };
    }
    // ----------------------------------------------------------------
    // Real-time Capture
    // ----------------------------------------------------------------
    captureSample(sample) {
        const timestamp = sample.timestamp ?? Date.now();
        const normalized = {
            valence: clamp(sample.valence, -1, 1),
            arousal: clamp(sample.arousal, 0, 1),
            dominance: clamp(sample.dominance, 0, 1),
            stress: clamp(sample.stress, 0, 1),
            timestamp,
            source: sample.source,
        };
        this._samples.push(normalized);
        this._stressHistory.push(normalized.stress);
        // Update rolling average (current state)
        const allSamples = this._samples.getAll();
        this._currentState = computeAverage(allSamples);
        this._currentState.timestamp = timestamp;
        // Update baseline with learning
        this._updateBaseline(normalized);
        // Check for stress spike
        if (this._checkStressSpike(normalized)) {
            const level = normalized.stress;
            this._stressHandlers.forEach((h) => h(level));
        }
        // Check for emotional drift
        const drift = this._checkDrift(timestamp);
        if (drift) {
            this._driftHandlers.forEach((h) => h(drift));
        }
    }
    getCurrentState() {
        return { ...this._currentState };
    }
    getBaseline() {
        return { ...this._baseline };
    }
    setBaseline(baseline) {
        this._baseline = {
            valence: clamp(baseline.valence, -1, 1),
            arousal: clamp(baseline.arousal, 0, 1),
            dominance: clamp(baseline.dominance, 0, 1),
            stress: clamp(baseline.stress, 0, 1),
            sampleCount: Math.max(0, baseline.sampleCount),
        };
    }
    // ----------------------------------------------------------------
    // Baseline Learning
    // ----------------------------------------------------------------
    _updateBaseline(sample) {
        const lr = BASELINE_LEARNING_RATE;
        this._baseline = {
            valence: this._baseline.valence + lr * (sample.valence - this._baseline.valence),
            arousal: this._baseline.arousal + lr * (sample.arousal - this._baseline.arousal),
            dominance: this._baseline.dominance + lr * (sample.dominance - this._baseline.dominance),
            stress: this._baseline.stress + lr * (sample.stress - this._baseline.stress),
            sampleCount: this._baseline.sampleCount + 1,
        };
    }
    // ----------------------------------------------------------------
    // Stress Detection
    // ----------------------------------------------------------------
    _checkStressSpike(sample) {
        const aboveThreshold = sample.stress > STRESS_SPIKE_THRESHOLD;
        const aboveBaseline = sample.stress > this._baseline.stress * STRESS_BASELINE_MULTIPLIER;
        return aboveThreshold && aboveBaseline;
    }
    detectStressSpike() {
        const latest = this._samples.latest();
        if (!latest)
            return false;
        return this._checkStressSpike(latest);
    }
    getStressLevel() {
        return this._currentState.stress;
    }
    onStressSpike(handler) {
        this._stressHandlers.push(handler);
        return () => {
            const idx = this._stressHandlers.indexOf(handler);
            if (idx !== -1) {
                this._stressHandlers.splice(idx, 1);
            }
        };
    }
    // ----------------------------------------------------------------
    // Drift Detection
    // ----------------------------------------------------------------
    _checkDrift(timestamp) {
        const state = this._currentState;
        const baseline = this._baseline;
        const dimensions = [
            { name: 'valence', value: state.valence, base: baseline.valence },
            { name: 'arousal', value: state.arousal, base: baseline.arousal },
            { name: 'dominance', value: state.dominance, base: baseline.dominance },
            { name: 'stress', value: state.stress, base: baseline.stress },
        ];
        let maxDrift = null;
        let maxMagnitude = 0;
        for (const dim of dimensions) {
            const diff = dim.value - dim.base;
            const magnitude = Math.abs(diff);
            if (magnitude >= DRIFT_THRESHOLD_MILD) {
                if (magnitude > maxMagnitude) {
                    maxMagnitude = magnitude;
                    let severity;
                    if (magnitude >= DRIFT_THRESHOLD_SEVERE) {
                        severity = 'severe';
                    }
                    else if (magnitude >= DRIFT_THRESHOLD_MODERATE) {
                        severity = 'moderate';
                    }
                    else {
                        severity = 'mild';
                    }
                    // Track drift duration
                    const driftKey = `${dim.name}_${diff > 0 ? 'inc' : 'dec'}`;
                    if (this._lastDriftDimension !== driftKey) {
                        this._driftStartTime = timestamp;
                        this._lastDriftDimension = driftKey;
                    }
                    maxDrift = {
                        dimension: dim.name,
                        direction: diff > 0 ? 'increasing' : 'decreasing',
                        magnitude,
                        severity,
                        durationMs: this._driftStartTime ? timestamp - this._driftStartTime : 0,
                    };
                }
            }
        }
        if (!maxDrift) {
            this._driftStartTime = null;
            this._lastDriftDimension = null;
        }
        return maxDrift;
    }
    detectEmotionalDrift() {
        const latest = this._samples.latest();
        if (!latest)
            return null;
        return this._checkDrift(latest.timestamp ?? Date.now());
    }
    onDrift(handler) {
        this._driftHandlers.push(handler);
        return () => {
            const idx = this._driftHandlers.indexOf(handler);
            if (idx !== -1) {
                this._driftHandlers.splice(idx, 1);
            }
        };
    }
    // ----------------------------------------------------------------
    // Aggregation / Reports
    // ----------------------------------------------------------------
    getHourlyReport() {
        return this._generateReport('hourly', 60 * 60 * 1000);
    }
    getDailyReport() {
        return this._generateReport('daily', 24 * 60 * 60 * 1000);
    }
    getWeeklyReport() {
        return this._generateReport('weekly', 7 * 24 * 60 * 60 * 1000);
    }
    _generateReport(period, windowMs) {
        const now = Date.now();
        const cutoff = now - windowMs;
        const allSamples = this._samples.getAll();
        const periodSamples = allSamples.filter((s) => (s.timestamp ?? 0) >= cutoff);
        if (periodSamples.length === 0) {
            const emptyState = {
                valence: 0,
                arousal: 0,
                dominance: 0,
                stress: 0,
                timestamp: now,
                confidence: 0,
            };
            return {
                period,
                startTime: cutoff,
                endTime: now,
                average: emptyState,
                minimum: emptyState,
                maximum: emptyState,
                trend: 'stable',
                stressIncidents: 0,
                sampleCount: 0,
            };
        }
        const report = {
            period,
            startTime: periodSamples[0].timestamp ?? cutoff,
            endTime: periodSamples[periodSamples.length - 1].timestamp ?? now,
            average: computeAverage(periodSamples),
            minimum: computeMin(periodSamples),
            maximum: computeMax(periodSamples),
            trend: computeTrend(periodSamples),
            stressIncidents: countStressIncidents(periodSamples),
            sampleCount: periodSamples.length,
        };
        // Cache the report
        this._reports.set(period, report);
        return report;
    }
    // ----------------------------------------------------------------
    // Privacy
    // ----------------------------------------------------------------
    setPrivacyMode(mode) {
        this._privacyMode = mode;
    }
    exportData() {
        const now = Date.now();
        const baseline = this.getBaseline();
        switch (this._privacyMode) {
            case 'minimal': {
                // Only trends, no raw samples
                const hourlyReport = this.getHourlyReport();
                const dailyReport = this.getDailyReport();
                const weeklyReport = this.getWeeklyReport();
                return {
                    baseline,
                    samples: [],
                    reports: [hourlyReport, dailyReport, weeklyReport],
                    exportedAt: now,
                };
            }
            case 'anonymized': {
                // Dimensions only, no source
                const anonymizedSamples = this._samples.getAll().map((s) => ({
                    valence: s.valence,
                    arousal: s.arousal,
                    dominance: s.dominance,
                    stress: s.stress,
                    timestamp: s.timestamp,
                    // source intentionally omitted
                }));
                return {
                    baseline,
                    samples: anonymizedSamples,
                    reports: Array.from(this._reports.values()),
                    exportedAt: now,
                };
            }
            case 'full':
            default: {
                return {
                    baseline,
                    samples: this._samples.getAll(),
                    reports: Array.from(this._reports.values()),
                    exportedAt: now,
                };
            }
        }
    }
    clearHistory() {
        this._samples.clear();
        this._reports.clear();
        this._stressHistory.clear();
        this._currentState = {
            valence: 0,
            arousal: 0,
            dominance: 0,
            stress: 0,
            timestamp: Date.now(),
            confidence: 0,
        };
        this._driftStartTime = null;
        this._lastDriftDimension = null;
    }
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
export function createEmotionalTelemetryEngine() {
    return new EmotionalTelemetryEngineImpl();
}
//# sourceMappingURL=telemetry-engine.js.map