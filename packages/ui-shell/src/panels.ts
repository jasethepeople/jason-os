import type { PanelMode } from './types.js';

interface Panel {
  id: string;
  moduleId: string;
  mode: PanelMode;
  state: Record<string, unknown>;
  visible: boolean;
}

export class PanelManager {
  private _panels: Map<string, Panel> = new Map();
  private _activeId: string | null = null;

  open(
    moduleId: string,
    mode: PanelMode = 'tabbed',
    initialState: Record<string, unknown> = {},
  ): Panel {
    const id = `${moduleId}-${Date.now()}`;
    const p: Panel = { id, moduleId, mode, state: initialState, visible: true };
    this._panels.set(id, p);
    this._activeId = id;
    return p;
  }

  close(id: string): void {
    this._panels.delete(id);
    if (this._activeId === id) this._activeId = null;
  }

  setMode(id: string, mode: PanelMode): void {
    const p = this._panels.get(id);
    if (p) p.mode = mode;
  }

  setState(id: string, state: Record<string, unknown>): void {
    const p = this._panels.get(id);
    if (p) p.state = { ...p.state, ...state };
  }

  getActive(): Panel | null {
    return this._activeId ? (this._panels.get(this._activeId) ?? null) : null;
  }

  getAll(): Panel[] {
    return [...this._panels.values()];
  }

  getByModuleId(moduleId: string): Panel | undefined {
    return [...this._panels.values()].find((p) => p.moduleId === moduleId);
  }

  persist(): string {
    return JSON.stringify([...this._panels.values()]);
  }

  restore(json: string): void {
    try {
      const arr = JSON.parse(json) as Panel[];
      arr.forEach((p) => this._panels.set(p.id, p));
    } catch {
      /* ignore parse errors */
    }
  }

  hide(id: string): void {
    const p = this._panels.get(id);
    if (p) p.visible = false;
  }

  show(id: string): void {
    const p = this._panels.get(id);
    if (p) p.visible = true;
  }
}

export function createPanelManager(): PanelManager {
  return new PanelManager();
}
