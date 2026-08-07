// ============================================================
// QuietFrame Module — Language Softening
// Tones down harsh input into softer alternatives
// ============================================================
// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------
export const quiet_frame_module = {
    id: 'quiet-frame',
    name: 'QuietFrame',
    category: 'emotional',
    version: '0.1.0',
    permissions: ['input:read', 'transform'],
    description: 'Language softening \u2014 tones down harsh input into softer alternatives',
};
// ------------------------------------------------------------------
// Default Replacement Patterns
// ------------------------------------------------------------------
const DEFAULT_REPLACEMENTS = [
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
    state = {
        softened: false,
        originalText: null,
        softenedText: null,
        softensApplied: 0,
    };
    _bus;
    constructor(bus) {
        this._bus = bus;
        void this._bus; // referenced to satisfy noUnusedLocals
    }
    async init() {
        // Lifecycle hook for module loader integration
        return Promise.resolve();
    }
    /**
     * Apply language softening to the input text.
     * @param text - The input text to soften
     * @returns The softened text
     */
    soften(text) {
        this.state.originalText = text;
        const replacements = DEFAULT_REPLACEMENTS;
        let result = text;
        let count = 0;
        for (const [pattern, replacement] of replacements) {
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
     * Apply softening with custom replacement patterns.
     * @param text - The input text to soften
     * @param patterns - Custom [RegExp, replacement] pairs
     * @returns The softened text
     */
    softenWithPatterns(text, patterns) {
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
    restore() {
        return this.state.originalText;
    }
    /**
     * Get the current softened text.
     * @returns The softened text, or null if no softening has been performed
     */
    getSoftenedText() {
        return this.state.softenedText;
    }
    /**
     * Check if the last soften operation made any changes.
     * @returns Whether softening was applied
     */
    wasSoftened() {
        return this.state.softened;
    }
    /**
     * Get the total number of softening replacements applied.
     * @returns Total replacement count across all soften calls
     */
    getSoftensApplied() {
        return this.state.softensApplied;
    }
    /**
     * Get the full current state of the QuietFrame instance.
     * @returns Deep-cloned state snapshot
     */
    getState() {
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
    reset() {
        this.state = {
            softened: false,
            originalText: null,
            softenedText: null,
            softensApplied: 0,
        };
    }
    async destroy() {
        this.reset();
        this._bus = undefined;
        return Promise.resolve();
    }
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
export function createQuietFrameModule(bus) {
    return new QuietFrame(bus);
}
//# sourceMappingURL=module.js.map