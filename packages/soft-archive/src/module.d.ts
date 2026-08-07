import type { ArchiveItem, SoftArchiveState, ArchiveConfig, SoftArchiveEvents, ArchiveSearchResult } from './types.js';
export interface ArchiveEventBus {
    emit<K extends keyof SoftArchiveEvents>(event: K, payload: SoftArchiveEvents[K]): void;
}
export declare class SoftArchive {
    private items;
    private readonly config;
    private lastArchivedAt;
    private bus;
    constructor(options?: Partial<ArchiveConfig> & {
        bus?: ArchiveEventBus;
    });
    /**
     * Archive an item with optional emotional tagging.
     */
    archive(content: string, moduleId: string, emotionalTag?: string, importance?: number): ArchiveItem;
    /**
     * Retrieve an item by ID, incrementing its access count.
     */
    retrieve(id: string): ArchiveItem | null;
    /**
     * Search archived items by emotional tag.
     */
    searchByEmotion(emotion: string): ArchiveSearchResult[];
    /**
     * Auto-archive items older than the given threshold.
     * Returns IDs of archived items.
     */
    autoArchive(ageThresholdMs: number): string[];
    /**
     * Calculate importance score based on access frequency.
     */
    getImportanceScore(id: string): number | null;
    /**
     * Get current state snapshot.
     */
    getState(): SoftArchiveState;
    /**
     * Get all items, optionally filtered by module.
     */
    getItems(moduleId?: string): ArchiveItem[];
    /**
     * Remove an item by ID.
     */
    remove(id: string): boolean;
    /**
     * Update emotional tag for an item.
     */
    setEmotionalTag(id: string, tag: string | null): ArchiveItem | null;
    /**
     * Update importance for an item.
     */
    setImportance(id: string, importance: number): ArchiveItem | null;
    /**
     * Search items by content substring.
     */
    searchByContent(query: string): ArchiveSearchResult[];
    /**
     * Clear all archived items.
     */
    clear(): void;
    /**
     * Get item count.
     */
    size(): number;
    private generateId;
    private calculateRelevance;
    private calculateRecencyBoost;
}
//# sourceMappingURL=module.d.ts.map