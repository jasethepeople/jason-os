export interface Habit {
  id: string;
  name: string;
  streak: number;
  lastCompletedAt: number | null;
  hidden: boolean;
  category: string;
}

export interface GhostRhythmState {
  habits: Habit[];
  totalCompletions: number;
  hiddenFromUI: boolean;
}
