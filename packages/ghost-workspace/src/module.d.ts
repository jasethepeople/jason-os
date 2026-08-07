import type { Workspace, GhostWorkspaceState, CreateWorkspaceInput } from './types.js';
export declare const ghost_workspace_module: {
    id: string;
    name: string;
    category: 'privacy';
    version: string;
    permissions: readonly ['workspace:manage', 'events:emit', 'auth:verify'];
    description: string;
};
export declare class GhostWorkspace {
    private state;
    private _bus;
    constructor(bus?: unknown);
    init(): Promise<void>;
    /**
     * Create a new workspace.
     * @param input - Workspace creation parameters
     * @returns The created workspace
     */
    createWorkspace(input: CreateWorkspaceInput): Workspace;
    /**
     * Delete a workspace by ID.
     * @param workspaceId - ID of workspace to delete
     * @returns True if deleted, false if not found
     */
    deleteWorkspace(workspaceId: string): boolean;
    /**
     * Switch to a different workspace.
     * Hidden workspaces require an auth token.
     * @param workspaceId - Target workspace ID
     * @param authToken - Optional auth token for hidden workspaces
     * @returns True if switch succeeded
     */
    switchWorkspace(workspaceId: string, authToken?: string): boolean;
    /**
     * Get the currently active workspace, or null.
     * @returns Active workspace copy, or null
     */
    getActiveWorkspace(): Workspace | null;
    /**
     * Toggle decoy mode. When active, hidden workspaces show decoy names.
     * @returns New decoy mode state
     */
    toggleDecoy(): boolean;
    /**
     * Check if decoy mode is currently active.
     * @returns Whether decoy mode is on
     */
    isDecoyMode(): boolean;
    /**
     * Get all visible workspaces (non-hidden, or hidden shown with decoy names in decoy mode).
     * @returns Array of visible workspace copies
     */
    getVisibleWorkspaces(): Workspace[];
    /**
     * Get all workspaces including hidden ones.
     * Requires an auth token to include hidden workspaces.
     * @param authToken - Auth token to access hidden workspaces
     * @returns Array of all workspace copies, or only visible if auth fails
     */
    getAllWorkspaces(authToken?: string): Workspace[];
    /**
     * Get a specific workspace by ID.
     * @param workspaceId - Workspace ID
     * @returns Workspace copy, or null if not found
     */
    getWorkspace(workspaceId: string): Workspace | null;
    /**
     * Get the full current state.
     * @returns Deep-cloned state snapshot
     */
    getState(): GhostWorkspaceState;
    destroy(): Promise<void>;
    /**
     * Verify an authentication token.
     * Simple placeholder — real implementation would validate against a token store.
     */
    private verifyAuth;
    /**
     * Resolve the display name for a workspace, applying decoy if needed.
     */
    private resolveDisplayName;
    /**
     * Deep-clone a workspace object.
     */
    private cloneWorkspace;
    private emit;
}
export declare function createGhostWorkspaceModule(bus?: unknown): GhostWorkspace;
//# sourceMappingURL=module.d.ts.map