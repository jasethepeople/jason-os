// ============================================================
// QuietFrame Module — Language Softening
// Tones down harsh input into softer alternatives
// ============================================================

import type { FrameState } from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const quiet_frame_module = {
  id: 'quiet-frame',
  name: 'QuietFrame',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['input:read', 'transform'] as const,
  description: 'Language softening \u2014 tones down harsh input into softer alternatives',
};

// ------------------------------------------------------------------
// Default Replacement Patterns
// ------------------------------------------------------------------

const DEFAULT_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\byou must\b/gi, 'you might consider'],
  [/\byou have to\b/gi, 'it could help to'],
  [/\balways\b/gi, 'often'],
  [/\bnever\b/gi, 'sometimes not'],
  [/\bshould\b/gi, 'could'],
  [/\bneed to\b/gi, 'might want to'],
  [/\bfail\b/gi, 'did not succeed yet'],
  [/\bstupid\b/gi, 'challenging'],
  [/\bhate\b/gi, 'find difficult'],
  [/\bdisaster\b/gi, 'a situation worth care'],
];

// ------------------------------------------------------------------
// QuietFrame Implementation
// ------------------------------------------------------------------

export class QuietFrame {
  private state: FrameState = {
    softened: false,
    originalText: null,
    softenedText: null,
    softensApplied: 0,
  };

  private _bus: unknown;

  constructor(bus?: unknown) {
    this._bus = bus;
    void this._bus; // referenced to satisfy noUnusedLocals
  }

  async init(): Promise<void> {
    // Lifecycle hook for module loader integration
    return Promise.resolve();
  }

  /**
   * Apply language softening to the input text.
   * @param text - The input text to soften
   * @returns The softened text
   */
  soften(text: string): string {
    this.state.originalText = text;

    const replacements = DEFAULT_REPLACEMENTS;
    let result = text;
    let count = 0;

    for (const [pattern, replacement] of replacements) {
      const matches = result.match(pattern);
      if (matches) {
        count += matches.length;
      }
      result = result.replace(pattern, (match) => {
        if (match.charAt(0) === match.charAt(0).toUpperCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    }

    this.state.softenedText = result;
    this.state.softened = count > 0;
    this.state.softensApplied += count;

    return result;
  }

  /**
   * Apply softening with custom replacement patterns.
   * @param text - The input text to soften
   * @param patterns - Custom [RegExp, replacement] pairs
   * @returns The softened text
   */
  softenWithPatterns(text: string, patterns: Array<[RegExp, string]>): string {
    this.state.originalText = text;

    let result = text;
    let count = 0;

    for (const [pattern, replacement] of patterns) {
      const matches = result.match(pattern);
      if (matches) {
        count += matches.length;
      }
      result = result.replace(pattern, replacement);
    }

    this.state.softenedText = result;
    this.state.softened = count > 0;
    this.state.softensApplied += count;

    return result;
  }

  /**
   * Restore the original (unsoftened) text.
   * @returns The original text, or null if no softening has been performed
   */
  restore(): string | null {
    return this.state.originalText;
  }

  /**
   * Get the current softened text.
   * @returns The softened text, or null if no softening has been performed
   */
  getSoftenedText(): string | null {
    return this.state.softenedText;
  }

  /**
   * Check if the last soften operation made any changes.
   * @returns Whether softening was applied
   */
  wasSoftened(): boolean {
    return this.state.softened;
  }

  /**
   * Get the total number of softening replacements applied.
   * @returns Total replacement count across all soften calls
   */
  getSoftensApplied(): number {
    return this.state.softensApplied;
  }

  /**
   * Get the full current state of the QuietFrame instance.
   * @returns Deep-cloned state snapshot
   */
  getState(): FrameState {
    return {
      softened: this.state.softened,
      originalText: this.state.originalText,
      softenedText: this.state.softenedText,
      softensApplied: this.state.softensApplied,
    };
  }

  /**
   * Reset all state to initial values.
   */
  reset(): void {
    this.state = {
      softened: false,
      originalText: null,
      softenedText: null,
      softensApplied: 0,
    };
  }

  async destroy(): Promise<void> {
    this.reset();
    this._bus = undefined;
    return Promise.resolve();
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createQuietFrameModule(bus?: unknown): QuietFrame {
  return new QuietFrame(bus);
}
