// ============================================================
// @jason-os/ghost-workspace — Public API
// Hidden workspace environment with decoy mode
// ============================================================

export {
  ghost_workspace_module,
  GhostWorkspace,
  createGhostWorkspaceModule,
} from './module.js';

export type {
  Workspace,
  GhostWorkspaceState,
  CreateWorkspaceInput,
  AuthToken,
} from './types.js';
