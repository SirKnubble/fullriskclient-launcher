<script lang="ts">
    import { activeTab, TABS } from "$lib/utils/navigationUtils";
</script>

<div class="top-navbar-root" data-tauri-drag-region>
    {#each TABS as tab, i}
        <div class="tab" on:click={tab.onClick}>
            <p class="name" class:quit={tab.name == 'quit'} class:active={$activeTab == tab.name}>{tab.name}</p>
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
        cursor: pointer;
        height: 80%;
    }

    .tab .name {
        font-size: 50px;
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
        margin: 0 30px;
        font-size: 50px;
    }
</style>