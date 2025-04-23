<script lang="ts">
    import SlidingPageWrapper from '$lib/components/SlidingPageWrapper.svelte';
    import VersionBackground from '$lib/images/versions/1.21.webp';
    import { translations } from '$lib/utils/translationUtils';
    import { IdleAnimation, SkinViewer } from "skinview3d";
    import { onMount } from 'svelte';

    $: lang = $translations;

    let skinViewer: SkinViewer;
    let launchButtonHovered = false;
    let launchButtonVisible = true;

    onMount(() => {
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
    });
</script>

<SlidingPageWrapper page="play">
    <!-- svelte-ignore a11y_img_redundant_alt -->
    <img class="image" src={VersionBackground} alt="Background Image">
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <div class="skin" class:levetating={launchButtonHovered} id="skin" />
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="play-button" onmouseenter={() => launchButtonHovered = true} onmouseleave={() => launchButtonHovered = false}>
        <p class="launch-text">{lang.play.button.launch}</p>
        {#if launchButtonHovered}
            <div class="spacer" />
            <p class="dropdown-arrow">></p>
        {/if}
    </div>
</SlidingPageWrapper>

<style>
    .image {
        image-rendering: optimizeSpeed;
        width: calc(100% - 2 * 35px);
        max-height: calc(100% - 2 * 35px);
        object-fit: cover;
        border: var(--primary-color) 6.5px solid;
        mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.35));
    }

    .skin {
        position: absolute;
        bottom: 20px;
    }

    .skin.levetating {
        bottom: 30px;
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

    .play-button .launch-text {
        font-size: 60px;
        height: 65px;
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
        width: 2px;
        height: 60%;
        margin: 0 20px;
        background-color: var(--primary-color);
    }

    .play-button .dropdown-arrow {
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