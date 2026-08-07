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

// Placeholder implementation
export function createEventBus(): EventBus {
  const handlers = new Map<string, Array<(event: JasonOSEvent<unknown>) => void>>();

  return {
    emit<T>(event: JasonOSEvent<T>): void {
      const typeHandlers = handlers.get(event.type) ?? [];
      typeHandlers.forEach((h) => h(event as JasonOSEvent<unknown>));
    },
    on<T>(type: string, handler: (event: JasonOSEvent<T>) => void): () => void {
      const existing = handlers.get(type) ?? [];
      const wrapped = handler as (event: JasonOSEvent<unknown>) => void;
      existing.push(wrapped);
      handlers.set(type, existing);
      return () => {
        const current = handlers.get(type) ?? [];
        handlers.set(
          type,
          current.filter((h) => h !== wrapped)
        );
      };
    },
  };
}
