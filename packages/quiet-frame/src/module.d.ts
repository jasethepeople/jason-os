import type { FrameState } from './types.js';
export declare const quiet_frame_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['input:read', 'transform'];
    description: string;
};
export declare class QuietFrame {
    private state;
    private _bus;
    constructor(bus?: unknown);
    init(): Promise<void>;
    /**
     * Apply language softening to the input text.
     * @param text - The input text to soften
     * @returns The softened text
     */
    soften(text: string): string;
    /**
     * Apply softening with custom replacement patterns.
     * @param text - The input text to soften
     * @param patterns - Custom [RegExp, replacement] pairs
     * @returns The softened text
     */
    softenWithPatterns(text: string, patterns: Array<[RegExp, string]>): string;
    /**
     * Restore the original (unsoftened) text.
     * @returns The original text, or null if no softening has been performed
     */
    restore(): string | null;
    /**
     * Get the current softened text.
     * @returns The softened text, or null if no softening has been performed
     */
    getSoftenedText(): string | null;
    /**
     * Check if the last soften operation made any changes.
     * @returns Whether softening was applied
     */
    wasSoftened(): boolean;
    /**
     * Get the total number of softening replacements applied.
     * @returns Total replacement count across all soften calls
     */
    getSoftensApplied(): number;
    /**
     * Get the full current state of the QuietFrame instance.
     * @returns Deep-cloned state snapshot
     */
    getState(): FrameState;
    /**
     * Reset all state to initial values.
     */
    reset(): void;
    destroy(): Promise<void>;
}
export declare function createQuietFrameModule(bus?: unknown): QuietFrame;
//# sourceMappingURL=module.d.ts.map