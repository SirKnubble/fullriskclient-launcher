<script lang="ts">
	import Capes from './../lib/pages/Capes.svelte';
	import Play from './../lib/pages/Play.svelte';
    import { activeTab } from '$lib/utils/navigationUtils';
    import { onMount } from 'svelte';
    import { setLanguage, translations } from '$lib/utils/translationUtils';
    import TopNavigationBar from '$lib/components/TopNavigationBar.svelte';
    import { launcherStartCompleted } from '$lib/utils/missilaniousUtils';
    import { loadProfiles } from '$lib/utils/profileUtils';

    $: lang = $translations;
    
    onMount(() => {
        setLanguage('en_US');
        loadProfiles();

        setTimeout(() => {
            launcherStartCompleted.set(true);
        }, 1000);
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
        background-color: var(--background-contrast-color);
    }

    .content {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 83%;
    }
</style>