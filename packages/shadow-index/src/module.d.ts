import type { IndexEntry, ShadowIndexState } from './types.js';
export declare const shadow_index_module: {
    id: string;
    name: string;
    category: 'memory';
    version: string;
    permissions: readonly ['storage:read', 'storage:write'];
    description: string;
};
export declare class ShadowIndex {
    private _entries;
    private state;
    private _bus;
    constructor(bus?: unknown);
    init(): Promise<void>;
    index(id: string, content: string, moduleId: string, options?: {
        encrypted?: boolean;
        tags?: string[];
    }): void;
    search(query: string): IndexEntry[];
    searchByTag(tag: string): IndexEntry[];
    private scoreRelevance;
    delete(id: string): boolean;
    getState(): ShadowIndexState;
    destroy(): Promise<void>;
    private emit;
}
export declare function createShadowIndexModule(bus?: unknown): ShadowIndex;
//# sourceMappingURL=module.d.ts.map