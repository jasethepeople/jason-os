import { randomBytes } from 'crypto';
import {
  type Session,
  type Identity,
  type PrivacyTier,
  type SessionManager,
  JasonOSError,
} from '@jason-os/shared';

// ============================================================
// Constants
// ============================================================

const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const BURNER_SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour
const TOKEN_BYTE_LENGTH = 32;

// ============================================================
// Identity → PrivacyTier mapping
// ============================================================

export function privacyTierFromIdentityType(identityType: Identity['type']): PrivacyTier {
  switch (identityType) {
    case 'CORE':
      return 'SOFT';
    case 'BURNER':
      return 'SHADOW';
    case 'SHADOW':
      return 'GHOST';
    default:
      throw new JasonOSError(
        `Unknown identity type: ${identityType}`,
        'SESSION_INVALID_IDENTITY_TYPE'
      );
  }
}

// ============================================================
// Token Generation
// ============================================================

function generateToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString('base64');
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

// ============================================================
// In-Memory Session Manager
// ============================================================

export class InMemorySessionManager implements SessionManager {
  private readonly sessions: Map<string, Session> = new Map();
  private readonly expireHandlers: Set<(session: Session) => void> = new Set();

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  async createSession(identity: Identity): Promise<Session> {
    this.cleanupExpiredSessions();

    const now = Date.now();
    const session: Session = {
      id: generateId(),
      token: generateToken(),
      identity,
      createdAt: now,
      expiresAt: now + DEFAULT_SESSION_DURATION_MS,
      privacyTier: privacyTierFromIdentityType(identity.type),
      isBurner: false,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async resumeSession(token: string): Promise<Session | null> {
    this.cleanupExpiredSessions();

    for (const session of this.sessions.values()) {
      if (session.token === token) {
        if (session.expiresAt <= Date.now()) {
          this.sessions.delete(session.id);
          this.notifyExpire(session);
          return null;
        }
        return session;
      }
    }

    return null;
  }

  async expireSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.notifyExpire(session);
    }
  }

  getActiveSession(): Session | null {
    this.cleanupExpiredSessions();

    // Return the most recently created active session
    let mostRecent: Session | null = null;
    for (const session of this.sessions.values()) {
      if (!mostRecent || session.createdAt > mostRecent.createdAt) {
        mostRecent = session;
      }
    }
    return mostRecent;
  }

  listActiveSessions(): Session[] {
    this.cleanupExpiredSessions();
    return Array.from(this.sessions.values());
  }

  // ------------------------------------------------------------------
  // Burner Sessions
  // ------------------------------------------------------------------

  async createBurnerSession(): Promise<Session> {
    this.cleanupExpiredSessions();

    const now = Date.now();
    const identity: Identity = {
      id: generateId(),
      type: 'BURNER',
      displayName: `Burner-${randomBytes(4).toString('hex')}`,
      createdAt: now,
    };

    const session: Session = {
      id: generateId(),
      token: generateToken(),
      identity,
      createdAt: now,
      expiresAt: now + BURNER_SESSION_DURATION_MS,
      privacyTier: privacyTierFromIdentityType(identity.type),
      isBurner: true,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  // ------------------------------------------------------------------
  // Identity Switching
  // ------------------------------------------------------------------

  async switchIdentity(sessionId: string, identity: Identity): Promise<Session> {
    this.cleanupExpiredSessions();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new JasonOSError(
        `Session not found: ${sessionId}`,
        'SESSION_NOT_FOUND'
      );
    }

    const updatedSession: Session = {
      ...session,
      identity,
      privacyTier: privacyTierFromIdentityType(identity.type),
    };

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  // ------------------------------------------------------------------
  // Session Extension
  // ------------------------------------------------------------------

  async extendSession(sessionId: string, durationMs: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new JasonOSError(
        `Session not found: ${sessionId}`,
        'SESSION_NOT_FOUND'
      );
    }

    this.sessions.set(sessionId, {
      ...session,
      expiresAt: session.expiresAt + durationMs,
    });
  }

  // ------------------------------------------------------------------
  // Expiry Callbacks
  // ------------------------------------------------------------------

  onSessionExpire(handler: (session: Session) => void): () => void {
    this.expireHandlers.add(handler);
    return (): void => {
      this.expireHandlers.delete(handler);
    };
  }

  // ------------------------------------------------------------------
  // Internal Helpers
  // ------------------------------------------------------------------

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: Session[] = [];

    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        expired.push(session);
        this.sessions.delete(id);
      }
    }

    for (const session of expired) {
      this.notifyExpire(session);
    }
  }

  private notifyExpire(session: Session): void {
    for (const handler of this.expireHandlers) {
      handler(session);
    }
  }
}

// ============================================================
// Factory
// ============================================================

export function createSessionManager(): SessionManager {
  return new InMemorySessionManager();
}
