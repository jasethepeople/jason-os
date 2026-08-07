// ============================================================
// Undercurrent Module — Subconscious Pattern Detector
// Scan emotional history for recurring patterns, detect correlations
// between dimensions, generate insights.
// ============================================================

import type {
  DataPoint,
  Pattern,
  UndercurrentState,
  UndercurrentOptions,
} from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const undercurrent_module = {
  id: 'undercurrent',
  name: 'Undercurrent',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['telemetry:read', 'history:read', 'events:emit'] as const,
  description:
    'Subconscious pattern detector — scans emotional history for recurring patterns and correlations',
};

// ------------------------------------------------------------------
// Undercurrent Implementation
// ------------------------------------------------------------------

let _patternIdCounter = 0;

function generatePatternId(): string {
  _patternIdCounter++;
  return `pattern-${Date.now()}-${_patternIdCounter}`;
}

export class Undercurrent {
  private state: UndercurrentState = {
    patterns: [],
    insights: [],
    scanDepth: 50,
  };

  private _bus: unknown;
  private _confidenceThreshold: number;
  private _scanDepth: number;
  private _minOccurrences: number;

  constructor(bus?: unknown, options?: UndercurrentOptions) {
    this._bus = bus;
    void this._bus;
    this._confidenceThreshold = options?.confidenceThreshold ?? 0.6;
    this._scanDepth = options?.scanDepth ?? 50;
    this._minOccurrences = options?.minOccurrences ?? 3;
    this.state.scanDepth = this._scanDepth;
  }

  async init(): Promise<void> {
    return Promise.resolve();
  }

  // ----------------------------------------------------------------
  // Scanning
  // ----------------------------------------------------------------

  /**
   * Scan a set of emotional data points for patterns.
   * @param dataPoints - Array of emotional data points to analyze
   */
  scan(dataPoints: DataPoint[]): void {
    if (dataPoints.length < this._minOccurrences) return;

    const window = dataPoints.slice(-this._scanDepth);

    // Detect each pattern type
    this.detectCorrelation(window);
    this.detectCycle(window);
    this.detectSpikeCluster(window);
    this.detectBaselineDrift(window);

    // Generate insights from detected patterns
    this.generateInsights();
  }

  // ----------------------------------------------------------------
  // Pattern Detection
  // ----------------------------------------------------------------

  /**
   * Detect correlation patterns between emotional dimensions.
   * E.g., high stress always follows low valence.
   * @param dataPoints - Data points to analyze
   */
  detectPattern(dataPoints: DataPoint[]): Pattern | null {
    if (dataPoints.length < this._minOccurrences) return null;

    // Try detecting each pattern type, return the highest-confidence one
    const correlation = this.buildCorrelationPattern(dataPoints);
    const cycle = this.buildCyclePattern(dataPoints);
    const spikeCluster = this.buildSpikeClusterPattern(dataPoints);
    const baselineDrift = this.buildBaselineDriftPattern(dataPoints);

    const candidates = [correlation, cycle, spikeCluster, baselineDrift].filter(
      (p): p is Pattern => p !== null
    );

    if (candidates.length === 0) return null;

    // Return highest confidence pattern
    return candidates.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }

  // ----------------------------------------------------------------
  // Insight Generation
  // ----------------------------------------------------------------

  /**
   * Generate human-readable insights from detected patterns.
   * @returns Array of insight strings
   */
  generateInsights(): string[] {
    const insights: string[] = [];

    for (const pattern of this.state.patterns) {
      if (pattern.confidence < this._confidenceThreshold) continue;

      switch (pattern.type) {
        case 'correlation':
          insights.push(
            `Correlation detected: ${pattern.description} (confidence: ${Math.round(pattern.confidence * 100)}%)`
          );
          break;
        case 'cycle':
          insights.push(
            `Cyclic pattern found: ${pattern.description} (confidence: ${Math.round(pattern.confidence * 100)}%)`
          );
          break;
        case 'spike-cluster':
          insights.push(
            `Stress spikes cluster around: ${pattern.description} (confidence: ${Math.round(pattern.confidence * 100)}%)`
          );
          break;
        case 'baseline-drift':
          insights.push(
            `Baseline shift detected: ${pattern.description} (confidence: ${Math.round(pattern.confidence * 100)}%)`
          );
          break;
      }
    }

    // Add meta-insights
    const qualifyingPatterns = this.state.patterns.filter(
      (p) => p.confidence >= this._confidenceThreshold
    );
    if (qualifyingPatterns.length === 0 && this.state.scanDepth > 0) {
      insights.push('No strong patterns detected yet. Continue monitoring for more data.');
    }

    const highStressPatterns = this.state.patterns.filter(
      (p) => p.relatedDimensions.includes('stress') && p.confidence > 0.7
    );
    if (highStressPatterns.length >= 2) {
      insights.push(
        'Multiple stress-related patterns detected. Consider proactive stress management.'
      );
    }

    this.state.insights = insights;
    return [...insights];
  }

  // ----------------------------------------------------------------
  // Getters
  // ----------------------------------------------------------------

  /**
   * Get a specific pattern by ID.
   * @param id - Pattern ID
   * @returns Pattern copy, or null if not found
   */
  getPattern(id: string): Pattern | null {
    const pattern = this.state.patterns.find((p) => p.id === id);
    return pattern ? { ...pattern, relatedDimensions: [...pattern.relatedDimensions] } : null;
  }

  /**
   * Get all detected patterns.
   * @returns Array of pattern copies
   */
  getPatterns(): Pattern[] {
    return this.state.patterns.map((p) => ({
      ...p,
      relatedDimensions: [...p.relatedDimensions],
    }));
  }

  /**
   * Get current insights.
   * @returns Array of insight strings
   */
  getInsights(): string[] {
    return [...this.state.insights];
  }

  /**
   * Get the full current state.
   * @returns Deep-cloned state snapshot
   */
  getState(): UndercurrentState {
    return {
      patterns: this.getPatterns(),
      insights: [...this.state.insights],
      scanDepth: this.state.scanDepth,
    };
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  async destroy(): Promise<void> {
    this.state = {
      patterns: [],
      insights: [],
      scanDepth: this._scanDepth,
    };
    this._bus = undefined;
    return Promise.resolve();
  }

  // ----------------------------------------------------------------
  // Private pattern detection implementations
  // ----------------------------------------------------------------

  /**
   * Detect correlation: does high stress follow low valence?
   */
  private detectCorrelation(dataPoints: DataPoint[]): void {
    const pattern = this.buildCorrelationPattern(dataPoints);
    if (pattern) this.addPattern(pattern);
  }

  private buildCorrelationPattern(dataPoints: DataPoint[]): Pattern | null {
    if (dataPoints.length < 3) return null;

    // Check: does low valence correlate with high stress?
    let lowValenceHighStressCount = 0;
    let totalChecked = 0;

    for (const dp of dataPoints) {
      if (dp.valence < -0.3) {
        totalChecked++;
        if (dp.stress > 0.5) {
          lowValenceHighStressCount++;
        }
      }
    }

    if (totalChecked < this._minOccurrences) return null;

    const confidence = lowValenceHighStressCount / totalChecked;
    if (confidence < this._confidenceThreshold) return null;

    return {
      id: generatePatternId(),
      type: 'correlation',
      confidence,
      firstSeen: dataPoints[0]!.timestamp,
      lastSeen: dataPoints[dataPoints.length - 1]!.timestamp,
      occurrences: lowValenceHighStressCount,
      relatedDimensions: ['valence', 'stress'],
      description: `Low valence correlates with high stress (${lowValenceHighStressCount}/${totalChecked} instances)`,
    };
  }

  /**
   * Detect cyclical patterns in valence over time.
   */
  private detectCycle(dataPoints: DataPoint[]): void {
    const pattern = this.buildCyclePattern(dataPoints);
    if (pattern) this.addPattern(pattern);
  }

  private buildCyclePattern(dataPoints: DataPoint[]): Pattern | null {
    if (dataPoints.length < 6) return null;

    // Look for oscillation in valence (up-down-up-down)
    const valences = dataPoints.map((dp) => dp.valence);
    let directionChanges = 0;
    let lastDirection = 0; // -1 = down, 1 = up

    for (let i = 1; i < valences.length; i++) {
      const diff = valences[i]! - valences[i - 1]!;
      const direction = diff > 0.05 ? 1 : diff < -0.05 ? -1 : 0;
      if (direction !== 0 && direction !== lastDirection && lastDirection !== 0) {
        directionChanges++;
        lastDirection = direction;
      } else if (direction !== 0) {
        lastDirection = direction;
      }
    }

    // Need at least 2 direction changes for a cycle
    if (directionChanges < 2) return null;

    const confidence = Math.min(1, directionChanges / (dataPoints.length / 3));
    if (confidence < this._confidenceThreshold) return null;

    return {
      id: generatePatternId(),
      type: 'cycle',
      confidence,
      firstSeen: dataPoints[0]!.timestamp,
      lastSeen: dataPoints[dataPoints.length - 1]!.timestamp,
      occurrences: directionChanges,
      relatedDimensions: ['valence'],
      description: `Valence oscillates in a cyclical pattern (${directionChanges} direction changes)`,
    };
  }

  /**
   * Detect clusters of stress spikes.
   */
  private detectSpikeCluster(dataPoints: DataPoint[]): void {
    const pattern = this.buildSpikeClusterPattern(dataPoints);
    if (pattern) this.addPattern(pattern);
  }

  private buildSpikeClusterPattern(dataPoints: DataPoint[]): Pattern | null {
    if (dataPoints.length < 3) return null;

    // Find stress spikes (>0.7) and check if they cluster
    const spikeIndices: number[] = [];
    for (let i = 0; i < dataPoints.length; i++) {
      if (dataPoints[i]!.stress > 0.7) {
        spikeIndices.push(i);
      }
    }

    if (spikeIndices.length < this._minOccurrences) return null;

    // Check clustering: are spikes close together?
    let clusteredCount = 0;
    for (let i = 1; i < spikeIndices.length; i++) {
      if (spikeIndices[i]! - spikeIndices[i - 1]! <= 3) {
        clusteredCount++;
      }
    }

    const confidence = spikeIndices.length > 1 ? clusteredCount / (spikeIndices.length - 1) : 0;
    if (confidence < this._confidenceThreshold) return null;

    return {
      id: generatePatternId(),
      type: 'spike-cluster',
      confidence,
      firstSeen: dataPoints[0]!.timestamp,
      lastSeen: dataPoints[dataPoints.length - 1]!.timestamp,
      occurrences: spikeIndices.length,
      relatedDimensions: ['stress', 'arousal'],
      description: `Stress spikes cluster together (${spikeIndices.length} spikes, ${clusteredCount} clustered)`,
    };
  }

  /**
   * Detect baseline drift in emotional dimensions.
   */
  private detectBaselineDrift(dataPoints: DataPoint[]): void {
    const pattern = this.buildBaselineDriftPattern(dataPoints);
    if (pattern) this.addPattern(pattern);
  }

  private buildBaselineDriftPattern(dataPoints: DataPoint[]): Pattern | null {
    if (dataPoints.length < 6) return null;

    // Compare first third vs last third averages for each dimension
    const third = Math.floor(dataPoints.length / 3);
    const firstThird = dataPoints.slice(0, third);
    const lastThird = dataPoints.slice(-third);

    if (firstThird.length === 0 || lastThird.length === 0) return null;

    const dimensions: { name: string; key: keyof DataPoint }[] = [
      { name: 'valence', key: 'valence' },
      { name: 'stress', key: 'stress' },
      { name: 'dominance', key: 'dominance' },
      { name: 'arousal', key: 'arousal' },
    ];

    let maxDriftDim = '';
    let maxDrift = 0;

    for (const dim of dimensions) {
      const firstAvg =
        firstThird.reduce((sum, dp) => sum + (dp[dim.key] as number), 0) / firstThird.length;
      const lastAvg =
        lastThird.reduce((sum, dp) => sum + (dp[dim.key] as number), 0) / lastThird.length;
      const drift = Math.abs(lastAvg - firstAvg);
      if (drift > maxDrift) {
        maxDrift = drift;
        maxDriftDim = dim.name;
      }
    }

    const confidence = Math.min(1, maxDrift * 2);
    if (confidence < this._confidenceThreshold || maxDriftDim === '') return null;

    return {
      id: generatePatternId(),
      type: 'baseline-drift',
      confidence,
      firstSeen: dataPoints[0]!.timestamp,
      lastSeen: dataPoints[dataPoints.length - 1]!.timestamp,
      occurrences: 1,
      relatedDimensions: [maxDriftDim],
      description: `${maxDriftDim} baseline has drifted by ${maxDrift.toFixed(2)} over the scan period`,
    };
  }

  /**
   * Add a pattern to state, avoiding duplicates by type+dimensions.
   */
  private addPattern(pattern: Pattern): void {
    const existingIndex = this.state.patterns.findIndex(
      (p) => p.type === pattern.type && this.arraysEqual(p.relatedDimensions, pattern.relatedDimensions)
    );
    if (existingIndex >= 0) {
      // Update existing pattern
      this.state.patterns[existingIndex] = {
        ...pattern,
        id: this.state.patterns[existingIndex]!.id,
        firstSeen: this.state.patterns[existingIndex]!.firstSeen,
        occurrences: this.state.patterns[existingIndex]!.occurrences + pattern.occurrences,
        lastSeen: pattern.lastSeen,
      };
    } else {
      this.state.patterns.push(pattern);
    }
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, i) => val === sortedB[i]);
  }

}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createUndercurrentModule(
  bus?: unknown,
  options?: UndercurrentOptions
): Undercurrent {
  return new Undercurrent(bus, options);
}
