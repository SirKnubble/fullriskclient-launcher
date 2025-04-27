<!-- src/lib/components/Cape3DRenderer.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as THREE from "three";
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

    // Props
    const { 
        imageUrl, 
        width = 400,
        height = 300,
        autoRotate = false,
        backgroundColor = "#f0f0f0"
    }: { 
        imageUrl: string | undefined,
        width?: number,
        height?: number,
        autoRotate?: boolean,
        backgroundColor?: string
    } = $props();

    // State
    let canvasElement: HTMLCanvasElement | undefined = $state();
    let errorMessage: string | null = $state(null);
    let isLoading: boolean = $state(true);

    // Three.js objects
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let capeMesh: THREE.Mesh | null = null;
    let animationFrameId: number | null = null;

    // Cape dimensions (scaled for Minecraft proportions)
    const CAPE_BOX_WIDTH = 10;
    const CAPE_BOX_HEIGHT = 16;
    const CAPE_BOX_DEPTH = 1; // Give it some thickness

    // Texture coordinates constants (assuming standard 64x32 cape texture)
    // Image dimensions
    const IMG_W = 64;
    const IMG_H = 32;

    // UV coordinates helpers
    const u = (x: number) => x / IMG_W;
    const v = (y: number) => 1 - y / IMG_H; // Y is flipped

    // Cape texture regions (in pixels) - Adjusted for clarity
    const T_RIGHT =   [0,  1,  1, 16];
    const T_FRONT =   [1,  1, 10, 16];
    const T_LEFT =    [11, 1,  1, 16];
    const T_BACK =    [12, 1, 10, 16];
    const T_TOP =     [1,  0, 10,  1];
    const T_BOTTOM =  [11, 0, 10,  1];

    // Track current image URL to detect changes
    let currentImageUrl = imageUrl;

    // Setup and cleanup
    onMount(() => {
        if (!canvasElement) {
            errorMessage = "Canvas element not available";
            isLoading = false;
            return;
        }

        if (!imageUrl) {
            errorMessage = "No cape image URL provided";
            isLoading = false;
            return;
        }

        try {
            initThreeJs();
            loadCapeTexture();
        } catch (error) {
            console.error("[Cape3DRenderer] Error initializing:", error);
            errorMessage = "Failed to initialize 3D renderer";
            isLoading = false;
        }
    });

    onDestroy(() => {
        // Clean up Three.js resources
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
        }

        if (controls) {
            controls.dispose();
        }

        if (renderer) {
            renderer.dispose();
        }

        // Dispose of geometry and materials
        if (capeMesh) {
            capeMesh.geometry.dispose();
            if (capeMesh.material instanceof THREE.Material) {
                capeMesh.material.dispose();
            } else if (Array.isArray(capeMesh.material)) {
                capeMesh.material.forEach((material: THREE.Material) => material.dispose());
            }
        }

        scene = null;
        camera = null;
        renderer = null;
        controls = null;
        capeMesh = null;
    });

    // Initialize Three.js scene, camera, renderer
    function initThreeJs() {
        if (!canvasElement) return;

        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(backgroundColor);

        // Create camera
        const aspectRatio = width / height;
        camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
        camera.position.set(0, 0, 30);

        // Create renderer
        renderer = new THREE.WebGLRenderer({
            canvas: canvasElement,
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        // Add orbit controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 1.0;
        controls.enableZoom = true;
        controls.minDistance = 10;  // Allow closer zoom
        controls.maxDistance = 70;  // Allow further zoom out

        // Enhanced lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        const frontFill = new THREE.DirectionalLight(0xffffff, 0.7);
        frontFill.position.set(0, 0, 10);
        scene.add(frontFill);
        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(-5, 3, -5);
        scene.add(backLight);
        const bottomLight = new THREE.DirectionalLight(0xffffff, 0.3);
        bottomLight.position.set(0, -10, 0);
        scene.add(bottomLight);

        // Start animation loop
        animate();

        // Handle window resize
        const handleResize = () => {
            if (!camera || !renderer) return;
            
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }

    // Load cape texture and create 3D model
    function loadCapeTexture() {
        if (!scene || !imageUrl) return;

        isLoading = true;
        errorMessage = null;
        currentImageUrl = imageUrl; // Update tracked URL

        const textureLoader = new THREE.TextureLoader();
        textureLoader.crossOrigin = 'anonymous';
        
        textureLoader.load(
            imageUrl,
            (texture: THREE.Texture) => {
                // Texture loaded successfully
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                
                // No need to crop the texture anymore, use the full texture
                createCapeModel(texture);
                isLoading = false;
            },
            (progress) => { // ProgressEvent type might be more specific if needed
                // Loading progress
                console.log(`[Cape3DRenderer] Loading: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            },
            (error: unknown) => {
                // Error loading texture
                console.error("[Cape3DRenderer] Error loading texture:", error);
                errorMessage = "Failed to load cape texture";
                isLoading = false;
            }
        );
    }

    // Create the 3D cape model
    function createCapeModel(texture: THREE.Texture) {
        if (!scene) return;

        // Create cape geometry (Box)
        const geometry = new THREE.BoxGeometry(
            CAPE_BOX_WIDTH, 
            CAPE_BOX_HEIGHT, 
            CAPE_BOX_DEPTH
        );
        
        // --- Apply UV Mapping --- 
        const uv = geometry.attributes.uv;
        uv.needsUpdate = true;

        // Helper function to map texture area to UV coordinates - Adjusted for vertical flip
        const mapUV = (area: number[]) => [
            new THREE.Vector2(u(area[0]),          v(area[1])),          // Top-Left (use top V coordinate)
            new THREE.Vector2(u(area[0] + area[2]), v(area[1])),          // Top-Right (use top V coordinate)
            new THREE.Vector2(u(area[0]),          v(area[1] + area[3])), // Bottom-Left (use bottom V coordinate)
            new THREE.Vector2(u(area[0] + area[2]), v(area[1] + area[3])), // Bottom-Right (use bottom V coordinate)
        ];

        // BoxGeometry face order: Right (+X), Left (-X), Top (+Y), Bottom (-Y), Front (+Z), Back (-Z)
        const uvOrder = [
            ...mapUV(T_RIGHT),
            ...mapUV(T_LEFT),
            ...mapUV(T_TOP),
            ...mapUV(T_BOTTOM),
            ...mapUV(T_FRONT),
            ...mapUV(T_BACK),
        ];
        
        // Apply the UV map to the geometry
        for (let i = 0; i < uvOrder.length; i++) {
            uv.setXY(i, uvOrder[i].x, uvOrder[i].y);
        }

        // Create cape material with the loaded texture
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.FrontSide, 
            transparent: false,    
        });

        // Create cape mesh
        capeMesh = new THREE.Mesh(geometry, material);
        
        // Reset position to center the cape
        capeMesh.position.set(0, 0, 0);
        // Remove rotation
        // capeMesh.rotation.x = 0.1; 

        // Add to the scene
        scene.add(capeMesh);
    }

    // Animation loop
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        
        if (!scene || !camera || !renderer || !controls) return;
        
        // Update controls
        controls.update();
        
        // Render scene
        renderer.render(scene, camera);
    }

    // Effect to update autoRotate when prop changes
    $effect(() => {
        if (controls) {
            controls.autoRotate = autoRotate;
        }
    });

    // Effect to update when imageUrl changes
    $effect(() => {
        if (scene && capeMesh && imageUrl !== currentImageUrl) {
            console.log(`[Cape3DRenderer] Image URL changed, reloading texture`);
            currentImageUrl = imageUrl;
            
            // Clear existing cape
            scene.remove(capeMesh);
            capeMesh.geometry.dispose();
            if (capeMesh.material instanceof THREE.Material) {
                capeMesh.material.dispose();
            } else if (Array.isArray(capeMesh.material)) {
                capeMesh.material.forEach((material: THREE.Material) => material.dispose());
            }
            capeMesh = null;
            
            // Reload cape texture with new image
            loadCapeTexture();
        }
    });
</script>

<div class="cape-3d-container" style="width: {width}px; height: {height}px;">
    {#if errorMessage}
        <div class="error-message">⚠️ {errorMessage}</div>
    {:else}
        <canvas 
            bind:this={canvasElement} 
            width={width} 
            height={height} 
            class="cape-canvas" 
            class:loading={isLoading}
            title="Cape 3D view"
        ></canvas>
        
        {#if isLoading}
            <div class="loading-indicator">Loading...</div>
        {/if}
    {/if}
</div>

<style>
    .cape-3d-container {
        position: relative;
        /* width/height set inline */
        display: inline-block;
        vertical-align: middle;
        background-color: #f0f0f0;
        border-radius: 4px;
        overflow: hidden;
    }

    .cape-canvas {
        display: block;
        width: 100%;
        height: 100%;
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
        font-size: 0.9em;
        color: #e74c3c;
        background-color: #fbeae8;
        border: 1px solid #e74c3c;
        box-sizing: border-box; 
        padding: 10px;
    }

    .loading-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 0.9em;
    }
</style>