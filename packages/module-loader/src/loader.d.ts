import type { LoadedModule, LoaderOptions } from './types.js';
export declare class ModuleLoader {
    private _modules;
    private _opts;
    private _listeners;
    constructor(opts?: Partial<LoaderOptions>);
    load(manifest: Record<string, unknown>, factory: () => Promise<Record<string, unknown>>): Promise<LoadedModule>;
    unload(id: string, preserveState?: boolean): Promise<Record<string, unknown> | null>;
    hotSwap(id: string, newManifest: Record<string, unknown>, newFactory: () => Promise<Record<string, unknown>>): Promise<LoadedModule>;
    get(id: string): LoadedModule | undefined;
    getAll(): LoadedModule[];
    isActive(id: string): boolean;
    isQuarantined(id: string): boolean;
    get count(): number;
    private _emit;
    on(evt: string, cb: (m: LoadedModule) => void): () => void;
}
export declare function createModuleLoader(opts?: Partial<LoaderOptions>): ModuleLoader;
//# sourceMappingURL=loader.d.ts.map