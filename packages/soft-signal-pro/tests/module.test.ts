import { describe, it, expect, beforeEach } from 'vitest';
import { SoftSignalPro } from '../src/module';

describe('SoftSignalPro', () => {
  let pro: SoftSignalPro;

  beforeEach(() => {
    pro = new SoftSignalPro();
  });

  describe('analyzeMessage', () => {
    it('should return unclear for empty text', () => {
      const result = pro.analyzeMessage('');
      expect(result.tone).toBe('unclear');
      expect(result.confidence).toBe(0);
      expect(result.emotionalMarkers).toEqual([]);
      expect(result.suggestedSoftening).toBeNull();
    });

    it('should detect supportive tone with positive words', () => {
      const result = pro.analyzeMessage('Great job! I really appreciate your help.');
      expect(result.tone).toBe('supportive');
      expect(result.emotionalMarkers).toContain('great');
      expect(result.emotionalMarkers).toContain('appreciate');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect harsh tone with negative words', () => {
      const result = pro.analyzeMessage('This is terrible and completely awful.');
      expect(result.tone).toBe('harsh');
      expect(result.emotionalMarkers).toContain('terrible');
      expect(result.emotionalMarkers).toContain('awful');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect unclear tone with mixed sentiment', () => {
      const result = pro.analyzeMessage('Great work but this is terrible.');
      expect(result.tone).toBe('unclear');
      expect(result.emotionalMarkers).toContain('great');
      expect(result.emotionalMarkers).toContain('terrible');
    });

    it('should detect neutral tone with no emotional words', () => {
      const result = pro.analyzeMessage('The meeting is scheduled for 3 PM tomorrow.');
      expect(result.tone).toBe('neutral');
      expect(result.emotionalMarkers).toEqual([]);
    });

    it('should suggest softening for harsh tone', () => {
      const result = pro.analyzeMessage('This is stupid and useless.');
      expect(result.tone).toBe('harsh');
      expect(result.suggestedSoftening).not.toBeNull();
      expect(typeof result.suggestedSoftening).toBe('string');
    });

    it('should not suggest softening for supportive tone', () => {
      const result = pro.analyzeMessage('Excellent work! I love this.');
      expect(result.tone).toBe('supportive');
      expect(result.suggestedSoftening).toBeNull();
    });

    it('should not suggest softening for neutral tone', () => {
      const result = pro.analyzeMessage('The document contains three sections.');
      expect(result.tone).toBe('neutral');
      expect(result.suggestedSoftening).toBeNull();
    });

    it('should update state after analysis', () => {
      pro.analyzeMessage('Great work!');
      const state = pro.getState();
      expect(state.analyses).toBe(1);
      expect(state.lastAnalyzedAt).not.toBeNull();
    });

    it('should calculate confidence based on emotional word density', () => {
      const result = pro.analyzeMessage('great great great terrible');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('getToneScore', () => {
    it('should score positive words correctly', () => {
      const score = pro.getToneScore('amazing wonderful fantastic');
      expect(score.positive).toBe(3);
      expect(score.negative).toBe(0);
      expect(score.neutral).toBe(0);
      expect(score.composite).toBe(1);
    });

    it('should score negative words correctly', () => {
      const score = pro.getToneScore('horrible terrible awful');
      expect(score.positive).toBe(0);
      expect(score.negative).toBe(3);
      expect(score.neutral).toBe(0);
      expect(score.composite).toBe(-1);
    });

    it('should score neutral words correctly', () => {
      const score = pro.getToneScore('the meeting room');
      expect(score.positive).toBe(0);
      expect(score.negative).toBe(0);
      expect(score.neutral).toBe(3);
      expect(score.composite).toBe(0);
    });

    it('should handle empty string', () => {
      const score = pro.getToneScore('');
      expect(score.positive).toBe(0);
      expect(score.negative).toBe(0);
      expect(score.neutral).toBe(0);
      expect(score.composite).toBe(0);
    });

    it('should calculate composite score', () => {
      const score = pro.getToneScore('great work on this terrible problem');
      expect(score.positive).toBe(1); // 'great'
      expect(score.negative).toBe(2); // 'terrible' + 'problem' — unique negative words
      expect(score.neutral).toBe(3);  // 'work', 'on', 'this'
      expect(score.composite).toBeCloseTo(-1 / 6); // (1 - 2) / 6
    });
  });

  describe('suggestSoftening', () => {
    it('should return null for supportive message', () => {
      const suggestion = pro.suggestSoftening('Love this amazing work!');
      expect(suggestion).toBeNull();
    });

    it('should return a suggestion for harsh message', () => {
      const suggestion = pro.suggestSoftening('This is completely stupid and broken.');
      expect(suggestion).not.toBeNull();
      expect(typeof suggestion).toBe('string');
    });

    it('should return null for neutral message', () => {
      const suggestion = pro.suggestSoftening('The file is located in the folder.');
      expect(suggestion).toBeNull();
    });
  });

  describe('getEmotionalMarkers', () => {
    it('should detect positive markers', () => {
      const markers = pro.getEmotionalMarkers('great amazing wonderful');
      expect(markers).toContain('great');
      expect(markers).toContain('amazing');
      expect(markers).toContain('wonderful');
    });

    it('should detect negative markers', () => {
      const markers = pro.getEmotionalMarkers('terrible awful horrible');
      expect(markers).toContain('terrible');
      expect(markers).toContain('awful');
      expect(markers).toContain('horrible');
    });

    it('should return empty for neutral text', () => {
      const markers = pro.getEmotionalMarkers('the quick brown fox');
      expect(markers).toEqual([]);
    });

    it('should not duplicate markers', () => {
      const markers = pro.getEmotionalMarkers('great great great');
      expect(markers).toEqual(['great']);
    });

    it('should be case-insensitive', () => {
      const markers = pro.getEmotionalMarkers('GREAT Amazing WONDERFUL');
      expect(markers).toContain('great');
      expect(markers).toContain('amazing');
      expect(markers).toContain('wonderful');
    });
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = pro.getState();
      expect(state.analyses).toBe(0);
      expect(state.lastAnalyzedAt).toBeNull();
      expect(state.avgTone).toBe(0);
    });

    it('should reflect analysis count', () => {
      pro.analyzeMessage('Great work!');
      pro.analyzeMessage('Terrible result.');
      const state = pro.getState();
      expect(state.analyses).toBe(2);
    });

    it('should calculate average tone', () => {
      pro.analyzeMessage('great'); // composite = 1
      pro.analyzeMessage('terrible'); // composite = -1
      const state = pro.getState();
      expect(state.avgTone).toBe(0);
    });
  });

  describe('resetState', () => {
    it('should reset all state values', () => {
      pro.analyzeMessage('Great work!');
      pro.resetState();
      const state = pro.getState();
      expect(state.analyses).toBe(0);
      expect(state.lastAnalyzedAt).toBeNull();
      expect(state.avgTone).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should use custom confidence threshold', () => {
      const custom = new SoftSignalPro({ confidenceThreshold: 0.9 });
      const result = custom.analyzeMessage('great work');
      expect(result.confidence).toBeDefined();
    });

    it('should use custom softening intensity', () => {
      const custom = new SoftSignalPro({ softeningIntensity: 'strong' });
      const suggestion = custom.suggestSoftening('This is terrible and stupid.');
      expect(suggestion).not.toBeNull();
      expect(typeof suggestion).toBe('string');
    });
  });
});
