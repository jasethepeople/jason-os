export class SoftArchive {
    items = new Map();
    config;
    lastArchivedAt = null;
    bus;
    constructor(options = {}) {
        this.config = {
            autoArchiveEnabled: true,
            defaultEmotionalTag: null,
            importanceDecayFactor: 0.95,
            minImportanceThreshold: 0.1,
            maxItems: 10000,
            ...options,
        };
        this.bus = options.bus;
    }
    /**
     * Archive an item with optional emotional tagging.
     */
    archive(content, moduleId, emotionalTag, importance) {
        const id = this.generateId();
        const archivedAt = Date.now();
        const item = {
            id,
            content,
            emotionalTag: emotionalTag ?? this.config.defaultEmotionalTag,
            moduleId,
            archivedAt,
            importance: importance ?? 1.0,
            accessCount: 0,
        };
        this.items.set(id, item);
        this.lastArchivedAt = archivedAt;
        if (this.bus) {
            this.bus.emit('archive:item-archived', {
                itemId: id,
                content,
                moduleId,
                archivedAt,
            });
        }
        return item;
    }
    /**
     * Retrieve an item by ID, incrementing its access count.
     */
    retrieve(id) {
        const item = this.items.get(id);
        if (!item)
            return null;
        item.accessCount++;
        return { ...item };
    }
    /**
     * Search archived items by emotional tag.
     */
    searchByEmotion(emotion) {
        const results = [];
        for (const item of this.items.values()) {
            if (item.emotionalTag?.toLowerCase() === emotion.toLowerCase()) {
                results.push({
                    item: { ...item },
                    relevanceScore: this.calculateRelevance(item),
                });
            }
        }
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    /**
     * Auto-archive items older than the given threshold.
     * Returns IDs of archived items.
     */
    autoArchive(ageThresholdMs) {
        if (!this.config.autoArchiveEnabled)
            return [];
        const now = Date.now();
        const archivedIds = [];
        for (const [id, item] of this.items) {
            const age = now - item.archivedAt;
            if (age > ageThresholdMs) {
                // Reduce importance for old items
                item.importance *= this.config.importanceDecayFactor;
                // Mark for removal if below threshold
                if (item.importance < this.config.minImportanceThreshold) {
                    this.items.delete(id);
                    archivedIds.push(id);
                }
            }
        }
        return archivedIds;
    }
    /**
     * Calculate importance score based on access frequency.
     */
    getImportanceScore(id) {
        const item = this.items.get(id);
        if (!item)
            return null;
        const recencyBoost = this.calculateRecencyBoost(item.archivedAt);
        const accessBoost = Math.log1p(item.accessCount);
        const score = item.importance * recencyBoost * (1 + accessBoost);
        return Math.round(score * 100) / 100;
    }
    /**
     * Get current state snapshot.
     */
    getState() {
        return {
            items: Array.from(this.items.values()).map((item) => ({ ...item })),
            totalArchived: this.items.size,
            lastArchivedAt: this.lastArchivedAt,
            autoArchiveEnabled: this.config.autoArchiveEnabled,
        };
    }
    /**
     * Get all items, optionally filtered by module.
     */
    getItems(moduleId) {
        const all = Array.from(this.items.values());
        if (moduleId) {
            return all.filter((item) => item.moduleId === moduleId).map((item) => ({ ...item }));
        }
        return all.map((item) => ({ ...item }));
    }
    /**
     * Remove an item by ID.
     */
    remove(id) {
        return this.items.delete(id);
    }
    /**
     * Update emotional tag for an item.
     */
    setEmotionalTag(id, tag) {
        const item = this.items.get(id);
        if (!item)
            return null;
        item.emotionalTag = tag;
        return { ...item };
    }
    /**
     * Update importance for an item.
     */
    setImportance(id, importance) {
        const item = this.items.get(id);
        if (!item)
            return null;
        item.importance = Math.max(0, importance);
        return { ...item };
    }
    /**
     * Search items by content substring.
     */
    searchByContent(query) {
        const lowerQuery = query.toLowerCase();
        const results = [];
        for (const item of this.items.values()) {
            if (item.content.toLowerCase().includes(lowerQuery)) {
                results.push({
                    item: { ...item },
                    relevanceScore: this.calculateRelevance(item),
                });
            }
        }
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    /**
     * Clear all archived items.
     */
    clear() {
        this.items.clear();
        this.lastArchivedAt = null;
    }
    /**
     * Get item count.
     */
    size() {
        return this.items.size;
    }
    generateId() {
        return `arch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    calculateRelevance(item) {
        const recency = this.calculateRecencyBoost(item.archivedAt);
        const access = Math.log1p(item.accessCount);
        return item.importance * recency * (1 + access * 0.5);
    }
    calculateRecencyBoost(archivedAt) {
        const ageMs = Date.now() - archivedAt;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        return Math.max(0.1, 1 - ageDays * 0.01);
    }
}
//# sourceMappingURL=module.js.map