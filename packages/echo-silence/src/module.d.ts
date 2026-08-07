import type { SilenceState } from './types.js';
export declare const echo_silence_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['timer', 'audio', 'telemetry:read'];
    description: string;
};
export declare class EchoSilence {
    private state;
    private _bus;
    private _timer;
    constructor(bus?: unknown);
    init(): Promise<void>;
    startSession(ambientLevel?: SilenceState['ambientLevel']): void;
    recordBreath(): void;
    endSession(): void;
    private updateStreak;
    getState(): SilenceState;
    destroy(): Promise<void>;
    private emit;
}
export declare function createEchoSilenceModule(bus?: unknown): EchoSilence;
//# sourceMappingURL=module.d.ts.map