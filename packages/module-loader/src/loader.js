const DEFAULT_OPTS = {
    enableHotSwap: true,
    enableSandbox: true,
    strictPermissions: true,
    maxRetries: 3,
    retryDelayMs: 1000,
};
export class ModuleLoader {
    _modules = new Map();
    _opts;
    _listeners = new Map();
    constructor(opts = {}) {
        this._opts = { ...DEFAULT_OPTS, ...opts };
    }
    async load(manifest, factory) {
        // Validate manifest per spec 2.5.1
        if (!manifest?.id || typeof manifest.id !== 'string') {
            throw new Error('Invalid manifest: id required');
        }
        if (!manifest?.version || typeof manifest.version !== 'string') {
            throw new Error('Invalid manifest: version required');
        }
        if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
            throw new Error(`Invalid semver: ${manifest.version}`);
        }
        const id = manifest.id;
        if (this._modules.has(id) && !this._opts.enableHotSwap) {
            throw new Error(`Module ${id} already loaded (hot-swap disabled)`);
        }
        const existing = this._modules.get(id);
        if (existing)
            await this.unload(id, true);
        const mod = {
            id,
            version: manifest.version,
            status: 'loading',
            manifest,
            loadedAt: Date.now(),
        };
        this._modules.set(id, mod);
        try {
            const instance = await factory();
            if (instance?.init && typeof instance.init === 'function') {
                await instance.init();
            }
            mod.instance = instance;
            mod.status = 'active';
            this._emit('loaded', mod);
            return mod;
        }
        catch (e) {
            mod.status = 'error';
            this._emit('error', mod);
            throw e;
        }
    }
    async unload(id, preserveState = false) {
        const mod = this._modules.get(id);
        if (!mod)
            return null;
        let state = null;
        try {
            if (mod.instance?.destroy && typeof mod.instance.destroy === 'function') {
                await mod.instance.destroy();
            }
            if (preserveState &&
                mod.instance?.getState &&
                typeof mod.instance.getState === 'function') {
                state = (await mod.instance.getState());
            }
        }
        catch {
            /* ignore cleanup errors */
        }
        this._modules.delete(id);
        this._emit('unloaded', mod);
        return state;
    }
    async hotSwap(id, newManifest, newFactory) {
        if (!this._opts.enableHotSwap) {
            throw new Error('Hot-swap disabled');
        }
        const state = await this.unload(id, true);
        const mod = await this.load(newManifest, newFactory);
        if (state &&
            mod.instance?.restoreState &&
            typeof mod.instance.restoreState === 'function') {
            await mod.instance.restoreState(state);
        }
        this._emit('swapped', mod);
        return mod;
    }
    get(id) {
        return this._modules.get(id);
    }
    getAll() {
        return [...this._modules.values()];
    }
    isActive(id) {
        return this._modules.get(id)?.status === 'active';
    }
    isQuarantined(id) {
        return this._modules.get(id)?.status === 'quarantined';
    }
    get count() {
        return this._modules.size;
    }
    _emit(evt, mod) {
        (this._listeners.get(evt) ?? []).forEach((cb) => {
            try {
                cb(mod);
            }
            catch {
                /* ignore listener errors */
            }
        });
    }
    on(evt, cb) {
        const arr = this._listeners.get(evt) ?? [];
        arr.push(cb);
        this._listeners.set(evt, arr);
        return () => {
            this._listeners.set(evt, arr.filter((x) => x !== cb));
        };
    }
}
export function createModuleLoader(opts) {
    return new ModuleLoader(opts);
}
//# sourceMappingURL=loader.js.map