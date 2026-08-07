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
export declare class Sandbox {
    private _perms;
    private _breaches;
    private _quarantined;
    private _breachThreshold;
    constructor(perms?: Partial<SandboxPermissions>);
    check(action: keyof SandboxPermissions): boolean;
    getBreaches(): readonly string[];
    isQuarantined(): boolean;
    quarantine(): void;
    reset(): void;
    getPermissions(): SandboxPermissions;
}
export declare function createSandbox(perms?: Partial<SandboxPermissions>): Sandbox;
//# sourceMappingURL=types.d.ts.map