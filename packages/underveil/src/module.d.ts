import type { Veil, UnderveilState } from './types.js';
export declare const underveil_module: {
    id: string;
    name: string;
    category: 'communication';
    version: string;
    permissions: readonly ['identity:read', 'storage:write'];
    description: string;
};
export declare class Underveil {
    private state;
    private _bus;
    constructor(bus?: unknown);
    init(): Promise<void>;
    giveConsent(): void;
    revokeConsent(): void;
    createVeil(label: string): Veil;
    activateVeil(id: string): void;
    getActiveVeil(): Veil | null;
    getState(): UnderveilState;
    destroy(): Promise<void>;
    private emit;
}
export declare function createUnderveilModule(bus?: unknown): Underveil;
//# sourceMappingURL=module.d.ts.map