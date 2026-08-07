import type { PipelineStage, PipelineState, ProcessResult, PipelineConfig } from './types.js';
export declare const shadow_pipeline_module: {
    id: string;
    name: string;
    category: 'privacy';
    version: string;
    permissions: readonly ['data:read', 'data:write', 'events:emit'];
    description: string;
};
export declare class ShadowPipeline {
    private state;
    private _bus;
    constructor(bus?: unknown, config?: PipelineConfig);
    init(): Promise<void>;
    /**
     * Add a processing stage to the pipeline.
     * @param stage - Stage definition
     */
    addStage(stage: PipelineStage): void;
    /**
     * Remove a processing stage by ID.
     * @param stageId - ID of the stage to remove
     */
    removeStage(stageId: string): void;
    /**
     * Process data through all active pipeline stages.
     * @param data - Input data string
     * @returns Processing result with output and metadata
     */
    process(data: string): ProcessResult;
    /**
     * Get the current pipeline configuration.
     * @returns Deep-cloned pipeline state
     */
    getPipelineConfig(): PipelineState;
    /**
     * Activate the pipeline.
     */
    activate(): void;
    /**
     * Deactivate the pipeline.
     */
    deactivate(): void;
    /**
     * Check if the pipeline is active.
     * @returns Whether pipeline is active
     */
    isActive(): boolean;
    /**
     * Get the number of processed items.
     * @returns Processed count
     */
    getProcessedCount(): number;
    /**
     * Get all stage IDs in order.
     * @returns Array of stage IDs
     */
    getStageIds(): string[];
    /**
     * Get a specific stage by ID.
     * @param stageId - Stage ID
     * @returns Stage definition or undefined
     */
    getStage(stageId: string): PipelineStage | undefined;
    /**
     * Clear all stages from the pipeline.
     */
    clearStages(): void;
    destroy(): Promise<void>;
}
export declare function createShadowPipelineModule(bus?: unknown, config?: PipelineConfig): ShadowPipeline;
//# sourceMappingURL=module.d.ts.map