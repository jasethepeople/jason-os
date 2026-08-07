export interface ArchiveItem {
  id: string;
  content: string;
  emotionalTag: string | null;
  moduleId: string;
  archivedAt: number;
  importance: number;
  accessCount: number;
}

export interface SoftArchiveState {
  items: ArchiveItem[];
  totalArchived: number;
  lastArchivedAt: number | null;
  autoArchiveEnabled: boolean;
}

export interface ArchiveConfig {
  autoArchiveEnabled: boolean;
  defaultEmotionalTag: string | null;
  importanceDecayFactor: number;
  minImportanceThreshold: number;
  maxItems: number;
}

export interface SoftArchiveEvents {
  'archive:item-archived': { itemId: string; content: string; moduleId: string; archivedAt: number };
}

export type ArchiveSearchResult = {
  item: ArchiveItem;
  relevanceScore: number;
};
