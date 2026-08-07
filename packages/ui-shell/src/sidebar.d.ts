import type { SidebarItem } from './types.js';
export declare class SidebarManager {
    private _items;
    private _pinned;
    add(item: SidebarItem): void;
    remove(id: string): void;
    pin(id: string): void;
    unpin(id: string): void;
    reorder(ids: string[]): void;
    getTree(): SidebarItem[];
    getPinned(): SidebarItem[];
    getByModuleId(moduleId: string): SidebarItem | undefined;
    has(id: string): boolean;
    count(): number;
}
export declare function createSidebar(): SidebarManager;
//# sourceMappingURL=sidebar.d.ts.map