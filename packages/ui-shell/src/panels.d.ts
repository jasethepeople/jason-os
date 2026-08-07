import type { PanelMode } from './types.js';
interface Panel {
    id: string;
    moduleId: string;
    mode: PanelMode;
    state: Record<string, unknown>;
    visible: boolean;
}
export declare class PanelManager {
    private _panels;
    private _activeId;
    open(moduleId: string, mode?: PanelMode, initialState?: Record<string, unknown>): Panel;
    close(id: string): void;
    setMode(id: string, mode: PanelMode): void;
    setState(id: string, state: Record<string, unknown>): void;
    getActive(): Panel | null;
    getAll(): Panel[];
    getByModuleId(moduleId: string): Panel | undefined;
    persist(): string;
    restore(json: string): void;
    hide(id: string): void;
    show(id: string): void;
}
export declare function createPanelManager(): PanelManager;
export {};
//# sourceMappingURL=panels.d.ts.map