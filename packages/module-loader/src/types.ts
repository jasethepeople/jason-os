export interface LoadedModule {
  id: string;
  version: string;
  status: 'loading' | 'active' | 'disabled' | 'quarantined' | 'error';
  manifest: Record<string, unknown>;
  instance?: Record<string, unknown>;
  sandbox?: Sandbox;
  loadedAt: number;
}

export interface LoaderOptions {
  enableHotSwap: boolean;
  enableSandbox: boolean;
  strictPermissions: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export interface SandboxPermissions {
  file: boolean;
  network: boolean;
  storage: boolean;
  telemetry: boolean;
  clipboard: boolean;
  filesystem: boolean;
  llm: boolean;
  notifications: boolean;
}

export class Sandbox {
  private _perms: SandboxPermissions;
  private _breaches: string[] = [];
  private _quarantined = false;
  private _breachThreshold = 3;

  constructor(perms: Partial<SandboxPermissions> = {}) {
    this._perms = {
      file: false,
      network: false,
      storage: true,
      telemetry: false,
      clipboard: false,
      filesystem: false,
      llm: false,
      notifications: false,
      ...perms,
    };
  }

  check(action: keyof SandboxPermissions): boolean {
    const allowed = this._perms[action];
    if (!allowed) {
      this._breaches.push(`Denied ${action} at ${new Date().toISOString()}`);
      if (this._breaches.length >= this._breachThreshold) {
        this._quarantined = true;
      }
    }
    return allowed;
  }

  getBreaches(): readonly string[] {
    return [...this._breaches];
  }

  isQuarantined(): boolean {
    return this._quarantined;
  }

  quarantine(): void {
    this._quarantined = true;
  }

  reset(): void {
    this._breaches = [];
    this._quarantined = false;
  }

  getPermissions(): SandboxPermissions {
    return { ...this._perms };
  }
}

export function createSandbox(perms?: Partial<SandboxPermissions>): Sandbox {
  return new Sandbox(perms);
}
