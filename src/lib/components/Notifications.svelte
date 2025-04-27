<script lang="ts">
    import { notificationStore, type Notification } from '$lib/stores/notificationStore';
    import { fly } from 'svelte/transition';

    let notifications: Notification[] = $state([]);

    notificationStore.subscribe(value => {
        notifications = value;
    });

    function closeNotification(id: number) {
        notificationStore.removeNotification(id);
    }
</script>

<div class="notifications-container">
    {#each notifications as notification (notification.id)}
        <div 
            class="notification notification-{notification.type}"
            in:fly={{ y: -20, duration: 300 }}
            out:fly={{ y: -20, duration: 200 }}
        >
            <span class="message">{notification.message}</span>
            <button class="close-button" onclick={() => closeNotification(notification.id)}>&times;</button>
        </div>
    {/each}
</div>

<style>
    .notifications-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 300px; /* Adjust width as needed */
    }

    .notification {
        padding: 12px 15px;
        border-radius: 5px;
        color: white;
        font-size: 0.9em;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        opacity: 0.95;
    }

    .notification-success {
        background-color: #2ecc71; /* Green */
    }

    .notification-error {
        background-color: #e74c3c; /* Red */
    }

    .notification-info {
        background-color: #3498db; /* Blue */
    }

    .notification-warning {
        background-color: #f39c12; /* Orange */
    }

    .message {
        flex-grow: 1;
        margin-right: 10px;
    }

    .close-button {
        background: none;
        border: none;
        color: white;
        font-size: 1.2em;
        line-height: 1;
        cursor: pointer;
        padding: 0 5px;
        opacity: 0.7;
    }

    .close-button:hover {
        opacity: 1;
    }
</style> 