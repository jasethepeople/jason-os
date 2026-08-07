// ============================================================
// GhostWorkspace Module — Hidden Workspace Environment
// Privacy-focused workspace management with decoy mode
// ============================================================

import type {
  Workspace,
  GhostWorkspaceState,
  CreateWorkspaceInput,
} from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const ghost_workspace_module = {
  id: 'ghost-workspace',
  name: 'GhostWorkspace',
  category: 'privacy' as const,
  version: '0.1.0',
  permissions: ['workspace:manage', 'events:emit', 'auth:verify'] as const,
  description:
    'Hidden workspace environment — privacy-focused workspace management with decoy mode',
};

// ------------------------------------------------------------------
// GhostWorkspace Implementation
// ------------------------------------------------------------------

let _workspaceIdCounter = 0;

function generateWorkspaceId(): string {
  _workspaceIdCounter++;
  return `ws-${Date.now()}-${_workspaceIdCounter}`;
}

export class GhostWorkspace {
  private state: GhostWorkspaceState = {
    workspaces: [],
    activeWorkspaceId: null,
    decoyMode: false,
  };

  private _bus: unknown;

  constructor(bus?: unknown) {
    this._bus = bus;
    void this._bus;
  }

  async init(): Promise<void> {
    return Promise.resolve();
  }

  // ----------------------------------------------------------------
  // Workspace CRUD
  // ----------------------------------------------------------------

  /**
   * Create a new workspace.
   * @param input - Workspace creation parameters
   * @returns The created workspace
   */
  createWorkspace(input: CreateWorkspaceInput): Workspace {
    const workspace: Workspace = {
      id: generateWorkspaceId(),
      name: input.name,
      hidden: input.hidden ?? false,
      decoyName: input.decoyName ?? input.name,
      apps: input.apps ? [...input.apps] : [],
      createdAt: Date.now(),
    };
    this.state.workspaces.push(workspace);
    return { ...workspace, apps: [...workspace.apps] };
  }

  /**
   * Delete a workspace by ID.
   * @param workspaceId - ID of workspace to delete
   * @returns True if deleted, false if not found
   */
  deleteWorkspace(workspaceId: string): boolean {
    const initialLen = this.state.workspaces.length;
    this.state.workspaces = this.state.workspaces.filter((w) => w.id !== workspaceId);
    if (this.state.activeWorkspaceId === workspaceId) {
      this.state.activeWorkspaceId = null;
    }
    return this.state.workspaces.length < initialLen;
  }

  // ----------------------------------------------------------------
  // Workspace Switching
  // ----------------------------------------------------------------

  /**
   * Switch to a different workspace.
   * Hidden workspaces require an auth token.
   * @param workspaceId - Target workspace ID
   * @param authToken - Optional auth token for hidden workspaces
   * @returns True if switch succeeded
   */
  switchWorkspace(workspaceId: string, authToken?: string): boolean {
    const workspace = this.state.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return false;

    // Hidden workspaces require auth token
    if (workspace.hidden && !this.verifyAuth(authToken)) {
      return false;
    }

    this.state.activeWorkspaceId = workspaceId;
    this.emit('workspace:switched', {
      workspaceId,
      name: this.resolveDisplayName(workspace),
    });
    return true;
  }

  /**
   * Get the currently active workspace, or null.
   * @returns Active workspace copy, or null
   */
  getActiveWorkspace(): Workspace | null {
    if (!this.state.activeWorkspaceId) return null;
    const ws = this.state.workspaces.find(
      (w) => w.id === this.state.activeWorkspaceId
    );
    return ws ? this.cloneWorkspace(ws) : null;
  }

  // ----------------------------------------------------------------
  // Decoy Mode
  // ----------------------------------------------------------------

  /**
   * Toggle decoy mode. When active, hidden workspaces show decoy names.
   * @returns New decoy mode state
   */
  toggleDecoy(): boolean {
    this.state.decoyMode = !this.state.decoyMode;
    if (this.state.decoyMode) {
      this.emit('workspace:decoy-activated', {
        timestamp: Date.now(),
      });
    }
    return this.state.decoyMode;
  }

  /**
   * Check if decoy mode is currently active.
   * @returns Whether decoy mode is on
   */
  isDecoyMode(): boolean {
    return this.state.decoyMode;
  }

  // ----------------------------------------------------------------
  // Workspace Queries
  // ----------------------------------------------------------------

  /**
   * Get all visible workspaces (non-hidden, or hidden shown with decoy names in decoy mode).
   * @returns Array of visible workspace copies
   */
  getVisibleWorkspaces(): Workspace[] {
    return this.state.workspaces
      .filter((w) => !w.hidden)
      .map((w) => this.cloneWorkspace(w));
  }

  /**
   * Get all workspaces including hidden ones.
   * Requires an auth token to include hidden workspaces.
   * @param authToken - Auth token to access hidden workspaces
   * @returns Array of all workspace copies, or only visible if auth fails
   */
  getAllWorkspaces(authToken?: string): Workspace[] {
    if (this.verifyAuth(authToken)) {
      return this.state.workspaces.map((w) => this.cloneWorkspace(w));
    }
    return this.getVisibleWorkspaces();
  }

  /**
   * Get a specific workspace by ID.
   * @param workspaceId - Workspace ID
   * @returns Workspace copy, or null if not found
   */
  getWorkspace(workspaceId: string): Workspace | null {
    const ws = this.state.workspaces.find((w) => w.id === workspaceId);
    return ws ? this.cloneWorkspace(ws) : null;
  }

  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------

  /**
   * Get the full current state.
   * @returns Deep-cloned state snapshot
   */
  getState(): GhostWorkspaceState {
    return {
      workspaces: this.state.workspaces.map((w) => this.cloneWorkspace(w)),
      activeWorkspaceId: this.state.activeWorkspaceId,
      decoyMode: this.state.decoyMode,
    };
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  async destroy(): Promise<void> {
    this.state = {
      workspaces: [],
      activeWorkspaceId: null,
      decoyMode: false,
    };
    this._bus = undefined;
    return Promise.resolve();
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  /**
   * Verify an authentication token.
   * Simple placeholder — real implementation would validate against a token store.
   */
  private verifyAuth(authToken?: string): boolean {
    return authToken !== undefined && authToken.length > 0;
  }

  /**
   * Resolve the display name for a workspace, applying decoy if needed.
   */
  private resolveDisplayName(workspace: Workspace): string {
    if (workspace.hidden && this.state.decoyMode) {
      return workspace.decoyName;
    }
    return workspace.name;
  }

  /**
   * Deep-clone a workspace object.
   */
  private cloneWorkspace(workspace: Workspace): Workspace {
    return {
      ...workspace,
      apps: [...workspace.apps],
    };
  }

  // ------------------------------------------------------------------
  // Event emission helper
  // ------------------------------------------------------------------

  private emit(type: string, data: Record<string, unknown>): void {
    if (
      this._bus &&
      typeof this._bus === 'object' &&
      this._bus !== null
    ) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (event: unknown) => void)({ type, data, source: 'ghost-workspace' });
      }
    }
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createGhostWorkspaceModule(bus?: unknown): GhostWorkspace {
  return new GhostWorkspace(bus);
}
