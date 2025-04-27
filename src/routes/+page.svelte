<script lang="ts">
	import Capes from './../lib/pages/Capes.svelte';
	import Play from './../lib/pages/Play.svelte';
    import { activeTab } from '$lib/utils/navigationUtils';
    import { onMount } from 'svelte';
    import { language, setLanguage, translations } from '$lib/utils/translationUtils';
    import TopNavigationBar from '$lib/components/TopNavigationBar.svelte';
    import { launcherStartCompleted } from '$lib/utils/missilaniousUtils';
    import { loadProfiles } from '$lib/utils/profileUtils';
    import { loadAccounts } from '$lib/utils/accountUtils';
    import Settings from '$lib/pages/Settings.svelte';
    import { listen } from '@tauri-apps/api/event';
    import type { EventPayload } from '$lib/types/core';
    import { currentEvent } from '$lib/utils/eventUtils';
  import { loadConfig } from '$lib/utils/configUtils';
  import Skins from '$lib/pages/Skins.svelte';

    $: lang = $translations;

    let unlistenFunction: (() => void) | null = null;

    const initializeListener = async () => {
        try {
            unlistenFunction = await listen<EventPayload>('state_event', (event) => {
                console.log('State Event Received:', event.payload); // Zum Debuggen
                currentEvent.set(event.payload);
            });
        } catch (error) {
            console.error("Failed to initialize event listener:", error);
        }
    }
    
    onMount(() => {
        setLanguage($language);
        loadConfig();
        loadAccounts();
        loadProfiles();

        setTimeout(() => {
            launcherStartCompleted.set(true);
        }, 1000);

        initializeListener();
    	return () => {
			if (unlistenFunction) {
                console.log("Cleaning up state_event listener.");
				unlistenFunction();
			}
		};
    });
</script>

{#if lang?.dummy}
    <div class="window">
        <div class="drag-bar">
            <TopNavigationBar />
        </div>
        <div class="content">
            {#if $activeTab == 'play'}
                <Play />
            {:else if $activeTab == 'capes'}
                <Capes />
            {:else if $activeTab == 'skins'}
                <Skins />
            {:else if $activeTab == 'settings'}
                <Settings />
            {/if}
        </div>
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <div class="drag-bar" data-tauri-drag-region />
    </div>
{/if}

<style>
    .window {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        width: 1200px;
        height: 800px;
        background-color: var(--background-color);
        overflow: hidden;
    }

    .drag-bar {
        width: 100%;
        height: 8.5%;
        z-index: 1000;
        /* background-color: var(--background-contrast-color); */
        background-color: #222126;
    }

    .content {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 83%;
    }
</style>