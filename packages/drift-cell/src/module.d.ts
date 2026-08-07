import type { DriftState, DriftCellConfig } from './types.js';
export declare const drift_cell_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['telemetry:read', 'storage:write', 'events:emit'];
    description: string;
};
export declare class DriftCell {
    private state;
    private config;
    private _bus;
    constructor(bus?: unknown, config?: Partial<DriftCellConfig>);
    init(): Promise<void>;
    process(telemetry: {
        valence: number;
        arousal: number;
        focus: number;
    }): void;
    handleDrift(data: unknown): void;
    offerGrounding(): {
        technique: string;
        prompt: string;
    };
    getState(): DriftState;
    destroy(): Promise<void>;
    private emit;
}
export declare function createDriftCellModule(bus?: unknown, config?: Partial<DriftCellConfig>): DriftCell;
//# sourceMappingURL=module.d.ts.map