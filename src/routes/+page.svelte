<script lang="ts">
	import Capes from './../lib/pages/Capes.svelte';
	import Play from './../lib/pages/Play.svelte';
	import TopNavigationBar from '../lib/components/home/TopNavigationBar.svelte';
    import { activeTab } from '$lib/utils/navigationUtils';
    import { onMount, tick } from 'svelte';
    import { setLanguage, translations } from '$lib/utils/translationUtils';
    import { get } from 'svelte/store';

    $: lang = $translations;
    
    onMount(() => {
        setLanguage('en_US');
        console.log(lang);
        
    });
</script>

{#if lang?.dummy}
    <div class="window">
        <div class="drag-bar">
            <!-- <TopNavigationBar /> -->
        </div>
        <div class="content">
            {#if $activeTab == 'play'}
                <Play />
            {:else if $activeTab == 'capes'}
                <Capes />
            {/if}
        </div>
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
    }

    .drag-bar {
        width: 100%;
        height: 8%;
        background-color: var(--background-contrast-color);
    }

    .content {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 84%;
    }
</style>