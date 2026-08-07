import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ShadowIndex,
  createShadowIndexModule,
  shadow_index_module,
} from './module.js';
import type { IndexEntry, ShadowIndexState } from './types.js';

describe('ShadowIndex — module definition', () => {
  it('should export correct module metadata', () => {
    expect(shadow_index_module.id).toBe('shadow-index');
    expect(shadow_index_module.name).toBe('ShadowIndex');
    expect(shadow_index_module.category).toBe('memory');
    expect(shadow_index_module.version).toBe('0.1.0');
    expect(shadow_index_module.permissions).toEqual([
      'storage:read',
      'storage:write',
    ]);
    expect(shadow_index_module.description).toBe(
      'Encrypted personal search engine across all module data'
    );
  });
});

describe('ShadowIndex — construction', () => {
  it('should create instance without bus', () => {
    const si = new ShadowIndex();
    expect(si).toBeDefined();
    expect(si.getState()).toEqual({
      entries: 0,
      lastIndexedAt: null,
      modulesIndexed: [],
    });
  });

  it('should create instance with bus', () => {
    const bus = { emit: vi.fn() };
    const si = new ShadowIndex(bus);
    expect(si).toBeDefined();
  });

  it('should init without error', async () => {
    const si = new ShadowIndex();
    await expect(si.init()).resolves.toBeUndefined();
  });

  it('should create via factory', () => {
    const si = createShadowIndexModule();
    expect(si).toBeInstanceOf(ShadowIndex);
  });
});

describe('ShadowIndex — indexing', () => {
  it('should index content without options', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'hello world', 'test-module');
    const state = si.getState();
    expect(state.entries).toBe(1);
    expect(state.lastIndexedAt).not.toBeNull();
    expect(state.modulesIndexed).toContain('test-module');
  });

  it('should index encrypted content', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'secret message', 'test-module', { encrypted: true });
    const results = si.search('secret');
    expect(results[0].content).toBe('[encrypted]');
    expect(results[0].encrypted).toBe(true);
  });

  it('should index content with tags', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'important note', 'test-module', {
      tags: ['work', 'urgent'],
    });
    const results = si.searchByTag('work');
    expect(results.length).toBe(1);
    expect(results[0].tags).toContain('urgent');
  });

  it('should index multiple documents', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'first document', 'mod-a');
    si.index('doc-2', 'second document', 'mod-a');
    si.index('doc-3', 'third document', 'mod-b');
    expect(si.getState().entries).toBe(3);
    expect(si.getState().modulesIndexed).toContain('mod-a');
    expect(si.getState().modulesIndexed).toContain('mod-b');
    expect(si.getState().modulesIndexed.length).toBe(2);
  });

  it('should deduplicate module IDs in modulesIndexed', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'content', 'same-module');
    si.index('doc-2', 'more content', 'same-module');
    expect(si.getState().modulesIndexed.length).toBe(1);
  });

  it('should overwrite existing entry with same id', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'original', 'mod-a');
    si.index('doc-1', 'updated version', 'mod-b');
    expect(si.getState().entries).toBe(1);
    const results = si.search('updated');
    expect(results[0].content).toBe('updated version');
    expect(results[0].moduleId).toBe('mod-b');
  });
});

describe('ShadowIndex — search', () => {
  it('should find content by keyword', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'hello world', 'mod-a');
    si.index('doc-2', 'goodbye world', 'mod-a');
    si.index('doc-3', 'foo bar', 'mod-b');
    const results = si.search('world');
    expect(results.length).toBe(2);
  });

  it('should find content case-insensitively', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'Hello World', 'mod-a');
    const results = si.search('hello');
    expect(results.length).toBe(1);
  });

  it('should find content by tag', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'content one', 'mod-a', { tags: ['work'] });
    si.index('doc-2', 'content two', 'mod-a', { tags: ['personal'] });
    si.index('doc-3', 'content three', 'mod-b', { tags: ['work'] });
    const results = si.searchByTag('work');
    expect(results.length).toBe(2);
  });

  it('should search by tag match in tags array', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'alpha', 'mod', { tags: ['finance', 'quarterly'] });
    const results = si.search('quarterly');
    expect(results.length).toBe(1);
  });

  it('should return empty array for no matches', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'hello', 'mod');
    expect(si.search('nonexistent').length).toBe(0);
    expect(si.searchByTag('nonexistent').length).toBe(0);
  });

  it('should sort results by relevance score descending', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'short', 'mod-a');
    si.index('doc-2', 'a'.repeat(200), 'mod-a');
    const results = si.search('a');
    expect(results[0].id).toBe('doc-2');
    expect(results[1].id).toBe('doc-1');
  });

  it('should not find encrypted content by original text', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'secret password', 'mod', { encrypted: true });
    const results = si.search('secret');
    expect(results.length).toBe(0);
  });
});

describe('ShadowIndex — deletion', () => {
  it('should delete an entry', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'hello', 'mod');
    expect(si.getState().entries).toBe(1);
    const removed = si.delete('doc-1');
    expect(removed).toBe(true);
    expect(si.getState().entries).toBe(0);
  });

  it('should return false when deleting non-existent entry', () => {
    const si = new ShadowIndex();
    const removed = si.delete('nonexistent');
    expect(removed).toBe(false);
  });
});

describe('ShadowIndex — state immutability', () => {
  it('should return a copy of state', () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'hello', 'mod');
    const state1 = si.getState();
    state1.modulesIndexed.push('fake');
    expect(si.getState().modulesIndexed).not.toContain('fake');
  });
});

describe('ShadowIndex — destroy', () => {
  it('should clear all entries on destroy', async () => {
    const si = new ShadowIndex();
    si.index('doc-1', 'hello', 'mod');
    si.index('doc-2', 'world', 'mod');
    expect(si.getState().entries).toBe(2);
    await si.destroy();
    expect(si.getState().entries).toBe(0);
    expect(si.search('hello').length).toBe(0);
  });
});
