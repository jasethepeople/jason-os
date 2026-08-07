// ============================================================
// GhostWorkspace — Test Suite
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GhostWorkspace,
  createGhostWorkspaceModule,
  ghost_workspace_module,
} from './module.js';
import type { GhostWorkspaceState, Workspace } from './types.js';

describe('GhostWorkspace', () => {
  let gw: GhostWorkspace;

  beforeEach(() => {
    gw = new GhostWorkspace();
  });

  // ----------------------------------------------------------------
  // 1. Constructor creates instance with initial state
  // ----------------------------------------------------------------
  it('constructor creates instance with initial state', () => {
    const state = gw.getState();
    expect(state.workspaces).toEqual([]);
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.decoyMode).toBe(false);
  });

  // ----------------------------------------------------------------
  // 2. init resolves without error
  // ----------------------------------------------------------------
  it('init resolves without error', async () => {
    await expect(gw.init()).resolves.toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 3. createWorkspace creates a visible workspace by default
  // ----------------------------------------------------------------
  it('createWorkspace creates a visible workspace by default', () => {
    const ws = gw.createWorkspace({ name: 'My Workspace' });
    expect(ws.name).toBe('My Workspace');
    expect(ws.hidden).toBe(false);
    expect(ws.id).toBeDefined();
    expect(ws.createdAt).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 4. createWorkspace creates a hidden workspace
  // ----------------------------------------------------------------
  it('createWorkspace creates a hidden workspace', () => {
    const ws = gw.createWorkspace({
      name: 'Secret',
      hidden: true,
      decoyName: 'Project Alpha',
    });
    expect(ws.hidden).toBe(true);
    expect(ws.decoyName).toBe('Project Alpha');
  });

  // ----------------------------------------------------------------
  // 5. createWorkspace with apps
  // ----------------------------------------------------------------
  it('createWorkspace with apps', () => {
    const ws = gw.createWorkspace({
      name: 'Dev',
      apps: ['code', 'terminal', 'browser'],
    });
    expect(ws.apps).toEqual(['code', 'terminal', 'browser']);
  });

  // ----------------------------------------------------------------
  // 6. createWorkspace returns independent copy
  // ----------------------------------------------------------------
  it('createWorkspace returns independent copy', () => {
    const ws = gw.createWorkspace({ name: 'Test', apps: ['a'] });
    ws.apps.push('b');
    const fromState = gw.getState().workspaces.find((w) => w.id === ws.id);
    expect(fromState!.apps).toEqual(['a']);
  });

  // ----------------------------------------------------------------
  // 7. deleteWorkspace removes workspace
  // ----------------------------------------------------------------
  it('deleteWorkspace removes workspace', () => {
    const ws = gw.createWorkspace({ name: 'ToDelete' });
    expect(gw.getState().workspaces.length).toBe(1);
    const deleted = gw.deleteWorkspace(ws.id);
    expect(deleted).toBe(true);
    expect(gw.getState().workspaces.length).toBe(0);
  });

  // ----------------------------------------------------------------
  // 8. deleteWorkspace returns false for unknown ID
  // ----------------------------------------------------------------
  it('deleteWorkspace returns false for unknown ID', () => {
    const result = gw.deleteWorkspace('non-existent');
    expect(result).toBe(false);
  });

  // ----------------------------------------------------------------
  // 9. deleteWorkspace resets activeWorkspaceId
  // ----------------------------------------------------------------
  it('deleteWorkspace resets activeWorkspaceId', () => {
    const ws = gw.createWorkspace({ name: 'Active' });
    gw.switchWorkspace(ws.id);
    expect(gw.getState().activeWorkspaceId).toBe(ws.id);
    gw.deleteWorkspace(ws.id);
    expect(gw.getState().activeWorkspaceId).toBeNull();
  });

  // ----------------------------------------------------------------
  // 10. switchWorkspace switches to visible workspace
  // ----------------------------------------------------------------
  it('switchWorkspace switches to visible workspace', () => {
    const ws = gw.createWorkspace({ name: 'Target' });
    const result = gw.switchWorkspace(ws.id);
    expect(result).toBe(true);
    expect(gw.getActiveWorkspace()?.id).toBe(ws.id);
  });

  // ----------------------------------------------------------------
  // 11. switchWorkspace returns false for unknown workspace
  // ----------------------------------------------------------------
  it('switchWorkspace returns false for unknown workspace', () => {
    const result = gw.switchWorkspace('non-existent');
    expect(result).toBe(false);
  });

  // ----------------------------------------------------------------
  // 12. switchWorkspace blocks hidden workspace without auth
  // ----------------------------------------------------------------
  it('switchWorkspace blocks hidden workspace without auth', () => {
    const ws = gw.createWorkspace({ name: 'Secret', hidden: true });
    const result = gw.switchWorkspace(ws.id);
    expect(result).toBe(false);
    expect(gw.getActiveWorkspace()).toBeNull();
  });

  // ----------------------------------------------------------------
  // 13. switchWorkspace allows hidden workspace with auth
  // ----------------------------------------------------------------
  it('switchWorkspace allows hidden workspace with auth', () => {
    const ws = gw.createWorkspace({ name: 'Secret', hidden: true });
    const result = gw.switchWorkspace(ws.id, 'valid-token');
    expect(result).toBe(true);
    expect(gw.getActiveWorkspace()?.id).toBe(ws.id);
  });

  // ----------------------------------------------------------------
  // 14. switchWorkspace emits event on bus
  // ----------------------------------------------------------------
  it('switchWorkspace emits event on bus', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new GhostWorkspace(bus);
    const ws = instance.createWorkspace({ name: 'Target' });
    instance.switchWorkspace(ws.id);
    expect(emitFn).toHaveBeenCalledTimes(1);
    expect(emitFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workspace:switched',
        data: expect.objectContaining({ workspaceId: ws.id }),
        source: 'ghost-workspace',
      })
    );
  });

  // ----------------------------------------------------------------
  // 15. getActiveWorkspace returns null initially
  // ----------------------------------------------------------------
  it('getActiveWorkspace returns null initially', () => {
    expect(gw.getActiveWorkspace()).toBeNull();
  });

  // ----------------------------------------------------------------
  // 16. getActiveWorkspace returns independent copy
  // ----------------------------------------------------------------
  it('getActiveWorkspace returns independent copy', () => {
    const ws = gw.createWorkspace({ name: 'Active', apps: ['a'] });
    gw.switchWorkspace(ws.id);
    const active = gw.getActiveWorkspace()!;
    active.apps.push('b');
    const active2 = gw.getActiveWorkspace()!;
    expect(active2.apps).toEqual(['a']);
  });

  // ----------------------------------------------------------------
  // 17. toggleDecoy toggles decoy mode on
  // ----------------------------------------------------------------
  it('toggleDecoy toggles decoy mode on', () => {
    const result = gw.toggleDecoy();
    expect(result).toBe(true);
    expect(gw.isDecoyMode()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 18. toggleDecoy toggles decoy mode off
  // ----------------------------------------------------------------
  it('toggleDecoy toggles decoy mode off', () => {
    gw.toggleDecoy();
    const result = gw.toggleDecoy();
    expect(result).toBe(false);
    expect(gw.isDecoyMode()).toBe(false);
  });

  // ----------------------------------------------------------------
  // 19. toggleDecoy emits decoy-activated event
  // ----------------------------------------------------------------
  it('toggleDecoy emits decoy-activated event', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new GhostWorkspace(bus);
    instance.toggleDecoy();
    expect(emitFn).toHaveBeenCalledTimes(1);
    expect(emitFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workspace:decoy-activated',
        source: 'ghost-workspace',
      })
    );
  });

  // ----------------------------------------------------------------
  // 20. toggleDecoy does not emit when turning off
  // ----------------------------------------------------------------
  it('toggleDecoy does not emit when turning off', () => {
    const emitFn = vi.fn();
    const bus = { emit: emitFn };
    const instance = new GhostWorkspace(bus);
    instance.toggleDecoy(); // on - emits
    expect(emitFn).toHaveBeenCalledTimes(1);
    instance.toggleDecoy(); // off - no emit
    expect(emitFn).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------
  // 21. getVisibleWorkspaces excludes hidden
  // ----------------------------------------------------------------
  it('getVisibleWorkspaces excludes hidden', () => {
    gw.createWorkspace({ name: 'Visible1' });
    gw.createWorkspace({ name: 'Visible2' });
    gw.createWorkspace({ name: 'Hidden', hidden: true });
    const visible = gw.getVisibleWorkspaces();
    expect(visible.length).toBe(2);
    expect(visible.every((w) => !w.hidden)).toBe(true);
  });

  // ----------------------------------------------------------------
  // 22. getAllWorkspaces returns only visible without auth
  // ----------------------------------------------------------------
  it('getAllWorkspaces returns only visible without auth', () => {
    gw.createWorkspace({ name: 'Visible' });
    gw.createWorkspace({ name: 'Hidden', hidden: true });
    const all = gw.getAllWorkspaces();
    expect(all.length).toBe(1);
    expect(all[0]!.name).toBe('Visible');
  });

  // ----------------------------------------------------------------
  // 23. getAllWorkspaces returns all with auth token
  // ----------------------------------------------------------------
  it('getAllWorkspaces returns all with auth token', () => {
    gw.createWorkspace({ name: 'Visible' });
    gw.createWorkspace({ name: 'Hidden', hidden: true });
    const all = gw.getAllWorkspaces('valid-token');
    expect(all.length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 24. getWorkspace returns workspace by ID
  // ----------------------------------------------------------------
  it('getWorkspace returns workspace by ID', () => {
    const ws = gw.createWorkspace({ name: 'FindMe' });
    const found = gw.getWorkspace(ws.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('FindMe');
  });

  // ----------------------------------------------------------------
  // 25. getWorkspace returns null for unknown ID
  // ----------------------------------------------------------------
  it('getWorkspace returns null for unknown ID', () => {
    expect(gw.getWorkspace('non-existent')).toBeNull();
  });

  // ----------------------------------------------------------------
  // 26. getState returns independent copy
  // ----------------------------------------------------------------
  it('getState returns independent copy', () => {
    gw.createWorkspace({ name: 'WS1' });
    const state1: GhostWorkspaceState = gw.getState();
    gw.createWorkspace({ name: 'WS2' });
    const state2: GhostWorkspaceState = gw.getState();
    expect(state1.workspaces.length).toBe(1);
    expect(state2.workspaces.length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 27. getState clones workspace apps
  // ----------------------------------------------------------------
  it('getState clones workspace apps', () => {
    gw.createWorkspace({ name: 'WS', apps: ['a'] });
    const state = gw.getState();
    state.workspaces[0]!.apps.push('b');
    const state2 = gw.getState();
    expect(state2.workspaces[0]!.apps).toEqual(['a']);
  });

  // ----------------------------------------------------------------
  // 28. destroy resets all state
  // ----------------------------------------------------------------
  it('destroy resets all state', async () => {
    gw.createWorkspace({ name: 'WS' });
    await gw.destroy();
    const state = gw.getState();
    expect(state.workspaces).toEqual([]);
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.decoyMode).toBe(false);
  });

  // ----------------------------------------------------------------
  // 29. Multiple hidden workspaces require auth individually
  // ----------------------------------------------------------------
  it('multiple hidden workspaces require auth individually', () => {
    gw.createWorkspace({ name: 'Secret1', hidden: true });
    gw.createWorkspace({ name: 'Secret2', hidden: true });
    const visible = gw.getVisibleWorkspaces();
    expect(visible.length).toBe(0);
    const allNoAuth = gw.getAllWorkspaces();
    expect(allNoAuth.length).toBe(0);
    const allWithAuth = gw.getAllWorkspaces('token');
    expect(allWithAuth.length).toBe(2);
  });

  // ----------------------------------------------------------------
  // 30. Workspace apps are cloned on creation
  // ----------------------------------------------------------------
  it('workspace apps are cloned on creation', () => {
    const apps = ['app1', 'app2'];
    const ws = gw.createWorkspace({ name: 'Test', apps });
    apps.push('app3');
    expect(ws.apps).toEqual(['app1', 'app2']);
  });

  // ----------------------------------------------------------------
  // 31. verifyAuth rejects empty string
  // ----------------------------------------------------------------
  it('verifyAuth rejects empty string', () => {
    const ws = gw.createWorkspace({ name: 'Secret', hidden: true });
    const result = gw.switchWorkspace(ws.id, '');
    expect(result).toBe(false);
  });
});

describe('createGhostWorkspaceModule factory', () => {
  // ----------------------------------------------------------------
  // 32. Factory creates a working instance
  // ----------------------------------------------------------------
  it('factory creates a working instance', () => {
    const instance = createGhostWorkspaceModule();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(GhostWorkspace);
    instance.createWorkspace({ name: 'Test' });
    expect(instance.getState().workspaces.length).toBe(1);
  });

  // ----------------------------------------------------------------
  // 33. Factory accepts optional bus parameter
  // ----------------------------------------------------------------
  it('factory accepts optional bus parameter', () => {
    const bus = { emit: () => undefined };
    const instance = createGhostWorkspaceModule(bus);
    expect(instance).toBeDefined();
  });
});

describe('ghost_workspace_module metadata', () => {
  // ----------------------------------------------------------------
  // 34. Module metadata is correct
  // ----------------------------------------------------------------
  it('module metadata is correct', () => {
    expect(ghost_workspace_module.id).toBe('ghost-workspace');
    expect(ghost_workspace_module.name).toBe('GhostWorkspace');
    expect(ghost_workspace_module.category).toBe('privacy');
    expect(ghost_workspace_module.version).toBe('0.1.0');
    expect(ghost_workspace_module.permissions).toEqual([
      'workspace:manage',
      'events:emit',
      'auth:verify',
    ]);
    expect(ghost_workspace_module.description).toBeDefined();
  });
});
