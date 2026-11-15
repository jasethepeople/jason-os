import { defineWorkspace } from 'vitest/config';

// Every package is tested. A hand-maintained list silently skipped the
// kernel, storage, session, identity and shadow-mode packages.
export default defineWorkspace(['packages/*']);
