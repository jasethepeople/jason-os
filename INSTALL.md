# Installation Guide

## Prerequisites

| Dependency | Version | Installation |
|------------|---------|--------------|
| Node.js | ≥ 18.0.0 | [nodejs.org](https://nodejs.org/) |
| pnpm | ≥ 8.0.0 | `npm install -g pnpm` |
| Git | ≥ 2.30.0 | [git-scm.com](https://git-scm.com/) |

Verify your environment:

```bash
node --version    # v18.x.x or higher
pnpm --version    # 8.x.x or higher
git --version     # 2.30.x or higher
```

## Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd jason-os

# Install all workspace dependencies
pnpm install
```

This installs dependencies for all 40 packages via pnpm workspaces.

## Build

```bash
# Build the entire monorepo (TypeScript compilation)
pnpm build

# Or use Turborepo for parallel builds
npx turbo run build
```

The build outputs to `packages/*/dist/`. TypeScript project references ensure correct build ordering.

## Test

```bash
# Run all tests across all packages
pnpm test

# Run tests with coverage report
pnpm test -- --coverage

# Run tests in watch mode (development)
pnpm test:watch

# Run tests for a single package
pnpm --filter @jason-os/privacy-kernel test
```

## Development Workflow

### Adding a New Module

```bash
# Create package directory
mkdir packages/my-module

# Copy template
cp packages/shared/package.json packages/my-module/
# Edit package.json: set name to @jason-os/my-module

# Create source files
mkdir packages/my-module/src
touch packages/my-module/src/types.ts
touch packages/my-module/src/module.ts
touch packages/my-module/src/index.ts

# Add to root workspace (already covered by packages/*)
# Build will pick it up automatically

pnpm build
```

### Running a Single Package

```bash
# Build single package
pnpm --filter @jason-os/privacy-kernel build

# Test single package
pnpm --filter @jason-os/privacy-kernel test

# Typecheck single package
pnpm --filter @jason-os/privacy-kernel typecheck
```

### Linting & Formatting

```bash
# ESLint
pnpm lint

# Prettier
pnpm format

# Check formatting without writing
pnpm format:check
```

## Troubleshooting

### Build Errors

**`Cannot find module '@jason-os/shared'`**

```bash
# Workspace links need to be established
pnpm install
# Or force rebuild
pnpm build
```

**`TypeScript compilation fails with composite project errors`**

```bash
# Clean all build artifacts
pnpm clean
# Or manually:
rm -rf packages/*/dist packages/*/*.tsbuildinfo
pnpm build
```

### Test Errors

**`ReferenceError: crypto is not defined`**

Your Node.js version may be < 18. The `crypto` global was stabilized in Node 18. Upgrade Node.js.

**`vitest` hangs or timeouts**

Some tests use fake timers. If tests hang, try:
```bash
pnpm test -- --run
```

## Environment Configuration

No `.env` file is required for basic operation. The system runs entirely in-memory by default. For production deployments, you may configure:

```bash
# Optional: Set crypto iteration count (default: 100,000)
export JASON_OS_PBKDF2_ITERATIONS=250000

# Optional: Override event bus buffer size (default: 10,000)
export JASON_OS_EVENT_BUFFER_SIZE=50000
```

## Browser vs. Node.js

Jason-OS is designed for browser environments where `crypto.subtle` and `localStorage`/`IndexedDB` are available. For Node.js testing, the test suite provides shims.

For browser builds:
```bash
# Not yet implemented — see roadmap
# Future: Vite-based bundling with tree-shaking per module
```
