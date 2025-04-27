<!-- src/lib/components/CapeShowcase.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import CapeImage from './CapeImage.svelte';
    import Cape3DRenderer from './Cape3DRenderer.svelte';

    // Props
    const { 
        imageUrl,
        width = 600,        // Default width for the container
        height = 400,       // Default height for the container
        defaultView = '3d'  // Default view mode: '3d' or '2d'
    }: { 
        imageUrl: string | undefined, 
        width?: number,
        height?: number,
        defaultView?: '3d' | '2d'
    } = $props();

    // State
    let activeView: '3d' | '2d' = $state(defaultView);
    let is3DSupported: boolean = $state(true);
    let errorMessage: string | null = $state(null);

    // Calculate dimensions for the 3D view
    const threeDWidth = $derived(width);
    const threeDHeight = $derived(height);

    // Calculate dimensions for the 2D views
    const twoDWidth = $derived(Math.min(width / 2 - 10, 150)); // Max width for 2D views
    const twoDContainerWidth = $derived(width);

    // Check if WebGL is supported
    onMount(() => {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            is3DSupported = !!gl;
            
            if (!is3DSupported) {
                console.warn("[CapeShowcase] WebGL not supported, falling back to 2D view");
                activeView = '2d';
                errorMessage = "3D view not supported in your browser. Showing 2D view instead.";
            }
        } catch (e) {
            console.error("[CapeShowcase] Error checking WebGL support:", e);
            is3DSupported = false;
            activeView = '2d';
            errorMessage = "Error initializing 3D view. Showing 2D view instead.";
        }
    });

    // Switch between 2D and 3D views
    function switchView(view: '3d' | '2d') {
        if (view === '3d' && !is3DSupported) {
            errorMessage = "3D view is not supported in your browser.";
            return;
        }
        
        activeView = view;
        errorMessage = null;
    }
</script>

<div class="cape-showcase" style="width: {width}px;">
    <!-- View toggle buttons -->
    <div class="view-toggle">
        <button 
            class:active={activeView === '3d'} 
            on:click={() => switchView('3d')}
            disabled={!is3DSupported}
        >
            3D View
        </button>
        <button 
            class:active={activeView === '2d'} 
            on:click={() => switchView('2d')}
        >
            2D View
        </button>
    </div>

    {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
    {/if}

    <!-- 3D View -->
    {#if activeView === '3d' && is3DSupported}
        <div class="view-container">
            <Cape3DRenderer 
                imageUrl={imageUrl}
                width={threeDWidth}
                height={threeDHeight}
                autoRotate={true}
            />
        </div>
    {/if}

    <!-- 2D View -->
    {#if activeView === '2d'}
        <div class="view-container two-d-container" style="width: {twoDContainerWidth}px;">
            <div class="cape-front">
                <h4>Front</h4>
                <CapeImage 
                    imageUrl={imageUrl}
                    part="front"
                    width={twoDWidth}
                />
            </div>
            <div class="cape-back">
                <h4>Back</h4>
                <CapeImage 
                    imageUrl={imageUrl}
                    part="back"
                    width={twoDWidth}
                />
            </div>
        </div>
    {/if}
</div>

<style>
    .cape-showcase {
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 15px;
        margin-bottom: 20px;
        background-color: #f9f9f9;
    }

    .view-toggle {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
    }

    .view-toggle button {
        padding: 8px 16px;
        background-color: #f0f0f0;
        color: #333;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .view-toggle button.active {
        background-color: #4a90e2;
        color: white;
        border-color: #357abd;
    }

    .view-toggle button:hover:not(:disabled) {
        background-color: #e0e0e0;
    }

    .view-toggle button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .view-container {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 10px;
    }

    .two-d-container {
        display: flex;
        justify-content: space-around;
        gap: 20px;
    }

    .cape-front, .cape-back {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    h4 {
        margin: 0 0 10px 0;
        font-size: 1em;
        color: #555;
    }

    .error-message {
        padding: 10px;
        margin: 10px 0;
        background-color: #fbeae8;
        border: 1px solid #e74c3c;
        color: #e74c3c;
        border-radius: 4px;
        text-align: center;
    }
</style>