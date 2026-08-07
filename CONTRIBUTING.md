# Contributing to Jason-OS

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Code Standards

### TypeScript

- **Strict mode**: All packages use `strict: true`, `exactOptionalPropertyTypes: true`
- **Explicit return types**: All public methods must declare return types
- **No `any`**: Use `unknown` with type guards instead
- **Composite projects**: Each package is a TypeScript composite project

### Module Pattern

Every new module must follow this structure:

```
packages/<module-name>/
├── src/
│   ├── types.ts        # All module-specific types
│   ├── module.ts       # Main class implementation
│   ├── index.ts        # Public exports + module_definition
│   └── *.test.ts       # Vitest test suites (≥80% coverage)
├── package.json        # workspace:* dependencies
├── tsconfig.json       # Extends root, composite: true
└── README.md           # Module-specific docs (optional)
```

### Module API Contract

```typescript
export const module_definition = {
  id: 'module-name',
  name: 'Human Readable Name',
  version: '1.0.0',
  category: 'EMOTIONAL' | 'IDENTITY' | 'PRODUCTIVITY' | 'NAVIGATION' | 'MEMORY' | 'COMMUNICATION' | 'PRIVACY',
  dependencies: [],           // Required module IDs
  optionalDependencies: [],   // Optional module IDs
  permissions: [],            // Required system permissions
  events: {
    emits: [],     // Event types this module emits
    listens: [],   // Event types this module subscribes to
  },
};

export class ModuleName {
  constructor(bus?: EventBus);
  async init(): Promise<void>;
  async process(data: unknown): Promise<ModuleState>;
  getState(): ModuleState;
  async destroy(): Promise<void>;
}
```

### Testing Requirements

- Every module must have a `*.test.ts` file
- Minimum 80% code coverage (enforced by CI)
- Use Vitest — no Jest or Mocha
- Mock the Event Bus for unit tests:

```typescript
const mockBus = {
  emit: vi.fn(),
  on: vi.fn(() => ({ id: 'sub', off: vi.fn() })),
};
```

### Privacy Guarantees

If your module handles GHOST-tier data:
- Must use `memory-only` storage (never touch localStorage/IndexedDB)
- Keys must have TTL=0 (immediate expiration)
- Test must verify no disk I/O occurs

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(privacy-kernel): add GHOST-tier key rotation
test(emotional-telemetry): add stress-spike detection cases
docs(architecture): update threat model for coercion resistance
```

## Pull Request Process

1. Ensure `pnpm build` passes with no errors
2. Ensure `pnpm test` passes (all 39+ suites)
3. Update relevant documentation (README, ARCHITECTURE)
4. PR description must explain:
   - What changed
   - Why it changed
   - Which privacy/emotional guarantees are affected (if any)

## Code Review Checklist

- [ ] No new `any` types introduced
- [ ] All public methods have explicit return types
- [ ] Tests cover edge cases (empty input, invalid state, boundary conditions)
- [ ] GHOST-tier code paths verified for no disk I/O
- [ ] Event bus usage follows priority guidelines (CRITICAL only for panics)
- [ ] No hardcoded keys, passwords, or secrets
- [ ] Module dependencies declared in manifest

## Community

- Issues: Use GitHub Issues for bugs and feature requests
- Discussions: Use GitHub Discussions for architecture questions
- Security: Report security issues privately — do not open public issues
