export type ToneType = 'supportive' | 'neutral' | 'harsh' | 'unclear';
export interface SignalAnalysis {
    tone: ToneType;
    emotionalMarkers: string[];
    suggestedSoftening: string | null;
    confidence: number;
}
export interface SoftSignalState {
    analyses: number;
    lastAnalyzedAt: number | null;
    avgTone: number;
}
export interface ToneScore {
    positive: number;
    negative: number;
    neutral: number;
    composite: number;
}
export interface SoftSignalConfig {
    confidenceThreshold: number;
    defaultSuggestion: string | null;
    softeningIntensity: 'mild' | 'moderate' | 'strong';
}
//# sourceMappingURL=types.d.ts.map