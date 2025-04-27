<!-- src/lib/components/CapeImage.svelte -->
<script lang="ts">
    import { onMount } from "svelte";

    // Props
    const { 
        imageUrl, 
        part = 'front', 
        width = 60        // Default width, height will be calculated
    }: { 
        imageUrl: string | undefined, 
        part?: 'front' | 'back', 
        width?: number 
    } = $props();

    // Calculate height based on width and cape aspect ratio (10:16)
    let height = $derived(Math.round(width * (16 / 10)));

    let canvasElement: HTMLCanvasElement | undefined = $state();
    let errorMessage: string | null = $state(null);
    let isLoading: boolean = $state(true);

    // Constants for cape layout (scaled for 512x256 source)
    const SCALE_FACTOR = 8;
    const CAPE_SRC_WIDTH = 10 * SCALE_FACTOR;  // 80
    const CAPE_SRC_HEIGHT = 16 * SCALE_FACTOR; // 128
    const FRONT_X = 1 * SCALE_FACTOR;         // 8
    const FRONT_Y = 1 * SCALE_FACTOR;         // 8
    const BACK_X = 12 * SCALE_FACTOR;        // 96
    const BACK_Y = 1 * SCALE_FACTOR;         // 8

    $effect(() => {
        // Reset state when props change
        isLoading = true;
        errorMessage = null;
        const ctx = canvasElement?.getContext('2d');
        if (ctx && canvasElement) {
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }

        // Exit if no canvas or URL
        if (!canvasElement) {
            console.warn("[CapeImage] Effect ran before canvas was ready.");
            isLoading = false;
            return;
        }
        if (!imageUrl) {
            console.log("[CapeImage] No imageUrl provided.");
            isLoading = false; // Nothing to load
            return;
        }

        console.log(`[CapeImage] Loading ${part} from ${imageUrl}`);
        const img = new Image();
        img.crossOrigin = 'anonymous'; // May be needed depending on CDN
        img.src = imageUrl;

        img.onload = () => {
            console.log("[CapeImage] Image loaded.");
            if (!canvasElement) {
                console.error("[CapeImage] Canvas lost before drawing.");
                errorMessage = "Canvas lost.";
                isLoading = false;
                return;
            }
            const ctxLoad = canvasElement.getContext('2d');
            if (!ctxLoad) {
                errorMessage = "Failed to get canvas context.";
                isLoading = false;
                return;
            }

            try {
                // Determine source coordinates based on 'part' prop
                const sx = part === 'back' ? BACK_X : FRONT_X;
                const sy = part === 'back' ? BACK_Y : FRONT_Y;
                
                ctxLoad.clearRect(0, 0, canvasElement.width, canvasElement.height);
                ctxLoad.imageSmoothingEnabled = false; // Pixelated look

                // Draw the selected part, scaled to the canvas size
                ctxLoad.drawImage(img,
                    sx, sy, CAPE_SRC_WIDTH, CAPE_SRC_HEIGHT,         // Source rectangle
                    0, 0, canvasElement.width, canvasElement.height // Destination rectangle
                );
                console.log(`[CapeImage] Drawn ${part} part.`);
                errorMessage = null;

            } catch (drawError) {
                console.error("[CapeImage] Error drawing cape part:", drawError);
                errorMessage = "Error rendering cape.";
            } finally {
                isLoading = false;
            }
        };

        img.onerror = (error) => {
            console.error("[CapeImage] Failed to load cape image:", imageUrl, error);
            errorMessage = "Failed to load cape image.";
            isLoading = false;
        };
    });

</script>

<div class="cape-image-container" style="width: {width}px; height: {height}px;">
    {#if errorMessage}
        <div class="error-message">⚠️ {errorMessage}</div>
    {:else}
        <canvas 
            bind:this={canvasElement} 
            width={width} 
            height={height} 
            class="cape-canvas" 
            class:loading={isLoading}
            title="Cape {part}"
        ></canvas>
    {/if}
</div>

<style>
    .cape-image-container {
        position: relative;
        /* width/height set inline */
        display: inline-block;
        vertical-align: middle;
        background-color: #eee; /* Placeholder background */
         overflow: hidden; /* Hide potential overflow if aspect ratio differs */
    }

    .cape-canvas {
        display: block;
        width: 100%;
        height: 100%;
        /* For crisp pixels */
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        background-color: #f0f0f0; /* Visible if image fails but no error shown */
    }

    .cape-canvas.loading {
        opacity: 0.5;
    }
    
    .error-message {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        font-size: 0.8em;
        color: #e74c3c;
        background-color: #fbeae8;
        border: 1px solid #e74c3c;
        box-sizing: border-box; 
        padding: 5px;
    }
</style> 