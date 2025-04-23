<script lang="ts">
  import { launcherStartCompleted } from "$lib/utils/missilaniousUtils";
    import { closeTabDirection, resetCloseTabDirection } from "$lib/utils/navigationUtils";
    import { onMount } from "svelte";

    export let page: string;

    closeTabDirection.subscribe((direction) => {
        if (!direction) return;
        const root = document.getElementById(`${page}-root`);
        if (root) {
            root.animate(
                [
                    { transform: 'translateX(0)' },
                    { transform: `translateX(${direction == 'left' ? '-100%' : '100%'})` }
                ],
                {
                    duration: 100,
                    easing: 'ease-in',
                    fill: 'forwards'
                }
            );
        }
    });

    onMount(() => {
        
        const root = document.getElementById(`${page}-root`);
        if (root) {
            if (!$launcherStartCompleted) {
                return root.animate(
                    [
                        { transform: 'translateX(0)' }
                    ],
                    {
                        duration: 1,
                        easing: 'ease-out',
                        fill: 'forwards'
                    }
                );
            };
            root.animate(
                [
                    { transform: `translateX(${$closeTabDirection == 'right' ? '-100%' : '100%'})` },
                    { transform: 'translateX(0)' }
                ],
                {
                    duration: 150,
                    easing: 'ease-out',
                    fill: 'forwards'
                }
            );
            resetCloseTabDirection();
        }
    });
</script>

<div class="active-sliding-page-root " id={`${page}-root`}>
    <slot />
</div>

<style>
    .active-sliding-page-root {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        transition-duration: 0.2s;
    }
</style>