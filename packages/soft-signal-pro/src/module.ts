import type {
  SignalAnalysis,
  SoftSignalState,
  ToneScore,
  SoftSignalConfig,
  ToneType,
} from './types.js';

const POSITIVE_WORDS: readonly string[] = [
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like',
  'happy', 'pleased', 'delighted', 'grateful', 'thank', 'thanks', 'appreciate',
  'best', 'awesome', 'brilliant', 'perfect', 'beautiful', 'nice', 'kind',
  'helpful', 'supportive', 'encouraging', 'positive', 'hope', 'glad', 'joy',
  'excited', 'thrilled', 'satisfied', 'recommend', 'praise', 'congratulations',
];

const NEGATIVE_WORDS: readonly string[] = [
  'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry', 'mad',
  'upset', 'disappointed', 'frustrated', 'annoyed', 'irritated', 'worst', 'stupid',
  'idiot', 'useless', 'pathetic', 'ridiculous', 'absurd', 'wrong', 'fail',
  'failure', 'broken', 'mess', 'disaster', 'problem', 'complaint', 'blame',
  'fault', 'criticize', 'attack', 'insult', 'rude', 'aggressive', 'hostile',
  'lazy', 'incompetent', 'unprofessional', 'unacceptable', 'disgusting', 'worthless',
];

const SOFTENING_TEMPLATES: Record<string, readonly string[]> = {
  mild: [
    'Perhaps we could consider...',
    'It might be helpful to...',
    'I was thinking that...',
    'Would it be possible to...',
  ],
  moderate: [
    'I understand your perspective, and I wonder if...',
    'I really appreciate your input here. Maybe we could...',
    'That is a valid point. I am wondering if we might...',
    'I hear you. I was hoping we could explore...',
  ],
  strong: [
    'I truly value your thoughts on this, and I gently wanted to suggest...',
    'I completely understand where you are coming from. I was hoping we might softly consider...',
    'With all due respect and deep appreciation for your view, I was wondering if...',
  ],
};

export class SoftSignalPro {
  private state: SoftSignalState;
  private readonly config: SoftSignalConfig;

  constructor(options: Partial<SoftSignalConfig> = {}) {
    this.config = {
      confidenceThreshold: 0.6,
      defaultSuggestion: null,
      softeningIntensity: 'moderate',
      ...options,
    };
    this.state = {
      analyses: 0,
      lastAnalyzedAt: null,
      avgTone: 0,
    };
  }

  /**
   * Analyze a message for tone and emotional markers.
   */
  analyzeMessage(text: string): SignalAnalysis {
    if (!text || text.trim().length === 0) {
      return {
        tone: 'unclear',
        emotionalMarkers: [],
        suggestedSoftening: null,
        confidence: 0,
      };
    }

    const markers = this.getEmotionalMarkers(text);
    const score = this.getToneScore(text);
    const tone = this.mapScoreToTone(score);
    const confidence = this.calculateConfidence(score, markers);
    const suggestion = this.selectSoftening(tone, text);

    this.updateState(score.composite);

    return {
      tone,
      emotionalMarkers: markers,
      suggestedSoftening: suggestion,
      confidence,
    };
  }

  /**
   * Calculate tone scores for a message.
   * Positive words increase positive score, negative words increase negative score.
   */
  getToneScore(text: string): ToneScore {
    const words = this.tokenize(text);
    const uniqueWords = new Set(words);
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (const word of uniqueWords) {
      if (POSITIVE_WORDS.includes(word)) {
        positive++;
      } else if (NEGATIVE_WORDS.includes(word)) {
        negative++;
      } else {
        neutral++;
      }
    }

    const total = words.length || 1;
    const composite = (positive - negative) / total;

    return {
      positive,
      negative,
      neutral,
      composite,
    };
  }

  /**
   * Suggest a softened version of the message.
   */
  suggestSoftening(text: string): string | null {
    const analysis = this.analyzeMessage(text);
    return analysis.suggestedSoftening;
  }

  /**
   * Detect emotional markers in the text.
   */
  getEmotionalMarkers(text: string): string[] {
    const words = this.tokenize(text);
    const markers: string[] = [];

    for (const word of words) {
      const lower = word.toLowerCase();
      if (POSITIVE_WORDS.includes(lower) && !markers.includes(lower)) {
        markers.push(lower);
      } else if (NEGATIVE_WORDS.includes(lower) && !markers.includes(lower)) {
        markers.push(lower);
      }
    }

    return markers;
  }

  /**
   * Get current state.
   */
  getState(): SoftSignalState {
    return { ...this.state };
  }

  /**
   * Reset analysis state.
   */
  resetState(): void {
    this.state = {
      analyses: 0,
      lastAnalyzedAt: null,
      avgTone: 0,
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  private mapScoreToTone(score: ToneScore): ToneType {
    if (score.positive > 0 && score.negative > 0) {
      return 'unclear';
    }
    if (score.positive > score.negative) {
      return 'supportive';
    }
    if (score.negative > score.positive) {
      return 'harsh';
    }
    return 'neutral';
  }

  private calculateConfidence(score: ToneScore, markers: string[]): number {
    const totalEmotionalWords = score.positive + score.negative;
    const totalWords = score.positive + score.negative + score.neutral;
    if (totalWords === 0) return 0;

    const density = totalEmotionalWords / totalWords;
    const markerBonus = Math.min(markers.length * 0.1, 0.3);
    const rawConfidence = density + markerBonus;

    return Math.min(Math.round(rawConfidence * 100) / 100, 1);
  }

  private selectSoftening(tone: ToneType, _text: string): string | null {
    if (tone === 'supportive' || tone === 'neutral') {
      return null;
    }

    const templates = SOFTENING_TEMPLATES[this.config.softeningIntensity];
    if (!templates || templates.length === 0) return this.config.defaultSuggestion;
    const index = Math.abs(this.hashString(_text)) % templates.length;
    return templates[index] ?? this.config.defaultSuggestion;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash);
  }

  private updateState(compositeScore: number): void {
    const { analyses, avgTone } = this.state;
    const newAnalyses = analyses + 1;
    const newAvg = (avgTone * analyses + compositeScore) / newAnalyses;

    this.state = {
      analyses: newAnalyses,
      lastAnalyzedAt: Date.now(),
      avgTone: Math.round(newAvg * 100) / 100,
    };
  }
}
