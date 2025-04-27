import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
    id: number;
    type: NotificationType;
    message: string;
    timeout?: number; // Optional timeout in milliseconds
}

const { subscribe, update } = writable<Notification[]>([]);

let nextId = 0;

function addNotification(message: string, type: NotificationType = 'info', timeout: number = 5000) {
    const id = nextId++;
    const notification: Notification = { id, type, message, timeout };

    update(notifications => [...notifications, notification]);

    if (timeout) {
        setTimeout(() => {
            removeNotification(id);
        }, timeout);
    }

    // Return the ID in case the caller wants to manually remove it later
    return id;
}

function removeNotification(id: number) {
    update(notifications => notifications.filter(n => n.id !== id));
}

export const notificationStore = {
    subscribe,
    addNotification,
    removeNotification,
    // Helper functions for specific types
    success: (message: string, timeout?: number) => addNotification(message, 'success', timeout),
    error: (message: string, timeout?: number) => addNotification(message, 'error', timeout),
    info: (message: string, timeout?: number) => addNotification(message, 'info', timeout),
    warning: (message: string, timeout?: number) => addNotification(message, 'warning', timeout),
}; 