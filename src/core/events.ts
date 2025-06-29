export type EventHandler<T = any> = (data: T) => void;

export class EventEmitter<EventMap extends Record<string, any> = Record<string, any>> {
  private events: Map<keyof EventMap, Set<EventHandler>> = new Map();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
    return this;
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): boolean {
    const handlers = this.events.get(event);
    if (!handlers || handlers.size === 0) {
      return false;
    }

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for "${String(event)}":`, error);
      }
    }
    return true;
  }

  once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): this {
    const onceWrapper = (data: EventMap[K]) => {
      this.off(event, onceWrapper);
      handler(data);
    };
    return this.on(event, onceWrapper);
  }

  removeAllListeners<K extends keyof EventMap>(event?: K): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  listenerCount<K extends keyof EventMap>(event: K): number {
    const handlers = this.events.get(event);
    return handlers ? handlers.size : 0;
  }
}
