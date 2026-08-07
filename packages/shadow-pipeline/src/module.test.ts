// ============================================================
// ShadowPipeline — Test Suite
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShadowPipeline,
  createShadowPipelineModule,
  shadow_pipeline_module,
} from './module.js';
import type { PipelineState } from './types.js';

describe('ShadowPipeline', () => {
  let pipeline: ShadowPipeline;

  beforeEach(() => {
    pipeline = new ShadowPipeline();
    pipeline.activate();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const fresh = new ShadowPipeline();
    const state = fresh.getPipelineConfig();
    expect(state.stages).toEqual([]);
    expect(state.active).toBe(false);
    expect(state.processedCount).toBe(0);
    expect(state.lastProcessedAt).toBeNull();
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(pipeline.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. autoActivate config activates on creation
  // ----------------------------------------------------------------
  it('autoActivate config activates on creation', () => {
    const auto = new ShadowPipeline(undefined, { autoActivate: true });
    expect(auto.isActive()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 4. addStage adds a stage to the pipeline
  // ----------------------------------------------------------------
  it('addStage adds a stage to the pipeline', () => {
    pipeline.addStage({
      id: 'stage-1',
      name: 'Encrypt',
      transform: 'encrypt',
      config: {},
    });
    expect(pipeline.getStageIds()).toEqual(['stage-1']);
  });

  // ----------------------------------------------------------------
  // 5. addStage throws on duplicate ID
  // ----------------------------------------------------------------
  it('addStage throws on duplicate ID', () => {
    pipeline.addStage({
      id: 'stage-1',
      name: 'Encrypt',
      transform: 'encrypt',
      config: {},
    });
    expect(() =>
      pipeline.addStage({
        id: 'stage-1',
        name: 'Hash',
        transform: 'hash',
        config: {},
      })
    ).toThrow('Stage with id "stage-1" already exists');
  });

  // ----------------------------------------------------------------
  // 6. removeStage removes a stage
  // ----------------------------------------------------------------
  it('removeStage removes a stage', () => {
    pipeline.addStage({
      id: 'stage-1',
      name: 'Encrypt',
      transform: 'encrypt',
      config: {},
    });
    pipeline.removeStage('stage-1');
    expect(pipeline.getStageIds()).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 7. removeStage throws for non-existent stage
  // ----------------------------------------------------------------
  it('removeStage throws for non-existent stage', () => {
    expect(() => pipeline.removeStage('missing')).toThrow(
      'Stage with id "missing" not found'
    );
  });

  // ----------------------------------------------------------------
  // 8. process applies encrypt transform
  // ----------------------------------------------------------------
  it('process applies encrypt transform', () => {
    pipeline.addStage({
      id: 'enc',
      name: 'Encrypt',
      transform: 'encrypt',
      config: {},
    });
    const result = pipeline.process('Hello');
    expect(result.success).toBe(true);
    expect(result.data).toBe('Uryyb');
    expect(result.stagesApplied).toEqual(['enc']);
  });

  // ----------------------------------------------------------------
  // 9. process applies hash transform
  // ----------------------------------------------------------------
  it('process applies hash transform', () => {
    pipeline.addStage({
      id: 'hash',
      name: 'Hash',
      transform: 'hash',
      config: {},
    });
    const result = pipeline.process('test');
    expect(result.success).toBe(true);
    expect(result.data).toMatch(/^[0-9a-f]{8}$/);
  });

  // ----------------------------------------------------------------
  // 10. process applies anonymize transform
  // ----------------------------------------------------------------
  it('process applies anonymize transform', () => {
    pipeline.addStage({
      id: 'anon',
      name: 'Anonymize',
      transform: 'anonymize',
      config: { preserve: 2 },
    });
    const result = pipeline.process('sensitive-data');
    expect(result.success).toBe(true);
    expect(result.data).toBe('seXXXXXXXXXXta');
  });

  // ----------------------------------------------------------------
  // 11. process applies filter transform
  // ----------------------------------------------------------------
  it('process applies filter transform', () => {
    pipeline.addStage({
      id: 'filter',
      name: 'Filter',
      transform: 'filter',
      config: { blockedTerms: ['bad', 'worse'] },
    });
    const result = pipeline.process('This is bad and worse');
    expect(result.success).toBe(true);
    expect(result.data).toBe('This is [FILTERED] and [FILTERED]');
  });

  // ----------------------------------------------------------------
  // 12. process chains multiple stages
  // ----------------------------------------------------------------
  it('process chains multiple stages', () => {
    pipeline.addStage({
      id: 'enc',
      name: 'Encrypt',
      transform: 'encrypt',
      config: {},
    });
    pipeline.addStage({
      id: 'hash',
      name: 'Hash',
      transform: 'hash',
      config: {},
    });
    const result = pipeline.process('Hi');
    expect(result.success).toBe(true);
    expect(result.stagesApplied).toEqual(['enc', 'hash']);
    // First encrypted to 'Uv', then hashed
    expect(result.data).not.toBe('Hi');
  });

  // ----------------------------------------------------------------
  // 13. process fails when pipeline inactive
  // ----------------------------------------------------------------
  it('process fails when pipeline inactive', () => {
    pipeline.deactivate();
    const result = pipeline.process('test');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Pipeline is not active');
  });

  // ----------------------------------------------------------------
  // 14. process succeeds with no stages
  // ----------------------------------------------------------------
  it('process succeeds with no stages', () => {
    const result = pipeline.process('test');
    expect(result.success).toBe(true);
    expect(result.data).toBe('test');
    expect(result.stagesApplied).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 15. getPipelineConfig returns deep clone
  // ----------------------------------------------------------------
  it('getPipelineConfig returns deep clone', () => {
    pipeline.addStage({
      id: 'stage-1',
      name: 'Encrypt',
      transform: 'encrypt',
      config: { key: 'value' },
    });
    const config1: PipelineState = pipeline.getPipelineConfig();
    pipeline.addStage({
      id: 'stage-2',
      name: 'Hash',
      transform: 'hash',
      config: {},
    });
    const config2: PipelineState = pipeline.getPipelineConfig();
    expect(config1.stages.length).toBe(1);
    expect(config2.stages.length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 16. activate/deactivate toggle
  // ----------------------------------------------------------------
  it('activate/deactivate toggle', () => {
    expect(pipeline.isActive()).toBe(true);
    pipeline.deactivate();
    expect(pipeline.isActive()).toBe(false);
    pipeline.activate();
    expect(pipeline.isActive()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 17. getProcessedCount increments on successful process
  // ----------------------------------------------------------------
  it('getProcessedCount increments on successful process', () => {
    expect(pipeline.getProcessedCount()).toBe(0);
    pipeline.process('test');
    expect(pipeline.getProcessedCount()).toBe(1);
    pipeline.process('another');
    expect(pipeline.getProcessedCount()).toBe(2);
  });

  // ----------------------------------------------------------------
  // 18. getStage returns a stage by ID
  // ----------------------------------------------------------------
  it('getStage returns a stage by ID', () => {
    pipeline.addStage({
      id: 'stage-1',
      name: 'Encrypt',
      transform: 'encrypt',
      config: { key: 'value' },
    });
    const stage = pipeline.getStage('stage-1');
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('stage-1');
    expect(stage!.name).toBe('Encrypt');
    expect(stage!.transform).toBe('encrypt');
    expect(stage!.config).toEqual({ key: 'value' });
  });

  // ----------------------------------------------------------------
  // 19. getStage returns undefined for unknown ID
  // ----------------------------------------------------------------
  it('getStage returns undefined for unknown ID', () => {
    expect(pipeline.getStage('missing')).toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 20. clearStages removes all stages
  // ----------------------------------------------------------------
  it('clearStages removes all stages', () => {
    pipeline.addStage({ id: 's1', name: 'A', transform: 'encrypt', config: {} });
    pipeline.addStage({ id: 's2', name: 'B', transform: 'hash', config: {} });
    pipeline.clearStages();
    expect(pipeline.getStageIds()).toEqual([]);
  });

  // ----------------------------------------------------------------
  // 21. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    pipeline.addStage({ id: 's1', name: 'A', transform: 'encrypt', config: {} });
    pipeline.process('test');
    await pipeline.destroy();
    const state = pipeline.getPipelineConfig();
    expect(state.stages).toEqual([]);
    expect(state.active).toBe(false);
    expect(state.processedCount).toBe(0);
    expect(state.lastProcessedAt).toBeNull();
  });

  // ----------------------------------------------------------------
  // 22. encrypt with custom shift
  // ----------------------------------------------------------------
  it('encrypt with custom shift', () => {
    pipeline.addStage({
      id: 'enc',
      name: 'Encrypt',
      transform: 'encrypt',
      config: { shift: 1 },
    });
    const result = pipeline.process('ABC');
    expect(result.data).toBe('BCD');
  });

  // ----------------------------------------------------------------
  // 23. hash is deterministic
  // ----------------------------------------------------------------
  it('hash is deterministic', () => {
    pipeline.addStage({
      id: 'hash',
      name: 'Hash',
      transform: 'hash',
      config: {},
    });
    const r1 = pipeline.process('same');
    const r2 = pipeline.process('same');
    expect(r1.data).toBe(r2.data);
  });

  // ----------------------------------------------------------------
  // 24. anonymize with zero preserve masks everything
  // ----------------------------------------------------------------
  it('anonymize with zero preserve masks everything', () => {
    pipeline.addStage({
      id: 'anon',
      name: 'Anonymize',
      transform: 'anonymize',
      config: { preserve: 0, maskChar: '#' },
    });
    const result = pipeline.process('secret');
    expect(result.data).toBe('######');
  });

  // ----------------------------------------------------------------
  // 25. filter with no blocked terms returns original
  // ----------------------------------------------------------------
  it('filter with no blocked terms returns original', () => {
    pipeline.addStage({
      id: 'filter',
      name: 'Filter',
      transform: 'filter',
      config: { blockedTerms: [] },
    });
    const result = pipeline.process('nothing blocked');
    expect(result.data).toBe('nothing blocked');
  });

  // ----------------------------------------------------------------
  // 26. lastProcessedAt set after successful process
  // ----------------------------------------------------------------
  it('lastProcessedAt set after successful process', () => {
    const before = Date.now();
    pipeline.process('test');
    const after = Date.now();
    expect(pipeline.getPipelineConfig().lastProcessedAt).not.toBeNull();
    expect(pipeline.getPipelineConfig().lastProcessedAt! >= before).toBe(true);
    expect(pipeline.getPipelineConfig().lastProcessedAt! <= after).toBe(true);
  });

  // ----------------------------------------------------------------
  // 27. processedCount not incremented on inactive pipeline
  // ----------------------------------------------------------------
  it('processedCount not incremented on inactive pipeline', () => {
    pipeline.deactivate();
    pipeline.process('test');
    expect(pipeline.getProcessedCount()).toBe(0);
  });

  // ----------------------------------------------------------------
  // 28. stages maintain order
  // ----------------------------------------------------------------
  it('stages maintain order', () => {
    pipeline.addStage({ id: 's1', name: 'A', transform: 'encrypt', config: {} });
    pipeline.addStage({ id: 's2', name: 'B', transform: 'hash', config: {} });
    pipeline.addStage({ id: 's3', name: 'C', transform: 'anonymize', config: {} });
    expect(pipeline.getStageIds()).toEqual(['s1', 's2', 's3']);
  });
});

describe('createShadowPipelineModule factory', () => {
  // ----------------------------------------------------------------
  // 29. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createShadowPipelineModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(ShadowPipeline);
  });

  // ----------------------------------------------------------------
  // 30. Factory accepts bus and config parameters
  // ----------------------------------------------------------------
  it('factory accepts bus and config parameters', () => {
    const bus = { emit: () => undefined };
    const instance = createShadowPipelineModule(bus, { autoActivate: true });
    expect(instance).toBeDefined();
    expect(instance.isActive()).toBe(true);
  });
});

describe('shadow_pipeline_module metadata', () => {
  // ----------------------------------------------------------------
  // 31. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(shadow_pipeline_module.id).toBe('shadow-pipeline');
    expect(shadow_pipeline_module.name).toBe('ShadowPipeline');
    expect(shadow_pipeline_module.category).toBe('privacy');
    expect(shadow_pipeline_module.version).toBe('0.1.0');
    expect(shadow_pipeline_module.permissions).toEqual([
      'data:read',
      'data:write',
      'events:emit',
    ]);
    expect(shadow_pipeline_module.description).toBeDefined();
  });
});
