export interface Veil {
  id: string;
  label: string;
  active: boolean;
  createdAt: number;
}

export interface UnderveilState {
  veils: Veil[];
  consentGiven: boolean;
  consentTimestamp: number | null;
  activeVeilId: string | null;
}
