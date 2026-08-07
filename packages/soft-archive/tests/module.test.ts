import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoftArchive } from '../src/module';
import type { ArchiveEventBus } from '../src/module';
import type { SoftArchiveEvents } from '../src/types';

describe('SoftArchive', () => {
  let archive: SoftArchive;
  let mockBus: ArchiveEventBus;
  let emittedEvents: Array<{ event: keyof SoftArchiveEvents; payload: SoftArchiveEvents[keyof SoftArchiveEvents] }>;

  beforeEach(() => {
    vi.useFakeTimers();
    emittedEvents = [];
    mockBus = {
      emit: vi.fn(<K extends keyof SoftArchiveEvents>(event: K, payload: SoftArchiveEvents[K]) => {
        emittedEvents.push({ event, payload });
      }),
    };
    archive = new SoftArchive({ bus: mockBus });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('archive', () => {
    it('should archive an item with all fields', () => {
      const item = archive.archive('Hello world', 'module-a', 'joyful', 2.5);
      expect(item.id).toBeDefined();
      expect(item.content).toBe('Hello world');
      expect(item.moduleId).toBe('module-a');
      expect(item.emotionalTag).toBe('joyful');
      expect(item.importance).toBe(2.5);
      expect(item.accessCount).toBe(0);
      expect(item.archivedAt).toBeGreaterThan(0);
    });

    it('should use defaults when optional fields omitted', () => {
      const item = archive.archive('Hello world', 'module-b');
      expect(item.emotionalTag).toBeNull();
      expect(item.importance).toBe(1.0);
    });

    it('should emit archive event', () => {
      const item = archive.archive('Hello world', 'module-c');
      expect(mockBus.emit).toHaveBeenCalledTimes(1);
      expect(emittedEvents[0].event).toBe('archive:item-archived');
      expect(emittedEvents[0].payload.itemId).toBe(item.id);
      expect(emittedEvents[0].payload.moduleId).toBe('module-c');
    });

    it('should generate unique IDs', () => {
      const i1 = archive.archive('a', 'm1');
      const i2 = archive.archive('b', 'm1');
      expect(i1.id).not.toBe(i2.id);
    });
  });

  describe('retrieve', () => {
    it('should retrieve an item by ID', () => {
      const item = archive.archive('Hello world', 'module-a');
      const retrieved = archive.retrieve(item.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe('Hello world');
    });

    it('should increment access count on retrieve', () => {
      const item = archive.archive('Hello world', 'module-a');
      archive.retrieve(item.id);
      archive.retrieve(item.id);
      const retrieved = archive.retrieve(item.id);
      expect(retrieved?.accessCount).toBe(3);
    });

    it('should return null for unknown ID', () => {
      const retrieved = archive.retrieve('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('searchByEmotion', () => {
    it('should find items by emotional tag', () => {
      archive.archive('Happy day', 'm1', 'joyful');
      archive.archive('Sad moment', 'm1', 'melancholy');
      archive.archive('Another happy day', 'm1', 'joyful');

      const results = archive.searchByEmotion('joyful');
      expect(results).toHaveLength(2);
      expect(results[0]?.item.emotionalTag).toBe('joyful');
    });

    it('should be case-insensitive', () => {
      archive.archive('Happy day', 'm1', 'Joyful');
      const results = archive.searchByEmotion('joyful');
      expect(results).toHaveLength(1);
    });

    it('should sort by relevance score descending', () => {
      const i1 = archive.archive('First', 'm1', 'joyful', 5.0);
      archive.retrieve(i1.id);
      archive.archive('Second', 'm1', 'joyful', 1.0);

      const results = archive.searchByEmotion('joyful');
      expect(results[0]?.item.id).toBe(i1.id);
      expect(results[0]?.relevanceScore).toBeGreaterThan(results[1]?.relevanceScore ?? 0);
    });

    it('should return empty array for no matches', () => {
      archive.archive('Hello', 'm1', 'joyful');
      const results = archive.searchByEmotion('nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('autoArchive', () => {
    it('should reduce importance of old items', () => {
      archive.archive('Old item', 'm1', null, 1.0);
      const results = archive.autoArchive(-1); // Force all items to be "old"
      expect(archive.size()).toBe(1); // Still there, importance reduced
    });

    it('should remove items below importance threshold', () => {
      const item = archive.archive('Old item', 'm1', null, 0.01);
      vi.advanceTimersByTime(1000);
      archive.autoArchive(0); // Immediate aging
      expect(archive.retrieve(item.id)).toBeNull();
    });

    it('should return empty when auto-archive disabled', () => {
      const disabled = new SoftArchive({ autoArchiveEnabled: false });
      disabled.archive('Item', 'm1');
      const results = disabled.autoArchive(0);
      expect(results).toEqual([]);
    });

    it('should return IDs of removed items', () => {
      const i1 = archive.archive('Very old', 'm1', null, 0.01);
      const ids = archive.autoArchive(0);
      expect(ids).toContain(i1.id);
    });
  });

  describe('getImportanceScore', () => {
    it('should return null for unknown ID', () => {
      expect(archive.getImportanceScore('nonexistent')).toBeNull();
    });

    it('should return base importance for unaccessed item', () => {
      const item = archive.archive('Hello', 'm1', null, 2.0);
      const score = archive.getImportanceScore(item.id);
      expect(score).not.toBeNull();
      expect(score).toBeGreaterThan(0);
    });

    it('should increase with access count', () => {
      const item = archive.archive('Hello', 'm1', null, 1.0);
      const before = archive.getImportanceScore(item.id) ?? 0;
      archive.retrieve(item.id);
      archive.retrieve(item.id);
      archive.retrieve(item.id);
      const after = archive.getImportanceScore(item.id) ?? 0;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = archive.getState();
      expect(state.items).toEqual([]);
      expect(state.totalArchived).toBe(0);
      expect(state.lastArchivedAt).toBeNull();
      expect(state.autoArchiveEnabled).toBe(true);
    });

    it('should reflect archived items', () => {
      archive.archive('Hello', 'm1');
      archive.archive('World', 'm1');
      const state = archive.getState();
      expect(state.items).toHaveLength(2);
      expect(state.totalArchived).toBe(2);
      expect(state.lastArchivedAt).not.toBeNull();
    });
  });

  describe('getItems', () => {
    it('should return all items when no filter', () => {
      archive.archive('a', 'm1');
      archive.archive('b', 'm2');
      const items = archive.getItems();
      expect(items).toHaveLength(2);
    });

    it('should filter by module ID', () => {
      archive.archive('a', 'm1');
      archive.archive('b', 'm2');
      archive.archive('c', 'm1');
      const items = archive.getItems('m1');
      expect(items).toHaveLength(2);
      expect(items.every((i) => i.moduleId === 'm1')).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove an item', () => {
      const item = archive.archive('Hello', 'm1');
      expect(archive.remove(item.id)).toBe(true);
      expect(archive.retrieve(item.id)).toBeNull();
    });

    it('should return false for unknown ID', () => {
      expect(archive.remove('nonexistent')).toBe(false);
    });
  });

  describe('setEmotionalTag', () => {
    it('should update emotional tag', () => {
      const item = archive.archive('Hello', 'm1', 'old-tag');
      const updated = archive.setEmotionalTag(item.id, 'new-tag');
      expect(updated?.emotionalTag).toBe('new-tag');
    });

    it('should set tag to null', () => {
      const item = archive.archive('Hello', 'm1', 'tag');
      const updated = archive.setEmotionalTag(item.id, null);
      expect(updated?.emotionalTag).toBeNull();
    });

    it('should return null for unknown ID', () => {
      expect(archive.setEmotionalTag('nonexistent', 'tag')).toBeNull();
    });
  });

  describe('setImportance', () => {
    it('should update importance', () => {
      const item = archive.archive('Hello', 'm1', null, 1.0);
      const updated = archive.setImportance(item.id, 5.0);
      expect(updated?.importance).toBe(5.0);
    });

    it('should not allow negative importance', () => {
      const item = archive.archive('Hello', 'm1', null, 1.0);
      const updated = archive.setImportance(item.id, -1);
      expect(updated?.importance).toBe(0);
    });

    it('should return null for unknown ID', () => {
      expect(archive.setImportance('nonexistent', 1)).toBeNull();
    });
  });

  describe('searchByContent', () => {
    it('should find items by content substring', () => {
      archive.archive('Hello world today', 'm1');
      archive.archive('Goodbye world', 'm1');
      archive.archive('Something else', 'm1');

      const results = archive.searchByContent('world');
      expect(results).toHaveLength(2);
    });

    it('should be case-insensitive', () => {
      archive.archive('HELLO WORLD', 'm1');
      const results = archive.searchByContent('hello');
      expect(results).toHaveLength(1);
    });

    it('should return empty for no matches', () => {
      archive.archive('Hello', 'm1');
      const results = archive.searchByContent('xyz');
      expect(results).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      archive.archive('a', 'm1');
      archive.archive('b', 'm2');
      archive.clear();
      expect(archive.size()).toBe(0);
      expect(archive.getState().items).toEqual([]);
    });

    it('should reset lastArchivedAt', () => {
      archive.archive('a', 'm1');
      archive.clear();
      expect(archive.getState().lastArchivedAt).toBeNull();
    });
  });

  describe('size', () => {
    it('should return 0 for empty archive', () => {
      expect(archive.size()).toBe(0);
    });

    it('should return correct count', () => {
      archive.archive('a', 'm1');
      archive.archive('b', 'm2');
      expect(archive.size()).toBe(2);
    });
  });
});
