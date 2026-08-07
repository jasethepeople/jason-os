import { type Session, type Identity, type PrivacyTier, type SessionManager } from '@jason-os/shared';
export declare function privacyTierFromIdentityType(identityType: Identity['type']): PrivacyTier;
export declare class InMemorySessionManager implements SessionManager {
    private readonly sessions;
    private readonly expireHandlers;
    createSession(identity: Identity): Promise<Session>;
    resumeSession(token: string): Promise<Session | null>;
    expireSession(sessionId: string): Promise<void>;
    getActiveSession(): Session | null;
    listActiveSessions(): Session[];
    createBurnerSession(): Promise<Session>;
    switchIdentity(sessionId: string, identity: Identity): Promise<Session>;
    extendSession(sessionId: string, durationMs: number): Promise<void>;
    onSessionExpire(handler: (session: Session) => void): () => void;
    private cleanupExpiredSessions;
    private notifyExpire;
}
export declare function createSessionManager(): SessionManager;
//# sourceMappingURL=session-manager.d.ts.map