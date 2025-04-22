<script lang="ts">
    import SlidingPageWrapper from '$lib/components/SlidingPageWrapper.svelte';
    import VersionBackground from '$lib/images/versions/1.21.webp';
</script>

<SlidingPageWrapper page="capes">
    <img class="image" src={VersionBackground} alt="Background Image">
</SlidingPageWrapper>

<style>
    .image {
        image-rendering: optimizeSpeed;
        width: calc(100% - 2 * 35px);
        max-height: calc(100% - 2 * 35px);
        object-fit: cover;
        border: var(--primary-color) 6.5px solid;
    }
</style>