export class PanelManager {
    _panels = new Map();
    _activeId = null;
    open(moduleId, mode = 'tabbed', initialState = {}) {
        const id = `${moduleId}-${Date.now()}`;
        const p = { id, moduleId, mode, state: initialState, visible: true };
        this._panels.set(id, p);
        this._activeId = id;
        return p;
    }
    close(id) {
        this._panels.delete(id);
        if (this._activeId === id)
            this._activeId = null;
    }
    setMode(id, mode) {
        const p = this._panels.get(id);
        if (p)
            p.mode = mode;
    }
    setState(id, state) {
        const p = this._panels.get(id);
        if (p)
            p.state = { ...p.state, ...state };
    }
    getActive() {
        return this._activeId ? (this._panels.get(this._activeId) ?? null) : null;
    }
    getAll() {
        return [...this._panels.values()];
    }
    getByModuleId(moduleId) {
        return [...this._panels.values()].find((p) => p.moduleId === moduleId);
    }
    persist() {
        return JSON.stringify([...this._panels.values()]);
    }
    restore(json) {
        try {
            const arr = JSON.parse(json);
            arr.forEach((p) => this._panels.set(p.id, p));
        }
        catch {
            /* ignore parse errors */
        }
    }
    hide(id) {
        const p = this._panels.get(id);
        if (p)
            p.visible = false;
    }
    show(id) {
        const p = this._panels.get(id);
        if (p)
            p.visible = true;
    }
}
export function createPanelManager() {
    return new PanelManager();
}
//# sourceMappingURL=panels.js.map