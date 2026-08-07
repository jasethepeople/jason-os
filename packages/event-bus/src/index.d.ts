/**
 * @jason-os/event-bus — Event bus for cross-module communication in Jason-OS.
 */
/** Event payload structure for Jason-OS events */
export interface JasonOSEvent<T = unknown> {
    type: string;
    data: T;
    source: string;
    timestamp?: number;
}
/** Simple event bus interface */
export interface EventBus {
    emit<T>(event: JasonOSEvent<T>): void;
    on<T>(type: string, handler: (event: JasonOSEvent<T>) => void): () => void;
}
export declare function createEventBus(): EventBus;
//# sourceMappingURL=index.d.ts.map