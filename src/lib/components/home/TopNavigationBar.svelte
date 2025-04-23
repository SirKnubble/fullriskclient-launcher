<script lang="ts">
    import { activeTab, selectTab } from "$lib/utils/navigationUtils";
    import { translations } from "$lib/utils/translationUtils";
    import { onMount } from "svelte";

    $: lang = $translations;

    let TABS: Record<string, any>[] = [];

    onMount(() => {
        TABS = [
            {
                slug: 'settings',
                name: lang.navbar.settings,
                onClick: () => selectTab(TABS, 'settings')
            },
            {
                slug: 'skins',
                name: lang.navbar.skins,
                onClick: () => selectTab(TABS, 'skins')
            },
            {
                slug: 'capes',
                name: lang.navbar.capes,
                onClick: () => selectTab(TABS, 'capes')
            },
            {
                slug: 'play',
                name: lang.navbar.play,
                onClick: () => selectTab(TABS, 'play')
            },
            {
                slug: 'profiles',
                name: lang.navbar.profiles,
                onClick: () => selectTab(TABS, 'profiles')
            },
            {
                slug: 'addons',
                name: lang.navbar.addons,
                onClick: () => selectTab(TABS, 'addons')
            },
            {
                slug: 'quit',
                name: lang.navbar.quit,
                onClick: () => {}
            }
        ];
    });
</script>

<div class="top-navbar-root" data-tauri-drag-region>
    {#each TABS as tab, i}
        <div class="tab">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <p
                class="name"
                on:click={tab.onClick}
                class:quit={tab.slug == 'quit'}
                class:active={$activeTab == tab.slug}
            >{tab.name}</p>
            {#if i != TABS.length - 1}
                <p class="seperator">|</p>
            {/if}
        </div>
    {/each}
</div>

<style>
    .top-navbar-root {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        height: 100%;
        width: 100%;
    }
    
    .tab {
        display: flex;
        flex-direction: row;
        height: 75%;
    }

    .tab .name {
        font-size: 50px;
        cursor: pointer;
        padding: 0 25px;
    }

    .tab .name:hover {
        color: var(--hover-color);
    }
    
    .tab .name.quit:hover {
        color: var(--red-text);
    }

    .tab .name.active {
        color: var(--primary-color);
        text-shadow: var(--primary-color-text-shadow) 2px 2px;
        transform: scaleX(1.15);
    }
    
    .tab .seperator {
        font-size: 50px;
    }
</style>