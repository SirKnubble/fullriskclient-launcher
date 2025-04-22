<script lang="ts">
    import { activeTab } from "$lib/utils/navigationUtils";
  import { translations } from "$lib/utils/translationUtils";

    $: lang = $translations;

    let TABS = [
        {
            name: lang.navbar.settings,
            onClick: () => selectTab('settings')
        },
        {
            name: lang.navbar.skins,
            onClick: () => selectTab('skins')
        },
        {
            name: lang.navbar.capes,
            onClick: () => selectTab('capes')
        },
        {
            name: lang.navbar.play,
            onClick: () => selectTab('play')
        },
        {
            name: lang.navbar.profiles,
            onClick: () => selectTab('profiles')
        },
        {
            name: lang.navbar.addons,
            onClick: () => selectTab('addons')
        },
        {
            name: lang.navbar.quit,
            onClick: () => {}
        }
    ];
</script>

<div class="top-navbar-root" data-tauri-drag-region>
    {#each TABS as tab, i}
        <div class="tab">
            <p class="name" on:click={tab.onClick} class:quit={tab.slug == 'quit'} class:active={$activeTab == tab.slug}>{tab.name}</p>
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
        height: 80%;
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