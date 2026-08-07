import type { SidebarItem } from './types.js';

export class SidebarManager {
  private _items: Map<string, SidebarItem> = new Map();
  private _pinned: Set<string> = new Set();

  add(item: SidebarItem): void {
    this._items.set(item.id, item);
    if (item.pinned) this._pinned.add(item.id);
  }

  remove(id: string): void {
    this._items.delete(id);
    this._pinned.delete(id);
  }

  pin(id: string): void {
    this._pinned.add(id);
    const i = this._items.get(id);
    if (i) i.pinned = true;
  }

  unpin(id: string): void {
    this._pinned.delete(id);
    const i = this._items.get(id);
    if (i) i.pinned = false;
  }

  reorder(ids: string[]): void {
    ids.forEach((id, idx) => {
      const it = this._items.get(id);
      if (it) it.order = idx;
    });
  }

  getTree(): SidebarItem[] {
    return [...this._items.values()]
      .sort((a, b) => a.order - b.order)
      .map((i) => ({
        ...i,
        ...(i.children ? { children: i.children.sort((a, b) => a.order - b.order) } : {}),
      }));
  }

  getPinned(): SidebarItem[] {
    return [...this._pinned]
      .map((id) => this._items.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
  }

  getByModuleId(moduleId: string): SidebarItem | undefined {
    return [...this._items.values()].find((i) => i.moduleId === moduleId);
  }

  has(id: string): boolean {
    return this._items.has(id);
  }

  count(): number {
    return this._items.size;
  }
}

export function createSidebar(): SidebarManager {
  return new SidebarManager();
}
