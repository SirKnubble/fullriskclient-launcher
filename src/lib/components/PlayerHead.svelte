<!-- src/lib/components/PlayerHead.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import type { TexturesData } from '$lib/types/minecraft'; // Reuse existing type

    // Accept the base64 encoded ProfileProperty value as a prop
    // Add a size prop for customizable dimensions
    const { 
        profilePropertyValue, 
        size = 64 
    }: { 
        profilePropertyValue: string | undefined, 
        size?: number 
    } = $props();

    let canvasElement: HTMLCanvasElement | undefined = $state();
    let errorMessage: string | null = $state(null);
    let isLoading: boolean = $state(true);

    // Use $effect to react to changes in the property value
    $effect(() => {
        if (!profilePropertyValue || !canvasElement) {
            // If no value or canvas not ready, reset
            isLoading = false;
            errorMessage = !profilePropertyValue ? "No profile property value provided." : null;
            // Clear canvas if it exists
            const ctx = canvasElement?.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            }
            return; 
        }

        isLoading = true;
        errorMessage = null;
        const ctx = canvasElement!.getContext('2d');
        if (!ctx) {
            errorMessage = "Failed to get canvas context.";
            isLoading = false;
            return;
        }
        
        // Clear previous drawing
        ctx.clearRect(0, 0, canvasElement!.width, canvasElement!.height);

        let skinUrl: string | undefined;

        // 1. Decode Base64 and Parse JSON
        try {
            const decodedString = atob(profilePropertyValue);
            const texturesData: TexturesData = JSON.parse(decodedString);
            skinUrl = texturesData.textures?.SKIN?.url;

            if (!skinUrl) {
                throw new Error("SKIN URL not found in textures data.");
            }
            console.log("[PlayerHead] Skin URL extracted:", skinUrl);

        } catch (error) {
            console.error("[PlayerHead] Error decoding/parsing profile property:", error);
            errorMessage = "Failed to decode skin data.";
            isLoading = false;
            return;
        }

        // 2. Load Skin Image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = skinUrl;

        img.onload = () => {
            console.log("[PlayerHead] Skin image loaded successfully.");
            
            // Get context and draw *inside* onload, after ensuring canvas still exists
            if (!canvasElement) {
                 console.error("[PlayerHead] Canvas element became undefined before drawing.");
                 errorMessage = "Canvas element lost.";
                 isLoading = false;
                 return;
            }
            const ctxLoad = canvasElement.getContext('2d');
            if (!ctxLoad) {
                console.error("[PlayerHead] Failed to get canvas context inside onload.");
                errorMessage = "Failed to get canvas context.";
                isLoading = false;
                return;
            }

            try {
                // 3. Draw Head Layers onto Canvas
                const headSize = 8;
                ctxLoad.clearRect(0, 0, canvasElement.width, canvasElement.height);
                ctxLoad.imageSmoothingEnabled = false;

                // Draw Head Base Layer
                ctxLoad.drawImage(img, 
                    headSize, headSize, headSize, headSize, 
                    0, 0, canvasElement.width, canvasElement.height
                );
                console.log("[PlayerHead] Drawn head base layer.");

                // Draw Head Overlay Layer
                ctxLoad.drawImage(img, 
                    headSize * 5, headSize, headSize, headSize,
                    0, 0, canvasElement.width, canvasElement.height
                );
                console.log("[PlayerHead] Drawn head overlay layer.");
                
                errorMessage = null; // Clear any previous error

            } catch(drawError) {
                console.error("[PlayerHead] Error drawing skin head:", drawError);
                errorMessage = "Error rendering head.";
            } finally {
                 isLoading = false; // Set loading false regardless of drawing success/error
            }
        };

        img.onerror = (error) => {
            console.error("[PlayerHead] Failed to load skin image:", error);
            errorMessage = "Failed to load skin image.";
            isLoading = false;
        };
    });

</script>

<!-- Use inline style for dynamic width/height -->
<div class="player-head-container" style="width: {size}px; height: {size}px;">
    {#if errorMessage}
        <div class="error-message">⚠️ {errorMessage}</div>
    {:else}
        <!-- We use a fixed-size canvas. The drawing logic scales the 8x8 head up. -->
        <canvas 
            bind:this={canvasElement} 
            width={size} 
            height={size} 
            class="player-head-canvas" 
            class:loading={isLoading}
            title="Player Head"
        ></canvas>
        {#if isLoading && !errorMessage}
            <div class="loading-overlay"></div>
        {/if}
    {/if}
</div>

<style>
    .player-head-container {
        position: relative;
        /* width/height set inline */
        display: inline-block;
        vertical-align: middle;
        margin-right: 6px; /* Add spacing to the right */
        filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.3)); /* Add drop shadow */
    }

    .player-head-canvas {
        display: block;
        width: 100%;
        height: 100%;
        background-color: #f0f0f0; /* Light background for loading/error */
        /* For crisp pixels */
        image-rendering: pixelated;
        image-rendering: crisp-edges;
    }

    .player-head-canvas.loading {
        opacity: 0.5;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        /* Optional: Add a spinner or loading text */
        /* background: rgba(255, 255, 255, 0.5) url('/loading.gif') center center no-repeat; */
        /* background-size: 24px; */
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 0.8em;
        color: #555;
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