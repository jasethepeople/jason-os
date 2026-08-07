# Jason-OS Architecture

## Design Principles

1. **Privacy is a runtime primitive, not a policy.** The four-tier privacy model is enforced by the Privacy Kernel at the cryptographic level — not by configuration or convention.
2. **Emotional state is a system input.** The VAD+Stress vector from `emotional-telemetry` is consumed by the theme engine, module loader, and privacy tier selector. High stress can trigger theme shifts, notification suppression, or automatic tier escalation.
3. **Identity is context-dependent.** The `identity-manager` supports core, burner, and shadow personas. A user can operate as their core identity for personal journaling, a burner identity for sensitive research, and a shadow identity that leaves no trace.
4. **Modules are untrusted by default.** The `module-loader` sandboxes every module. Breach attempts increment a counter; at threshold, the module is quarantined and its data namespace is sealed.
5. **Sync is E2EE and offline-first.** The `sync-engine` never sends plaintext. Conflict resolution uses CRDT-inspired timestamp strategies, not server authority.

## Layer Architecture

### Layer 0: Kernel (Untrusted Code Cannot Bypass)

```
┌────────────────────────────────────────────────────────────────┐
│                         KERNEL LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Privacy     │  │ Event Bus   │  │ Module Registry         │ │
│  │ Kernel      │  │ (Priority   │  │ (DAG + Cycle            │ │
│  │ (AES-256-   │  │  Queues)    │  │  Detection)             │ │
│  │  GCM)       │  │             │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Data        │  │ Session     │  │ Sync Engine             │ │
│  │ Registry    │  │ Manager     │  │ (E2EE + Offline)        │ │
│  │ (Namespace  │  │ (Identity   │  │                         │ │
│  │  Isolation) │  │  Switching) │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

The Kernel Layer is the only code with direct access to cryptographic primitives, session tokens, and cross-module ACLs. All kernel modules are loaded before any feature module and cannot be unloaded at runtime.

### Layer 1: Abstraction (Storage, Vaults, Logs)

```
┌────────────────────────────────────────────────────────────────┐
│                      ABSTRACTION LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Storage     │  │ Encrypted   │  │ Shadow Logs             │ │
│  │ Adapters    │  │ Vaults      │  │ (Stealth, Burn)         │ │
│  │ (Tier-      │  │ (Deniable,  │  │                         │ │
│  │  Routed)    │  │  Self-      │  │                         │ │
│  │             │  │  Destruct)  │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

Storage adapters route reads/writes based on privacy tier:
- `PUBLIC` → localStorage (namespaced)
- `SOFT` → IndexedDB (encrypted at rest)
- `SHADOW` → IndexedDB + vault encryption
- `GHOST` → Memory only (never touches disk)

### Layer 2: Identity & Emotion

```
┌────────────────────────────────────────────────────────────────┐
│                   IDENTITY & EMOTION LAYER                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Identity    │  │ Emotional   │  │ Shadow Mode             │ │
│  │ Manager     │  │ Telemetry   │  │ (Panic, Decoy,          │ │
│  │ (Core /     │  │ (VAD+Stress │  │  Duress)                │ │
│  │  Burner /   │  │  Capture)   │  │                         │ │
│  │  Shadow)    │  │             │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

The emotional telemetry engine samples the VAD+Stress vector at configurable intervals (default: 30s). Baseline learning establishes per-user norms; drift detection triggers grounding interventions via `drift-cell`.

### Layer 3: Feature Modules

All feature modules export a `module_definition` object and a class conforming to the Module API Contract:

```typescript
export const module_definition = {
  id: 'module-id',
  name: 'Human Name',
  version: '1.0.0',
  category: 'EMOTIONAL' as const,
  dependencies: ['@jason-os/shared'],
  events: { emits: ['module:state-change'], listens: ['emotion:update'] },
};

export class ModuleName {
  constructor(bus?: EventBus);
  async init(): Promise<void>;
  async process(data: unknown): Promise<ModuleState>;
  getState(): ModuleState;
  async destroy(): Promise<void>;
}
```

Modules communicate exclusively through the Event Bus. Direct inter-module imports are prohibited by the sandbox.

## Event Bus: Priority Dispatch

```typescript
// CRITICAL events are dispatched synchronously
// HIGH → BACKGROUND are queued via queueMicrotask
bus.emit({
  type: 'emotion:spike',
  payload: { valence: -0.8, stress: 0.9 },
  priority: 'CRITICAL',
  source: 'emotional-telemetry',
});
```

| Priority | Latency Guarantee | Use Case |
|----------|-------------------|----------|
| `CRITICAL` | Synchronous (<1ms) | Panic triggers, tier escalation |
| `HIGH` | Microtask (<10ms) | Stress spikes, breach alerts |
| `NORMAL` | Microtask batch | State changes, UI updates |
| `LOW` | Microtask batch | Telemetry batching |
| `BACKGROUND` | Idle callback | Analytics, archival |

Dead letter queue captures failed handlers. Ring buffer preserves last 10,000 events for forensic analysis.

## Privacy Kernel: Encryption Lifecycle

```
┌────────────────────────────────────────────────────────────────┐
│                    KEY LIFECYCLE STATES                         │
│                                                                 │
│   [User Input] ──PBKDF2──> [Derived Key]                      │
│         │                                                     │
│         v                                                     │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│   │ KeyChain    │───>│ Encrypt()   │───>│ EncryptedBlob   │  │
│   │ (in-memory  │    │ (AES-256-   │    │ (ciphertext +   │  │
│   │  map + TTL) │    │  GCM + IV)  │    │  IV + authTag)  │  │
│   └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                                                     │
│         v                                                     │
│   [Tier Change] ──clearKeys()──> [GHOST: immediate]           │
│                                  [SOFT: session end]          │
│                                  [SHADOW: vault close]        │
│                                  [PUBLIC: none]               │
└────────────────────────────────────────────────────────────────┘
```

## Conflict Resolution (Sync Engine)

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `OURS` | Local wins always | Offline authority |
| `THEIRS` | Remote wins always | Fresh data priority |
| `MERGE` | Field-level merge with last-write | Collaborative docs |
| `TIMESTAMP` | Higher timestamp wins | Event-sourced systems |

## Testing Strategy

- **Unit**: Every module has a `*.test.ts` suite using Vitest
- **Integration**: Cross-module event flows tested via Event Bus spies
- **Privacy**: GHOST-tier tests verify memory-only operation (no disk I/O)
- **Security**: Sandbox breach tests verify quarantine behavior

Coverage threshold: 80% per package (enforced by CI).

## Performance Budgets

| Operation | Target | Worst Case |
|-----------|--------|------------|
| Event dispatch (CRITICAL) | <1ms | <5ms |
| Event dispatch (NORMAL) | <10ms | <50ms |
| AES-256-GCM encrypt (1KB) | <5ms | <20ms |
| PBKDF2 derive (100K iters) | <100ms | <500ms |
| Module load + sandbox | <50ms | <200ms |
| VAD+Stress computation | <2ms | <10ms |

## Threat Model

Jason-OS is designed to resist:

1. **Forensic analysis of storage** — SHADOW-tier vaults are plausibly deniable; GHOST-tier leaves no trace.
2. **Coercion (duress)** — Duress password opens decoy vault with benign data. Real vault remains hidden.
3. **Module compromise** — Sandbox isolates breached modules; ACL prevents unauthorized cross-module reads.
4. **Network adversary** — Sync is E2EE; server cannot read content or metadata.
5. **Timing attacks** — Constant-time comparisons for password verification; keyed verification bypasses timing side-channels.

## Not in Scope

- **Hardware security** — No TPM, secure enclave, or hardware-backed key storage. Software-only.
- **Formal verification** — No Coq/TLA+ proofs. TypeScript-level safety, not mathematical guarantee.
- **Medical diagnosis** — Emotional telemetry is not diagnostic. No clinical validation.
- **Legal compliance** — Architecture supports privacy but does not guarantee GDPR/CCPA/PIPL compliance out of box.
