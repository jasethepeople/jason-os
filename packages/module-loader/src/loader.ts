import type { LoadedModule, LoaderOptions } from './types.js';

const DEFAULT_OPTS: LoaderOptions = {
  enableHotSwap: true,
  enableSandbox: true,
  strictPermissions: true,
  maxRetries: 3,
  retryDelayMs: 1000,
};

export class ModuleLoader {
  private _modules: Map<string, LoadedModule> = new Map();
  private _opts: LoaderOptions;
  private _listeners: Map<string, ((m: LoadedModule) => void)[]> = new Map();

  constructor(opts: Partial<LoaderOptions> = {}) {
    this._opts = { ...DEFAULT_OPTS, ...opts };
  }

  async load(
    manifest: Record<string, unknown>,
    factory: () => Promise<Record<string, unknown>>,
  ): Promise<LoadedModule> {
    // Validate manifest per spec 2.5.1
    if (!manifest?.id || typeof manifest.id !== 'string') {
      throw new Error('Invalid manifest: id required');
    }
    if (!manifest?.version || typeof manifest.version !== 'string') {
      throw new Error('Invalid manifest: version required');
    }
    if (!/^\d+\.\d+\.\d+/.test(manifest.version as string)) {
      throw new Error(`Invalid semver: ${manifest.version}`);
    }

    const id = manifest.id as string;

    if (this._modules.has(id) && !this._opts.enableHotSwap) {
      throw new Error(`Module ${id} already loaded (hot-swap disabled)`);
    }

    const existing = this._modules.get(id);
    if (existing) await this.unload(id, true);

    const mod: LoadedModule = {
      id,
      version: manifest.version as string,
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
    } catch (e) {
      mod.status = 'error';
      this._emit('error', mod);
      throw e;
    }
  }

  async unload(
    id: string,
    preserveState = false,
  ): Promise<Record<string, unknown> | null> {
    const mod = this._modules.get(id);
    if (!mod) return null;

    let state: Record<string, unknown> | null = null;
    try {
      if (mod.instance?.destroy && typeof mod.instance.destroy === 'function') {
        await mod.instance.destroy();
      }
      if (
        preserveState &&
        mod.instance?.getState &&
        typeof mod.instance.getState === 'function'
      ) {
        state = (await mod.instance.getState()) as Record<string, unknown>;
      }
    } catch {
      /* ignore cleanup errors */
    }

    this._modules.delete(id);
    this._emit('unloaded', mod);
    return state;
  }

  async hotSwap(
    id: string,
    newManifest: Record<string, unknown>,
    newFactory: () => Promise<Record<string, unknown>>,
  ): Promise<LoadedModule> {
    if (!this._opts.enableHotSwap) {
      throw new Error('Hot-swap disabled');
    }
    const state = await this.unload(id, true);
    const mod = await this.load(newManifest, newFactory);
    if (
      state &&
      mod.instance?.restoreState &&
      typeof mod.instance.restoreState === 'function'
    ) {
      await mod.instance.restoreState(state);
    }
    this._emit('swapped', mod);
    return mod;
  }

  get(id: string): LoadedModule | undefined {
    return this._modules.get(id);
  }

  getAll(): LoadedModule[] {
    return [...this._modules.values()];
  }

  isActive(id: string): boolean {
    return this._modules.get(id)?.status === 'active';
  }

  isQuarantined(id: string): boolean {
    return this._modules.get(id)?.status === 'quarantined';
  }

  get count(): number {
    return this._modules.size;
  }

  private _emit(evt: string, mod: LoadedModule): void {
    (this._listeners.get(evt) ?? []).forEach((cb) => {
      try {
        cb(mod);
      } catch {
        /* ignore listener errors */
      }
    });
  }

  on(evt: string, cb: (m: LoadedModule) => void): () => void {
    const arr = this._listeners.get(evt) ?? [];
    arr.push(cb);
    this._listeners.set(evt, arr);
    return () => {
      this._listeners.set(
        evt,
        arr.filter((x) => x !== cb),
      );
    };
  }
}

export function createModuleLoader(opts?: Partial<LoaderOptions>): ModuleLoader {
  return new ModuleLoader(opts);
}
