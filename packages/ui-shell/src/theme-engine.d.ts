import type { Theme, ThemeName } from './types.js';
export declare class ThemeEngine {
    private _current;
    private _listeners;
    private _stressOverride;
    getTheme(name?: ThemeName): Theme;
    getCurrentName(): ThemeName;
    getAll(): Theme[];
    isStressOverride(): boolean;
    setTheme(name: ThemeName, emotionState?: {
        stress: number;
        valence?: number;
    }): Theme;
    onChange(cb: (t: Theme) => void): () => void;
    adaptComponentForEmotion(baseStyle: Record<string, string>, stress: number): Record<string, string>;
}
export declare function createThemeEngine(initial?: ThemeName): ThemeEngine;
//# sourceMappingURL=theme-engine.d.ts.map