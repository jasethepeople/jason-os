import type { IndexEntry, ShadowIndexState } from './types.js';

export const shadow_index_module = {
  id: 'shadow-index',
  name: 'ShadowIndex',
  category: 'memory' as const,
  version: '0.1.0',
  permissions: ['storage:read', 'storage:write'] as const,
  description: 'Encrypted personal search engine across all module data',
};

export class ShadowIndex {
  private _entries: Map<string, IndexEntry> = new Map();
  private state: ShadowIndexState = {
    entries: 0,
    lastIndexedAt: null,
    modulesIndexed: [],
  };
  constructor(_bus?: unknown) {}

  async init(): Promise<void> {
    /* no-op */
  }

  index(
    id: string,
    content: string,
    moduleId: string,
    options?: { encrypted?: boolean; tags?: string[] }
  ): void {
    const entry: IndexEntry = {
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

  search(query: string): IndexEntry[] {
    const lower = query.toLowerCase();
    return [...this._entries.values()]
      .filter((e): e is IndexEntry => {
        if (e === undefined) return false;
        if (e.encrypted) {
          return e.tags.some((t) => t.toLowerCase().includes(lower));
        }
        return (
          e.content.toLowerCase().includes(lower) ||
          e.tags.some((t) => t.toLowerCase().includes(lower))
        );
      })
      .sort((a, b) => b.score - a.score);
  }

  searchByTag(tag: string): IndexEntry[] {
    return [...this._entries.values()].filter((e) => e.tags.includes(tag));
  }

  private scoreRelevance(content: string): number {
    return Math.min(content.length / 100, 1.0);
  }

  delete(id: string): boolean {
    const removed = this._entries.delete(id);
    this.state.entries = this._entries.size;
    return removed;
  }

  getState(): ShadowIndexState {
    return { ...this.state, modulesIndexed: [...this.state.modulesIndexed] };
  }

  async destroy(): Promise<void> {
    this._entries.clear();
    this.state.entries = 0;
    this.state.modulesIndexed = [];
  }

}

export function createShadowIndexModule(bus?: unknown): ShadowIndex {
  return new ShadowIndex(bus);
}
