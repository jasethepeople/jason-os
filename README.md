# Jason-OS

> A modular, privacy-first psychological operating system for human-centered computing.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-39%20suites-green)]()
[![Packages](https://img.shields.io/badge/packages-40-blue)]()

## Abstract

Jason-OS is a research-grade, modular software architecture designed to explore the intersection of **psychological safety**, **emotional telemetry**, and **privacy-preserving computation**. At its core, it treats the user not as a data source to be extracted but as a psychological system whose boundaries, emotional states, and identity contexts must be respected by the software itself.

The system implements a novel **four-tier privacy model** (`PUBLIC` → `SOFT` → `SHADOW` → `GHOST`) that governs data persistence, encryption depth, and ephemerality at runtime — not as a configuration option but as a first-class architectural primitive. Each tier carries formal guarantees about data lifecycle, observable footprint, and breach containment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         JASON-OS                                │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│  EMOTIONAL  │  IDENTITY   │ PRODUCTIVITY│      PRIVACY          │
│   LAYER     │   LAYER     │   LAYER     │      LAYER            │
├─────────────┼─────────────┼─────────────┼───────────────────────┤
│• emotional- │• identity-  │• quiet-span │ • privacy-kernel       │
│  telemetry  │  manager    │• quiet-     │ • encrypted-vaults     │
│• calm-      │• shadow-    │  quorum     │ • shadow-logs          │
│  switch     │  atlas      │• soft-      │ • shadow-mode          │
│• drift-cell │• ghost-     │  barrier    │ • identity-manager     │
│• soft-      │  span       │• soft-       │ • sync-engine          │
│  anchor     │• shadow-     │  lockstep   │ • ghost-workspace      │
│• echo-      │  persona    │• ghost-     │ • underveil            │
│  silence    │             │  rhythm     │ • shadow-pipeline      │
│• pulse-     │             │• silent-ops │ • stealth-ledger-pro   │
│  check-os   │             │             │                        │
│• under-     │             │             │                        │
│  current    │             │             │                        │
├─────────────┴─────────────┴─────────────┴───────────────────────┤
│                    MODULE REGISTRY & LOADER                       │
├───────────────────────────────────────────────────────────────────┤
│              EVENT BUS  ←→  PRIVACY KERNEL  ←→  DATA REGISTRY    │
├───────────────────────────────────────────────────────────────────┤
│                   SESSION MANAGER  ←→  SYNC ENGINE                │
├───────────────────────────────────────────────────────────────────┤
│              STORAGE ADAPTERS  (localStorage / IndexedDB / Memory)  │
└───────────────────────────────────────────────────────────────────┘
```

## The Four Privacy Tiers

Jason-OS defines privacy not as an on/off switch but as a **continuum of ephemerality guarantees**:

| Tier | Persistence | Encryption | Key Lifecycle | Use Case |
|------|------------|------------|---------------|----------|
| **PUBLIC** | Standard | None | N/A | UI preferences, non-sensitive settings |
| **SOFT** | Encrypted at rest | AES-256-GCM | Session-scoped | Personal notes, emotional logs |
| **SHADOW** | Encrypted, plausibly deniable | AES-256-GCM + derived keys | Vault-scoped | Sensitive journals, identity data |
| **GHOST** | Memory-only | AES-256-GCM | Ephemeral (immediate) | Burner sessions, panic data, coercion-resistance |

The tier is enforced by the **Privacy Kernel**, which derives keys, manages encryption lifecycle, and guarantees that a GHOST-tier key never persists beyond a single microtask boundary.

## Module Ecosystem (40 Packages)

### Foundation Layer
| Module | Purpose |
|--------|---------|
| `@jason-os/shared` | Core types, interfaces, error hierarchy |
| `@jason-os/event-bus` | Priority-queued event dispatch with glob pattern matching |
| `@jason-os/privacy-kernel` | AES-256-GCM encryption, PBKDF2 key derivation, tier management |
| `@jason-os/module-registry` | Dependency graph resolution, cycle detection, manifest validation |
| `@jason-os/data-registry` | Per-module encrypted namespaces with ACL |
| `@jason-os/session-manager` | Session lifecycle, burner sessions, identity switching |

### Data & Sync Layer
| Module | Purpose |
|--------|---------|
| `@jason-os/sync-engine` | End-to-end encrypted sync, offline-first, 4 conflict strategies |
| `@jason-os/storage-adapters` | Tier-aware storage routing (localStorage / IndexedDB / Memory) |
| `@jason-os/encrypted-vaults` | Plausibly deniable vaults with self-destruct capability |
| `@jason-os/shadow-logs` | Stealth logging with 4 burn policies (MEMORY / EPHEMERAL / PERSISTENT / NEVER) |

### Identity & Emotion Layer
| Module | Purpose |
|--------|---------|
| `@jason-os/identity-manager` | Core / burner / shadow personas with zero-trace switching |
| `@jason-os/emotional-telemetry` | VAD+Stress model (valence, arousal, dominance, stress), real-time capture |
| `@jason-os/shadow-mode` | Ghost mode, panic lockdown, decoy UI, duress password |

### Productivity Layer
| Module | Purpose |
|--------|---------|
| `@jason-os/quiet-span` | Focus sessions with emotion-aware tracking |
| `@jason-os/soft-lockstep` | Synchronized focus companion with mutual scoring |
| `@jason-os/quiet-quorum` | Consensus decision making across modules |
| `@jason-os/ghost-rhythm` | Privacy-protected habit tracker |
| `@jason-os/silent-ops` | Stealth task automation |

### Emotional Layer
| Module | Purpose |
|--------|---------|
| `@jason-os/calm-switch` | Rapid emotional state transition |
| `@jason-os/drift-cell` | Grounding techniques (5-4-3-2-1, breath-box, body-scan) |
| `@jason-os/soft-anchor` | Emotional re-anchoring on stress spikes |
| `@jason-os/echo-silence` | Meditation companion with streak tracking |
| `@jason-os/pulse-check-os` | Emotional vitals dashboard |
| `@jason-os/undercurrent` | Subconscious pattern detection |
| `@jason-os/soft-phase` | Cycle tracking with emotional correlation |

### Memory & Communication Layer
| Module | Purpose |
|--------|---------|
| `@jason-os/quiet-chain` | Associative thought chaining (parent-child links) |
| `@jason-os/soft-archive` | Intelligent archiving with emotional tagging |
| `@jason-os/shadow-index` | Encrypted personal search engine |
| `@jason-os/soft-signal-pro` | Emotional tone analysis and softening |
| `@jason-os/quiet-frame` | Language softening (10 replacement patterns) |
| `@jason-os/underveil` | Consent-based communication veils |

### Privacy Layer
| Module | Purpose |
|--------|---------|
| `@jason-os/shadow-pipeline` | Secure ETL pipeline (encrypt / hash / anonymize / filter) |
| `@jason-os/stealth-ledger-pro` | Encrypted accounting |
| `@jason-os/soft-barrier` | Emotional boundary setting |
| `@jason-os/ghost-workspace` | Hidden workspace environments |

### UI Layer
| Module | Purpose |
|--------|---------|
| `@jason-os/ui-shell` | Theme engine (dim / soft / shadow / quiet), stress-override |
| `@jason-os/module-loader` | Hot-swap module loading, sandboxing with breach quarantine |

## Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd jason-os

# 2. Install dependencies (requires pnpm)
pnpm install

# 3. Build the monorepo
pnpm build

# 4. Run the test suite
pnpm test

# 5. Run tests in watch mode (development)
pnpm test:watch
```

### Prerequisites

- **Node.js** ≥ 18.0.0
- **pnpm** ≥ 8.0.0 (`npm install -g pnpm`)
- **TypeScript** ≥ 5.3.0 (installed via devDependencies)

## Project Structure

```
jason-os/
├── packages/
│   ├── shared/                  # Core types & interfaces
│   ├── event-bus/               # Event system with priority queues
│   ├── privacy-kernel/          # Encryption & privacy tiers
│   ├── module-registry/         # DAG dependency resolution
│   ├── data-registry/           # Encrypted namespace isolation
│   ├── session-manager/         # Session lifecycle
│   ├── sync-engine/             # E2EE sync engine
│   ├── storage-adapters/        # Storage abstraction layer
│   ├── encrypted-vaults/        # Shadow vaults
│   ├── shadow-logs/             # Stealth logging
│   ├── identity-manager/        # Persona management
│   ├── emotional-telemetry/     # VAD+Stress telemetry
│   ├── shadow-mode/             # Privacy panic mode
│   ├── ui-shell/                # Theme & panel engine
│   ├── module-loader/           # Hot-swap & sandboxing
│   ├── [25 additional modules]/  # Feature modules
│   └── ...
├── package.json                 # Root workspace config
├── pnpm-workspace.yaml          # pnpm workspace definition
├── tsconfig.json                # TypeScript strict mode config
├── turbo.json                   # Build pipeline
├── vitest.config.ts             # Test configuration
├── .eslintrc.js                 # Lint rules
└── .prettierrc                  # Formatting
```

## The VAD+Stress Emotional Model

Jason-OS models emotional state using an extended **dimensional emotion model** combining the classic VAD framework (Russell & Mehrabian, 1977) with a stress dimension:

- **Valence** (-1 to +1): Pleasure vs. displeasure
- **Arousal** (0 to 1): Activation level
- **Dominance** (0 to 1): Sense of control
- **Stress** (0 to 1): Physiological/psychological pressure

This four-dimensional vector is computed by the `emotional-telemetry` engine and consumed across the system — themes respond to stress, modules adjust their intrusion level, and the privacy tier can escalate automatically when stress spikes.

## Academic Context

Jason-OS is designed as a research platform for studying:

1. **Psychologically-safe software architecture** — How system design can respect user emotional boundaries rather than exploit attention.
2. **Privacy as a runtime primitive** — Moving privacy from policy to mechanism, with formal guarantees about data lifecycle.
3. **Emotion-aware computing** — Using dimensional affect models to drive adaptive interfaces without surveillance.
4. **Coercion resistance** — Technical measures (duress passwords, panic modes, decoy UIs) that protect users under compulsion.

### Relevant Literature

- Russell, J. A. (1980). A circumplex model of affect. *Journal of Personality and Social Psychology*, 39(6), 1161–1178.
- Mehrabian, A. (1996). Pleasure-arousal-dominance: A general framework for describing and measuring individual differences in temperament. *Current Psychology*, 14(4), 261–292.
- Whitten, A., & Tygar, J. D. (1998). Why Johnny can't encrypt: A usability evaluation of PGP 5.0. *USENIX Security*.
- Green, M., & Smith, M. (2016). Developers are not the enemy! The need for usable security APIs. *IEEE Security & Privacy*.

## License

MIT License — See [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [ARCHITECTURE.md](ARCHITECTURE.md) for the technical deep dive.

---

*Jason-OS is a research artifact. It is not a medical device, therapeutic tool, or FDA-regulated software. It is intended for researchers, developers, and privacy advocates exploring the frontier of human-centered system design.*
