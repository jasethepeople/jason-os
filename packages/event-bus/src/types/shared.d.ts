declare module '@jason-os/shared' {
  export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';
  export interface EventPayload<T = unknown> {
    type: string;
    payload: T;
    priority: Priority;
    timestamp: number;
    source: string;
    traceId: string;
  }
  export type EventHandler<T = unknown> = (event: EventPayload<T>) => void | Promise<void>;
  export interface Subscription {
    id: string;
    type: string;
    handler: EventHandler;
    priority: Priority;
    once: boolean;
  }
  export interface EventBus {
    emit<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void;
    on<T>(type: string, handler: EventHandler<T>, options?: { priority?: Priority; once?: boolean }): Subscription;
    once<T>(type: string, handler: EventHandler<T>, options?: { priority?: Priority }): Subscription;
    off(subscription: Subscription): void;
    broadcast<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void;
    subscribe<T>(pattern: string, handler: EventHandler<T>, options?: { priority?: Priority }): Subscription;
    unsubscribe(subscription: Subscription): void;
    getSubscriberCount(type: string): number;
    clear(): void;
  }
}
