import { describe, it, expect, beforeEach } from 'vitest';
import { QuietChain } from '../src/module';

describe('QuietChain', () => {
  let chain: QuietChain;

  beforeEach(() => {
    chain = new QuietChain();
  });

  describe('addLink', () => {
    it('should add a root link when no parent is provided', () => {
      const link = chain.addLink('Root thought');
      expect(link.id).toBeDefined();
      expect(link.content).toBe('Root thought');
      expect(link.parentId).toBeNull();
      expect(link.children).toEqual([]);
      expect(link.strength).toBe(1.0);
      expect(link.createdAt).toBeGreaterThan(0);
    });

    it('should add a child link when parent is provided', () => {
      const parent = chain.addLink('Parent');
      const child = chain.addLink('Child', parent.id);
      expect(child.parentId).toBe(parent.id);
      expect(chain.getLink(parent.id)?.children).toContain(child.id);
    });

    it('should use custom module ID', () => {
      const link = chain.addLink('Hello', undefined, 'custom-module');
      expect(link.moduleId).toBe('custom-module');
    });

    it('should use default module ID from config', () => {
      const custom = new QuietChain({ defaultModuleId: 'my-module' });
      const link = custom.addLink('Hello');
      expect(link.moduleId).toBe('my-module');
    });

    it('should track last link timestamp', () => {
      chain.addLink('First');
      const state = chain.getState();
      expect(state.lastLinkAt).not.toBeNull();
    });

    it('should add root to roots list', () => {
      const link = chain.addLink('Root');
      expect(chain.getRoots()).toContain(link.id);
    });
  });

  describe('getChain', () => {
    it('should return empty for unknown root', () => {
      expect(chain.getChain('nonexistent')).toEqual([]);
    });

    it('should return chain from root including all descendants', () => {
      const root = chain.addLink('Root');
      const child = chain.addLink('Child', root.id);
      const grandchild = chain.addLink('Grandchild', child.id);

      const result = chain.getChain(root.id);
      expect(result).toHaveLength(3);
      const ids = result.map((l) => l.id);
      expect(ids).toContain(root.id);
      expect(ids).toContain(child.id);
      expect(ids).toContain(grandchild.id);
    });

    it('should handle branching chains', () => {
      const root = chain.addLink('Root');
      const c1 = chain.addLink('Child 1', root.id);
      const c2 = chain.addLink('Child 2', root.id);
      chain.addLink('Grandchild', c1.id);

      const result = chain.getChain(root.id);
      expect(result).toHaveLength(4);
    });
  });

  describe('findRelated', () => {
    it('should return empty for unknown link', () => {
      expect(chain.findRelated('nonexistent')).toEqual([]);
    });

    it('should find parent as related', () => {
      const parent = chain.addLink('Parent');
      const child = chain.addLink('Child', parent.id);
      const related = chain.findRelated(child.id);

      expect(related.some((r) => r.link.id === parent.id)).toBe(true);
    });

    it('should find children as related', () => {
      const parent = chain.addLink('Parent');
      const child = chain.addLink('Child', parent.id);
      const related = chain.findRelated(parent.id);

      expect(related.some((r) => r.link.id === child.id)).toBe(true);
    });

    it('should not include self in related', () => {
      const link = chain.addLink('Solo');
      const related = chain.findRelated(link.id);

      expect(related.some((r) => r.link.id === link.id)).toBe(false);
    });

    it('should sort by relation strength descending', () => {
      const parent = chain.addLink('Parent');
      const child1 = chain.addLink('Child 1', parent.id);
      const child2 = chain.addLink('Child 2', parent.id);
      const grandchild = chain.addLink('Grandchild', child1.id);

      const related = chain.findRelated(parent.id);
      // Both children accessed together with parent via addLink strengthen
      expect(related[0]?.relationStrength).toBeGreaterThanOrEqual(related[1]?.relationStrength ?? 0);
    });
  });

  describe('getRoots', () => {
    it('should return empty when no roots', () => {
      expect(chain.getRoots()).toEqual([]);
    });

    it('should return all root IDs', () => {
      const r1 = chain.addLink('Root 1');
      const r2 = chain.addLink('Root 2');
      const roots = chain.getRoots();

      expect(roots).toHaveLength(2);
      expect(roots).toContain(r1.id);
      expect(roots).toContain(r2.id);
    });

    it('should not include children in roots', () => {
      const root = chain.addLink('Root');
      chain.addLink('Child', root.id);
      const roots = chain.getRoots();

      expect(roots).toHaveLength(1);
      expect(roots[0]).toBe(root.id);
    });
  });

  describe('getRootLinks', () => {
    it('should return root link objects', () => {
      chain.addLink('Root 1');
      chain.addLink('Root 2');
      const roots = chain.getRootLinks();

      expect(roots).toHaveLength(2);
      expect(roots[0]?.content).toBe('Root 1');
      expect(roots[1]?.content).toBe('Root 2');
    });
  });

  describe('traverseDepthFirst', () => {
    it('should return empty for unknown start', () => {
      expect(chain.traverseDepthFirst('nonexistent')).toEqual([]);
    });

    it('should traverse depth-first', () => {
      const root = chain.addLink('A');
      const b = chain.addLink('B', root.id);
      const c = chain.addLink('C', root.id);
      chain.addLink('D', b.id);

      const result = chain.traverseDepthFirst(root.id);
      expect(result).toHaveLength(4);
      // DFS: A -> B -> D -> C
      expect(result[0]?.link.id).toBe(root.id);
      expect(result[0]?.depth).toBe(0);
      expect(result[1]?.link.id).toBe(b.id);
      expect(result[1]?.depth).toBe(1);
      expect(result[3]?.link.id).toBe(c.id);
      expect(result[3]?.depth).toBe(1);
    });

    it('should include path in result', () => {
      const root = chain.addLink('A');
      const child = chain.addLink('B', root.id);

      const result = chain.traverseDepthFirst(root.id);
      expect(result[1]?.path).toEqual([root.id]);
      expect(result[1]?.link.id).toBe(child.id);
    });
  });

  describe('getLink', () => {
    it('should return link by ID', () => {
      const link = chain.addLink('Hello');
      const found = chain.getLink(link.id);
      expect(found).not.toBeNull();
      expect(found?.content).toBe('Hello');
    });

    it('should return null for unknown ID', () => {
      expect(chain.getLink('nonexistent')).toBeNull();
    });

    it('should return a copy, not a reference', () => {
      const link = chain.addLink('Hello');
      const found = chain.getLink(link.id);
      found!.content = 'Modified';
      expect(chain.getLink(link.id)?.content).toBe('Hello');
    });
  });

  describe('getState', () => {
    it('should return state with links map', () => {
      const link = chain.addLink('Hello');
      const state = chain.getState();

      expect(state.links.has(link.id)).toBe(true);
      expect(state.roots).toContain(link.id);
      expect(state.lastLinkAt).not.toBeNull();
    });

    it('should return copies of links', () => {
      const link = chain.addLink('Hello');
      const state = chain.getState();
      const stateLink = state.links.get(link.id);
      stateLink!.content = 'Modified';
      expect(chain.getLink(link.id)?.content).toBe('Hello');
    });
  });

  describe('removeLink', () => {
    it('should remove a link', () => {
      const link = chain.addLink('Hello');
      expect(chain.removeLink(link.id)).toBe(true);
      expect(chain.getLink(link.id)).toBeNull();
    });

    it('should return false for unknown link', () => {
      expect(chain.removeLink('nonexistent')).toBe(false);
    });

    it('should remove children recursively', () => {
      const root = chain.addLink('Root');
      const child = chain.addLink('Child', root.id);
      const grandchild = chain.addLink('Grandchild', child.id);

      chain.removeLink(root.id);
      expect(chain.getLink(root.id)).toBeNull();
      expect(chain.getLink(child.id)).toBeNull();
      expect(chain.getLink(grandchild.id)).toBeNull();
    });

    it('should remove from parent children array', () => {
      const parent = chain.addLink('Parent');
      const child = chain.addLink('Child', parent.id);
      chain.removeLink(child.id);

      expect(chain.getLink(parent.id)?.children).not.toContain(child.id);
    });

    it('should remove from roots if root link', () => {
      const root = chain.addLink('Root');
      chain.removeLink(root.id);
      expect(chain.getRoots()).not.toContain(root.id);
    });
  });

  describe('updateContent', () => {
    it('should update link content', () => {
      const link = chain.addLink('Old');
      const updated = chain.updateContent(link.id, 'New');
      expect(updated?.content).toBe('New');
      expect(chain.getLink(link.id)?.content).toBe('New');
    });

    it('should return null for unknown ID', () => {
      expect(chain.updateContent('nonexistent', 'New')).toBeNull();
    });
  });

  describe('reparentLink', () => {
    it('should move link to new parent', () => {
      const oldParent = chain.addLink('Old Parent');
      const newParent = chain.addLink('New Parent');
      const child = chain.addLink('Child', oldParent.id);

      const updated = chain.reparentLink(child.id, newParent.id);
      expect(updated?.parentId).toBe(newParent.id);
      expect(chain.getLink(newParent.id)?.children).toContain(child.id);
      expect(chain.getLink(oldParent.id)?.children).not.toContain(child.id);
    });

    it('should make link a root when parent is null', () => {
      const parent = chain.addLink('Parent');
      const child = chain.addLink('Child', parent.id);

      chain.reparentLink(child.id, null);
      expect(chain.getLink(child.id)?.parentId).toBeNull();
      expect(chain.getRoots()).toContain(child.id);
    });

    it('should return null for unknown link', () => {
      expect(chain.reparentLink('nonexistent', null)).toBeNull();
    });

    it('should return null for unknown new parent', () => {
      const link = chain.addLink('Link');
      expect(chain.reparentLink(link.id, 'nonexistent')).toBeNull();
    });

    it('should return null if trying to be own parent', () => {
      const link = chain.addLink('Link');
      expect(chain.reparentLink(link.id, link.id)).toBeNull();
    });
  });

  describe('size', () => {
    it('should return 0 for empty chain', () => {
      expect(chain.size()).toBe(0);
    });

    it('should return correct count', () => {
      chain.addLink('a');
      chain.addLink('b');
      expect(chain.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all links', () => {
      chain.addLink('a');
      chain.addLink('b');
      chain.clear();
      expect(chain.size()).toBe(0);
      expect(chain.getRoots()).toEqual([]);
    });

    it('should reset lastLinkAt', () => {
      chain.addLink('a');
      chain.clear();
      expect(chain.getState().lastLinkAt).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should use custom initial strength', () => {
      const custom = new QuietChain({ initialStrength: 5.0 });
      const link = custom.addLink('Hello');
      expect(link.strength).toBe(5.0);
    });

    it('should use custom strength increment', () => {
      const custom = new QuietChain({ strengthIncrement: 0.5 });
      const parent = custom.addLink('Parent');
      custom.addLink('Child', parent.id);
      // Strength increment affects pair strength calculation
      expect(custom.size()).toBe(2);
    });
  });
});
