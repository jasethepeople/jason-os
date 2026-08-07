// ============================================================
// GhostWorkspace Types — Hidden Workspace Environment
// ============================================================

export interface Workspace {
  /** Unique identifier for the workspace */
  id: string;
  /** Human-readable workspace name */
  name: string;
  /** Whether the workspace is hidden from normal view */
  hidden: boolean;
  /** Fake name displayed when decoy mode is active */
  decoyName: string;
  /** List of app identifiers in this workspace */
  apps: string[];
  /** Timestamp when the workspace was created */
  createdAt: number;
}

export interface GhostWorkspaceState {
  /** All workspaces (visible and hidden) */
  workspaces: Workspace[];
  /** Currently active workspace ID, or null */
  activeWorkspaceId: string | null;
  /** Whether decoy mode is currently active */
  decoyMode: boolean;
}

export interface CreateWorkspaceInput {
  /** Workspace name */
  name: string;
  /** Whether to create as hidden */
  hidden?: boolean;
  /** Decoy name for hidden workspaces */
  decoyName?: string;
  /** Initial apps to include */
  apps?: string[];
}

export interface AuthToken {
  /** Authentication token string */
  token: string;
  /** Expiry timestamp */
  expiresAt: number;
}
