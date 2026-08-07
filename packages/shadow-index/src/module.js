export const shadow_index_module = {
    id: 'shadow-index',
    name: 'ShadowIndex',
    category: 'memory',
    version: '0.1.0',
    permissions: ['storage:read', 'storage:write'],
    description: 'Encrypted personal search engine across all module data',
};
export class ShadowIndex {
    _entries = new Map();
    state = {
        entries: 0,
        lastIndexedAt: null,
        modulesIndexed: [],
    };
    _bus;
    constructor(bus) {
        this._bus = bus;
    }
    async init() {
        /* no-op */
    }
    index(id, content, moduleId, options) {
        const entry = {
            id,
            content: options?.encrypted ? '[encrypted]' : content,
            moduleId,
            encrypted: options?.encrypted ?? false,
            tags: options?.tags ?? [],
            indexedAt: Date.now(),
            score: this.scoreRelevance(content),
        };
        this._entries.set(id, entry);
        this.state.entries = this._entries.size;
        this.state.lastIndexedAt = Date.now();
        if (!this.state.modulesIndexed.includes(moduleId)) {
            this.state.modulesIndexed.push(moduleId);
        }
    }
    search(query) {
        const lower = query.toLowerCase();
        return [...this._entries.values()]
            .filter((e) => e.content.toLowerCase().includes(lower) ||
            e.tags.some((t) => t.toLowerCase().includes(lower)))
            .sort((a, b) => b.score - a.score);
    }
    searchByTag(tag) {
        return [...this._entries.values()].filter((e) => e.tags.includes(tag));
    }
    scoreRelevance(content) {
        return Math.min(content.length / 100, 1.0);
    }
    delete(id) {
        const removed = this._entries.delete(id);
        this.state.entries = this._entries.size;
        return removed;
    }
    getState() {
        return { ...this.state, modulesIndexed: [...this.state.modulesIndexed] };
    }
    async destroy() {
        this._entries.clear();
        this.state.entries = 0;
        this.state.modulesIndexed = [];
    }
    emit(type, data) {
        if (this._bus && typeof this._bus === 'object' && this._bus !== null) {
            const b = this._bus;
            if (b.emit && typeof b.emit === 'function') {
                b.emit({
                    type,
                    data,
                    source: 'shadow-index',
                });
            }
        }
    }
}
export function createShadowIndexModule(bus) {
    return new ShadowIndex(bus);
}
//# sourceMappingURL=module.js.map