import type { Theme, ThemeName } from './types.js';

const THEMES: Record<ThemeName, Theme> = {
  dim: {
    name: 'dim',
    bg: '#0f0f12',
    fg: '#a1a1aa',
    accent: '#6366f1',
    card: '#1a1a1e',
    border: '#27272a',
    radius: '8px',
    animation: true,
    contrast: 'low',
  },
  soft: {
    name: 'soft',
    bg: '#fdf6f0',
    fg: '#57534e',
    accent: '#f97316',
    card: '#ffffff',
    border: '#e7e5e4',
    radius: '16px',
    animation: true,
    contrast: 'normal',
  },
  shadow: {
    name: 'shadow',
    bg: '#0a0a0f',
    fg: '#e4e4e7',
    accent: '#7c3aed',
    card: '#18181b',
    border: '#27272a',
    radius: '6px',
    animation: true,
    contrast: 'high',
  },
  quiet: {
    name: 'quiet',
    bg: '#fafafa',
    fg: '#18181b',
    accent: '#18181b',
    card: '#ffffff',
    border: '#f4f4f5',
    radius: '4px',
    animation: false,
    contrast: 'normal',
  },
};

export class ThemeEngine {
  private _current: ThemeName = 'shadow';
  private _listeners: ((t: Theme) => void)[] = [];
  private _stressOverride = false;

  getTheme(name?: ThemeName): Theme {
    return THEMES[name ?? this._current];
  }

  getCurrentName(): ThemeName {
    return this._current;
  }

  getAll(): Theme[] {
    return Object.values(THEMES);
  }

  isStressOverride(): boolean {
    return this._stressOverride;
  }

  setTheme(
    name: ThemeName,
    emotionState?: { stress: number; valence?: number },
  ): Theme {
    // Per Affiliate Layer 6.5.1 + Theme Engine 3.3: suppress neon on high stress
    if (emotionState && emotionState.stress > 0.8) {
      if (name === 'shadow') name = 'dim';
      this._stressOverride = true;
    } else {
      this._stressOverride = false;
    }

    if (!THEMES[name]) throw new Error(`Unknown theme ${name}`);
    const prev = this._current;
    this._current = name;
    const t = THEMES[name];

    // Safe DOM apply with SSR guard
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = name;
        document.documentElement.dataset.prevTheme = prev;
        Object.entries({
          bg: t.bg,
          fg: t.fg,
          accent: t.accent,
          card: t.card,
          border: t.border,
        }).forEach(([k, v]) => {
          document.documentElement.style.setProperty(`--jason-${k}`, v);
        });
      }
    } catch {
      /* SSR or no DOM */
    }

    this._listeners.forEach((l) => {
      try {
        l(t);
      } catch {
        /* ignore listener errors */
      }
    });
    return t;
  }

  onChange(cb: (t: Theme) => void): () => void {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter((x) => x !== cb);
    };
  }

  // Emotion-aware component helper per spec 3.4.2
  adaptComponentForEmotion(
    baseStyle: Record<string, string>,
    stress: number,
  ): Record<string, string> {
    if (stress > 0.7) {
      return {
        ...baseStyle,
        animation: 'none',
        transition: 'none',
        filter: 'saturate(0.7)',
      };
    }
    return baseStyle;
  }
}

export function createThemeEngine(initial?: ThemeName): ThemeEngine {
  const e = new ThemeEngine();
  if (initial) e.setTheme(initial);
  return e;
}
