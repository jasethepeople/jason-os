export interface DriftState {
  drifting: boolean;
  driftScore: number;
  lastDriftAt: number | null;
  driftDirection: 'past' | 'future' | 'dissociation' | null;
  interventionsOffered: number;
}

export interface DriftCellConfig {
  threshold: number;
  gentleMode: boolean;
}
