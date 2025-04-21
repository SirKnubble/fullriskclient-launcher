<script lang="ts">
    import type { EventPayload } from '../types'; // Assuming EventPayload is in types

    let { activeEvents = new Map<string, EventPayload>() }: { activeEvents: Map<string, EventPayload> } = $props();

    // Derived state to get events as an array for easier iteration
    let eventArray = $derived([...activeEvents.values()]);

</script>

<div class="debug-section-component">
    <h3>Debug Events</h3>
    <div class="debug-events-container">
        <div class="events-list">
            {#each eventArray as event (event.event_id)} 
                <div class="debug-event">
                    <p><strong>Event ID:</strong> {event.event_id}</p>
                    <p><strong>Type:</strong> {event.event_type}</p>
                    <p><strong>Target ID:</strong> {event.target_id ?? 'N/A'}</p>
                    <p><strong>Message:</strong> {event.message}</p>
                    {#if event.progress !== null}
                        <p><strong>Progress:</strong> {event.progress}</p>
                    {/if}
                    {#if event.error}
                        <p class="error"><strong>Error:</strong> {event.error}</p>
                    {/if}
                </div>
            {:else}
                <p class="no-events">Keine Events vorhanden</p>
            {/each}
        </div>
    </div>
</div>

<style>
    .debug-section-component {
        margin: 20px 0;
        padding: 15px;
        background-color: #f0f0f0;
        border-radius: 4px;
        border: 1px solid #ddd;
    }

    .debug-section-component h3 {
        margin: 0 0 10px 0;
        color: #333;
    }

    .debug-events-container {
        max-height: 200px; /* Limit height */
        overflow-y: auto; /* Make it scrollable */
        border: 1px solid #ccc;
        background-color: #fff; /* Background for the scrollable area */
        padding: 5px;
        border-radius: 3px;
    }

    .events-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .debug-event {
        padding: 10px;
        background-color: white;
        border-radius: 4px;
        border: 1px solid #eee;
    }

    .debug-event p {
        margin: 3px 0;
        font-size: 13px;
        word-break: break-word; /* Prevent long strings from overflowing */
    }

    .debug-event p.error {
        color: #e74c3c;
        font-weight: bold;
    }

    .no-events {
        color: #666;
        font-style: italic;
        padding: 10px;
    }
</style> 