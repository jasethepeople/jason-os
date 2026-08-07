// ============================================================
// ShadowPipeline Module — Secure Data Processing
// Define and execute multi-stage secure data transformation pipelines
// ============================================================

import type { PipelineStage, PipelineState, ProcessResult, PipelineConfig, TransformType } from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const shadow_pipeline_module = {
  id: 'shadow-pipeline',
  name: 'ShadowPipeline',
  category: 'privacy' as const,
  version: '0.1.0',
  permissions: ['data:read', 'data:write', 'events:emit'] as const,
  description: 'Secure multi-stage data processing pipeline with encrypt, hash, anonymize, and filter transforms',
};

// ------------------------------------------------------------------
// Default stage factories
// ------------------------------------------------------------------

function applyEncrypt(data: string, _config: Record<string, unknown>): string {
  // ROT13 as a stand-in for encryption (real implementation would use crypto)
  const shift = (_config.shift as number) ?? 13;
  return data
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift) % 26) + 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift) % 26) + 97);
      }
      return char;
    })
    .join('');
}

function applyHash(data: string, _config: Record<string, unknown>): string {
  // Simple djb2 hash as a stand-in (real implementation would use crypto)
  const seed = (_config.seed as number) ?? 5381;
  let hash = seed;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function applyAnonymize(data: string, _config: Record<string, unknown>): string {
  const maskChar = (_config.maskChar as string) ?? 'X';
  const preserve = (_config.preserve as number) ?? 0;
  if (preserve === 0 || data.length <= preserve * 2) {
    return maskChar.repeat(data.length);
  }
  return (
    data.slice(0, preserve) +
    maskChar.repeat(Math.max(0, data.length - preserve * 2)) +
    data.slice(-preserve)
  );
}

function applyFilter(data: string, config: Record<string, unknown>): string {
  const blockedTerms = (config.blockedTerms as string[]) ?? [];
  let result = data;
  for (const term of blockedTerms) {
    result = result.replaceAll(term, '[FILTERED]');
  }
  return result;
}

const TRANSFORM_HANDLERS: Readonly<Record<TransformType, (data: string, config: Record<string, unknown>) => string>> = {
  encrypt: applyEncrypt,
  hash: applyHash,
  anonymize: applyAnonymize,
  filter: applyFilter,
};

// ------------------------------------------------------------------
// ShadowPipeline Implementation
// ------------------------------------------------------------------

export class ShadowPipeline {
  private state: PipelineState = {
    stages: [],
    active: false,
    processedCount: 0,
    lastProcessedAt: null,
  };

  private _bus: unknown;

  constructor(bus?: unknown, config: PipelineConfig = {}) {
    this._bus = bus;
    void this._bus;
    if (config.autoActivate) {
      this.state.active = true;
    }
  }

  async init(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Add a processing stage to the pipeline.
   * @param stage - Stage definition
   */
  addStage(stage: PipelineStage): void {
    if (this.state.stages.some((s) => s.id === stage.id)) {
      throw new Error(`Stage with id "${stage.id}" already exists`);
    }
    this.state.stages.push({ ...stage });
  }

  /**
   * Remove a processing stage by ID.
   * @param stageId - ID of the stage to remove
   */
  removeStage(stageId: string): void {
    const idx = this.state.stages.findIndex((s) => s.id === stageId);
    if (idx === -1) {
      throw new Error(`Stage with id "${stageId}" not found`);
    }
    this.state.stages.splice(idx, 1);
  }

  /**
   * Process data through all active pipeline stages.
   * @param data - Input data string
   * @returns Processing result with output and metadata
   */
  process(data: string): ProcessResult {
    if (!this.state.active) {
      return {
        data,
        stagesApplied: [],
        success: false,
        processedAt: Date.now(),
        error: 'Pipeline is not active',
      };
    }

    if (this.state.stages.length === 0) {
      this.state.processedCount++;
      this.state.lastProcessedAt = Date.now();
      return {
        data,
        stagesApplied: [],
        success: true,
        processedAt: this.state.lastProcessedAt,
      };
    }

    let current = data;
    const applied: string[] = [];

    try {
      for (const stage of this.state.stages) {
        const handler = TRANSFORM_HANDLERS[stage.transform];
        if (!handler) {
          throw new Error(`Unknown transform type: ${stage.transform}`);
        }
        current = handler(current, stage.config);
        applied.push(stage.id);
      }

      this.state.processedCount++;
      this.state.lastProcessedAt = Date.now();

      return {
        data: current,
        stagesApplied: applied,
        success: true,
        processedAt: this.state.lastProcessedAt,
      };
    } catch (error) {
      return {
        data,
        stagesApplied: applied,
        success: false,
        processedAt: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the current pipeline configuration.
   * @returns Deep-cloned pipeline state
   */
  getPipelineConfig(): PipelineState {
    return {
      stages: this.state.stages.map((s) => ({ ...s, config: { ...s.config } })),
      active: this.state.active,
      processedCount: this.state.processedCount,
      lastProcessedAt: this.state.lastProcessedAt,
    };
  }

  /**
   * Activate the pipeline.
   */
  activate(): void {
    this.state.active = true;
  }

  /**
   * Deactivate the pipeline.
   */
  deactivate(): void {
    this.state.active = false;
  }

  /**
   * Check if the pipeline is active.
   * @returns Whether pipeline is active
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Get the number of processed items.
   * @returns Processed count
   */
  getProcessedCount(): number {
    return this.state.processedCount;
  }

  /**
   * Get all stage IDs in order.
   * @returns Array of stage IDs
   */
  getStageIds(): string[] {
    return this.state.stages.map((s) => s.id);
  }

  /**
   * Get a specific stage by ID.
   * @param stageId - Stage ID
   * @returns Stage definition or undefined
   */
  getStage(stageId: string): PipelineStage | undefined {
    const stage = this.state.stages.find((s) => s.id === stageId);
    return stage ? { ...stage, config: { ...stage.config } } : undefined;
  }

  /**
   * Clear all stages from the pipeline.
   */
  clearStages(): void {
    this.state.stages = [];
  }

  async destroy(): Promise<void> {
    this.state = {
      stages: [],
      active: false,
      processedCount: 0,
      lastProcessedAt: null,
    };
    this._bus = undefined;
    return Promise.resolve();
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createShadowPipelineModule(bus?: unknown, config?: PipelineConfig): ShadowPipeline {
  return new ShadowPipeline(bus, config);
}
