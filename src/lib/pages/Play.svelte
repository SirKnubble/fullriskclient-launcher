<script lang="ts">
    import SlidingPageWrapper from '$lib/components/SlidingPageWrapper.svelte';
    import VersionBackground from '$lib/images/versions/1.21.webp';
</script>

<SlidingPageWrapper page="play">
    <img class="image" src={VersionBackground} alt="Background Image">
    <div class="play-button">
        <p class="launch-text">launch</p>
    </div>
</SlidingPageWrapper>

<style>
    .image {
        image-rendering: optimizeSpeed;
        width: calc(100% - 2 * 35px);
        max-height: calc(100% - 2 * 35px);
        object-fit: cover;
        border: var(--primary-color) 6.5px solid;
    }

    .play-button {
        position: absolute;
        width: 250px;
        height: 80px;
        bottom: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
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
</style>