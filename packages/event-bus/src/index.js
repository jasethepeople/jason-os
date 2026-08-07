/**
 * @jason-os/event-bus — Event bus for cross-module communication in Jason-OS.
 */
// Placeholder implementation
export function createEventBus() {
    const handlers = new Map();
    return {
        emit(event) {
            const typeHandlers = handlers.get(event.type) ?? [];
            typeHandlers.forEach((h) => h(event));
        },
        on(type, handler) {
            const existing = handlers.get(type) ?? [];
            const wrapped = handler;
            existing.push(wrapped);
            handlers.set(type, existing);
            return () => {
                const current = handlers.get(type) ?? [];
                handlers.set(type, current.filter((h) => h !== wrapped));
            };
        },
    };
}
//# sourceMappingURL=index.js.map