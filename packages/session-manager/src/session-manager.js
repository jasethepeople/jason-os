import { randomBytes } from 'crypto';
import { JasonOSError, } from '@jason-os/shared';
// ============================================================
// Constants
// ============================================================
const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const BURNER_SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour
const TOKEN_BYTE_LENGTH = 32;
// ============================================================
// Identity → PrivacyTier mapping
// ============================================================
export function privacyTierFromIdentityType(identityType) {
    switch (identityType) {
        case 'CORE':
            return 'SOFT';
        case 'BURNER':
            return 'SHADOW';
        case 'SHADOW':
            return 'GHOST';
        default:
            throw new JasonOSError(`Unknown identity type: ${identityType}`, 'SESSION_INVALID_IDENTITY_TYPE');
    }
}
// ============================================================
// Token Generation
// ============================================================
function generateToken() {
    return randomBytes(TOKEN_BYTE_LENGTH).toString('base64');
}
function generateId() {
    return randomBytes(16).toString('hex');
}
// ============================================================
// In-Memory Session Manager
// ============================================================
export class InMemorySessionManager {
    sessions = new Map();
    expireHandlers = new Set();
    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------
    async createSession(identity) {
        this.cleanupExpiredSessions();
        const now = Date.now();
        const session = {
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
    async resumeSession(token) {
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
    async expireSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.sessions.delete(sessionId);
            this.notifyExpire(session);
        }
    }
    getActiveSession() {
        this.cleanupExpiredSessions();
        // Return the most recently created active session
        let mostRecent = null;
        for (const session of this.sessions.values()) {
            if (!mostRecent || session.createdAt > mostRecent.createdAt) {
                mostRecent = session;
            }
        }
        return mostRecent;
    }
    listActiveSessions() {
        this.cleanupExpiredSessions();
        return Array.from(this.sessions.values());
    }
    // ------------------------------------------------------------------
    // Burner Sessions
    // ------------------------------------------------------------------
    async createBurnerSession() {
        this.cleanupExpiredSessions();
        const now = Date.now();
        const identity = {
            id: generateId(),
            type: 'BURNER',
            displayName: `Burner-${randomBytes(4).toString('hex')}`,
            createdAt: now,
        };
        const session = {
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
    async switchIdentity(sessionId, identity) {
        this.cleanupExpiredSessions();
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new JasonOSError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
        }
        const updatedSession = {
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
    async extendSession(sessionId, durationMs) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new JasonOSError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
        }
        this.sessions.set(sessionId, {
            ...session,
            expiresAt: session.expiresAt + durationMs,
        });
    }
    // ------------------------------------------------------------------
    // Expiry Callbacks
    // ------------------------------------------------------------------
    onSessionExpire(handler) {
        this.expireHandlers.add(handler);
        return () => {
            this.expireHandlers.delete(handler);
        };
    }
    // ------------------------------------------------------------------
    // Internal Helpers
    // ------------------------------------------------------------------
    cleanupExpiredSessions() {
        const now = Date.now();
        const expired = [];
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
    notifyExpire(session) {
        for (const handler of this.expireHandlers) {
            handler(session);
        }
    }
}
// ============================================================
// Factory
// ============================================================
export function createSessionManager() {
    return new InMemorySessionManager();
}
//# sourceMappingURL=session-manager.js.map