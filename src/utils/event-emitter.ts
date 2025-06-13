/**
 * Simple event emitter implementation
 */
export class EventEmitter {
  private events: Record<string, Function[]> = {};

  /**
   * Register an event listener
   */
  public on(event: string, listener: Function): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);

    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter((l) => l !== listener);
    };
  }

  /**
   * Emit an event
   */
  public emit(event: string, ...args: any[]): void {
    const listeners = this.events[event];
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}
