export interface EmotionalSample {
    valence: number;
    arousal: number;
    dominance: number;
    stress: number;
    timestamp?: number;
    source: string;
}
export interface EmotionalState {
    valence: number;
    arousal: number;
    dominance: number;
    stress: number;
    timestamp: number;
    confidence: number;
}
export interface EmotionalBaseline {
    valence: number;
    arousal: number;
    dominance: number;
    stress: number;
    sampleCount: number;
}
export interface EmotionalReport {
    period: 'hourly' | 'daily' | 'weekly';
    startTime: number;
    endTime: number;
    average: EmotionalState;
    minimum: EmotionalState;
    maximum: EmotionalState;
    trend: 'improving' | 'stable' | 'declining';
    stressIncidents: number;
    sampleCount: number;
}
export interface DriftResult {
    dimension: 'valence' | 'arousal' | 'dominance' | 'stress';
    direction: 'increasing' | 'decreasing';
    magnitude: number;
    severity: 'mild' | 'moderate' | 'severe';
    durationMs: number;
}
export interface EmotionalDataExport {
    baseline: EmotionalBaseline;
    samples: EmotionalSample[];
    reports: EmotionalReport[];
    exportedAt: number;
}
export interface EmotionalTelemetryEngine {
    captureSample(sample: EmotionalSample): void;
    getCurrentState(): EmotionalState;
    getBaseline(): EmotionalBaseline;
    setBaseline(baseline: EmotionalBaseline): void;
    getHourlyReport(): EmotionalReport;
    getDailyReport(): EmotionalReport;
    getWeeklyReport(): EmotionalReport;
    detectStressSpike(): boolean;
    getStressLevel(): number;
    onStressSpike(handler: (level: number) => void): () => void;
    detectEmotionalDrift(): DriftResult | null;
    onDrift(handler: (drift: DriftResult) => void): () => void;
    setPrivacyMode(mode: 'full' | 'anonymized' | 'minimal'): void;
    exportData(): EmotionalDataExport;
    clearHistory(): void;
}
export declare class EmotionalTelemetryEngineImpl implements EmotionalTelemetryEngine {
    private readonly _samples;
    private _baseline;
    private _currentState;
    private readonly _reports;
    private readonly _stressHandlers;
    private readonly _driftHandlers;
    private _privacyMode;
    private _driftStartTime;
    private _lastDriftDimension;
    private _stressHistory;
    constructor();
    private _createNeutralBaseline;
    captureSample(sample: EmotionalSample): void;
    getCurrentState(): EmotionalState;
    getBaseline(): EmotionalBaseline;
    setBaseline(baseline: EmotionalBaseline): void;
    private _updateBaseline;
    private _checkStressSpike;
    detectStressSpike(): boolean;
    getStressLevel(): number;
    onStressSpike(handler: (level: number) => void): () => void;
    private _checkDrift;
    detectEmotionalDrift(): DriftResult | null;
    onDrift(handler: (drift: DriftResult) => void): () => void;
    getHourlyReport(): EmotionalReport;
    getDailyReport(): EmotionalReport;
    getWeeklyReport(): EmotionalReport;
    private _generateReport;
    setPrivacyMode(mode: 'full' | 'anonymized' | 'minimal'): void;
    exportData(): EmotionalDataExport;
    clearHistory(): void;
}
export declare function createEmotionalTelemetryEngine(): EmotionalTelemetryEngine;
//# sourceMappingURL=telemetry-engine.d.ts.map