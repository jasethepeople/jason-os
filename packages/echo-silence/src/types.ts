export interface SilenceState {
  active: boolean;
  sessionDurationSec: number;
  breathCount: number;
  ambientLevel: 'silent' | 'nature' | 'white-noise' | 'binaural';
  streakDays: number;
  lastSessionAt: number | null;
}
