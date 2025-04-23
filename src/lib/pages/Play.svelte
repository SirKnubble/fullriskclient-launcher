<script lang="ts">
	import VersionList from './../components/play/VersionList.svelte';
    import SlidingPageWrapper from '$lib/components/SlidingPageWrapper.svelte';
    import VersionBackground from '$lib/images/versions/1.21.webp';
    import { launcherStartCompleted } from '$lib/utils/missilaniousUtils';
    import { translations } from '$lib/utils/translationUtils';
    import { IdleAnimation, SkinViewer } from "skinview3d";
    import { onMount } from 'svelte';

    $: lang = $translations;

    let skinViewer: SkinViewer;
    let launchButtonHovered = false;
    let launchButtonVisible = $launcherStartCompleted;

    function selectVersion() {
        launchButtonVisible = false;
    }

    onMount(async() => {
        const canvas = document.createElement("canvas");
        skinViewer = new SkinViewer({
          canvas: canvas,
          width: 250,
          height: 420,
          skin: `https://crafatar.com/skins/625dd22b-bad2-4b82-a0bc-e43ba1c1a7fd`,
          animation: new IdleAnimation,
        });
        skinViewer.controls.enabled = false;
        skinViewer.camera.position.set(15, 5, 40);
        skinViewer.playerObject.position.set(0, -14, 0)
        document.getElementById('skin')?.appendChild(canvas);

        setTimeout(() => {
            launchButtonVisible = true;
        }, 350)
    });
</script>

<SlidingPageWrapper page="play">
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <div class="image-outline" />
    <!-- svelte-ignore a11y_img_redundant_alt -->
    <img class="image" class:dark={!launchButtonVisible} src={VersionBackground} alt="Background Image">
    <div class="version-selector-container">
        {#if !launchButtonVisible}
            <VersionList />
        {/if}
    </div>
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <div
        class="skin"
        class:hidden={!launchButtonVisible}
        class:levetating={launchButtonHovered}
        id="skin"
    />
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="play-button"
        class:hidden={!launchButtonVisible}
        id="play-button"
        onmouseenter={() => launchButtonHovered = true}
        onmouseleave={() => launchButtonHovered = false}
        onclick={() => {}}
    >
        <p class="launch-text">{lang.play.button.launch}</p>
        {#if launchButtonHovered}
            <div class="spacer" />
            <div class="dropdown-arrow-wrapper">
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <p class="dropdown-arrow" onclick={selectVersion}>></p>
            </div>
        {/if}
    </div>
</SlidingPageWrapper>

<style>
    .image {
        image-rendering: optimizeSpeed;
        width: calc(100% - 2 * 35px);
        max-height: calc(100% - 2 * 35px);
        object-fit: cover;
        mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.4));
    }

    .image.dark {
        filter: brightness(0.15);
    }
    
    .image-outline {
        position: absolute;
        width: calc(100% - 2 * 35px);
        height: calc(100% - 2 * 35px);
        border: var(--primary-color) 6.5px solid;
        z-index: 100;
    }

    .version-selector-container {
        position: absolute;
        width: calc(100% - 2 * 35px);
        height: calc(100% - 2 * 35px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 100;
    }

    .skin {
        position: absolute;
        bottom: 20px;
    }

    .skin.levetating {
        bottom: 30px;
    }

    .skin.hidden {
        transform: translateY(100%);
    }

    .play-button {
        position: fixed !important;
        width: 250px;
        height: 65px;
        bottom: 15px;
        display: flex;
        z-index: 100;
        justify-content: center;
        align-items: center;
        display: flex;
        flex-direction: row;
        background-color: var(--secondary-color);
        border: var(--primary-color) 6.5px solid;
        cursor: pointer;
    }

    .play-button.hidden, .play-button:hover.hidden {
        transform: translateY(500%);
    }

    .play-button .launch-text {
        font-size: 60px;
        height: 65px;
        width: 100%;
        text-align: center;
        color: var(--background-color);
    }

    .play-button:hover {
        transform: scale(1.05);
    }

    .play-button:hover .launch-text {
        color: var(--hover-color);
        transform: scaleX(1.1);
    }

    .play-button .spacer {
        width: 3.5px;
        height: 60%;
        margin-right: 5px;
        background-color: var(--primary-color);
    }

    .play-button .dropdown-arrow-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 45px;
        height: 100%;
    }

    .play-button .dropdown-arrow {
        position: absolute;
        margin-top: 5px;
        font-size: 70px;
        margin-left: 12.5px;
        transform: rotateZ(90deg);
        color: var(--background-color);
    }

    .dropdown-arrow:hover {
        color: var(--hover-color);
        transform: rotateZ(90deg) scale(1.1);
    }
</style>