export class SidebarManager {
    _items = new Map();
    _pinned = new Set();
    add(item) {
        this._items.set(item.id, item);
        if (item.pinned)
            this._pinned.add(item.id);
    }
    remove(id) {
        this._items.delete(id);
        this._pinned.delete(id);
    }
    pin(id) {
        this._pinned.add(id);
        const i = this._items.get(id);
        if (i)
            i.pinned = true;
    }
    unpin(id) {
        this._pinned.delete(id);
        const i = this._items.get(id);
        if (i)
            i.pinned = false;
    }
    reorder(ids) {
        ids.forEach((id, idx) => {
            const it = this._items.get(id);
            if (it)
                it.order = idx;
        });
    }
    getTree() {
        return [...this._items.values()]
            .sort((a, b) => a.order - b.order)
            .map((i) => ({
            ...i,
            ...(i.children ? { children: i.children.sort((a, b) => a.order - b.order) } : {}),
        }));
    }
    getPinned() {
        return [...this._pinned]
            .map((id) => this._items.get(id))
            .filter(Boolean)
            .sort((a, b) => a.order - b.order);
    }
    getByModuleId(moduleId) {
        return [...this._items.values()].find((i) => i.moduleId === moduleId);
    }
    has(id) {
        return this._items.has(id);
    }
    count() {
        return this._items.size;
    }
}
export function createSidebar() {
    return new SidebarManager();
}
//# sourceMappingURL=sidebar.js.map