import type { SignalAnalysis, SoftSignalState, ToneScore, SoftSignalConfig } from './types.js';
export declare class SoftSignalPro {
    private state;
    private readonly config;
    constructor(options?: Partial<SoftSignalConfig>);
    /**
     * Analyze a message for tone and emotional markers.
     */
    analyzeMessage(text: string): SignalAnalysis;
    /**
     * Calculate tone scores for a message.
     * Positive words increase positive score, negative words increase negative score.
     */
    getToneScore(text: string): ToneScore;
    /**
     * Suggest a softened version of the message.
     */
    suggestSoftening(text: string): string | null;
    /**
     * Detect emotional markers in the text.
     */
    getEmotionalMarkers(text: string): string[];
    /**
     * Get current state.
     */
    getState(): SoftSignalState;
    /**
     * Reset analysis state.
     */
    resetState(): void;
    private tokenize;
    private mapScoreToTone;
    private calculateConfidence;
    private selectSoftening;
    private hashString;
    private updateState;
}
//# sourceMappingURL=module.d.ts.map