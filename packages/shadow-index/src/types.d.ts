export interface IndexEntry {
    id: string;
    content: string;
    moduleId: string;
    encrypted: boolean;
    tags: string[];
    indexedAt: number;
    score: number;
}
export interface ShadowIndexState {
    entries: number;
    lastIndexedAt: number | null;
    modulesIndexed: string[];
}
//# sourceMappingURL=types.d.ts.map