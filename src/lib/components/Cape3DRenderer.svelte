<!-- src/lib/components/Cape3DRenderer.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as THREE from "three";
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

    // Props
    const { 
        imageUrl, 
        part = 'front',
        width = 400,
        height = 300,
        autoRotate = false,
        backgroundColor = "#f0f0f0"
    }: { 
        imageUrl: string | undefined,
        part?: 'front' | 'back',
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
    let cape: THREE.Group | null = null;
    let animationFrameId: number | null = null;

    // Cape dimensions (scaled for Minecraft proportions)
    const CAPE_WIDTH = 10;
    const CAPE_HEIGHT = 16;
    const CAPE_SEGMENTS_X = 5;
    const CAPE_SEGMENTS_Y = 8;

    // Constants for cape layout (copied from CapeImage.svelte)
    const SCALE_FACTOR = 8;
    const CAPE_SRC_WIDTH = 10 * SCALE_FACTOR;  // 80
    const CAPE_SRC_HEIGHT = 16 * SCALE_FACTOR; // 128
    const FRONT_X = 1 * SCALE_FACTOR;         // 8
    const FRONT_Y = 1 * SCALE_FACTOR;         // 8
    const BACK_X = 12 * SCALE_FACTOR;        // 96
    const BACK_Y = 1 * SCALE_FACTOR;         // 8

    // Track current part to detect changes
    let currentPart = part;

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

        // Dispose of geometries and materials
        if (cape) {
            cape.traverse((object: THREE.Object3D) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                    if (object.material instanceof THREE.Material) {
                        object.material.dispose();
                    } else if (Array.isArray(object.material)) {
                        object.material.forEach((material: THREE.Material) => material.dispose());
                    }
                }
            });
        }

        scene = null;
        camera = null;
        renderer = null;
        controls = null;
        cape = null;
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
        
        // Enable physically correct lighting
        renderer.physicallyCorrectLights = true;

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
        // Main ambient light (increased intensity)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambientLight);

        // Main directional light (sun-like)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        // Front fill light
        const frontFill = new THREE.DirectionalLight(0xffffff, 0.7);
        frontFill.position.set(0, 0, 10);
        scene.add(frontFill);

        // Back light for depth
        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(-5, 3, -5);
        scene.add(backLight);
        
        // Bottom light for even illumination
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

        const textureLoader = new THREE.TextureLoader();
        textureLoader.crossOrigin = 'anonymous';
        
        textureLoader.load(
            imageUrl,
            (texture: THREE.Texture) => {
                // Texture loaded successfully
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                
                // Create a canvas to crop the texture
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                if (!context) {
                    errorMessage = "Failed to create context for texture processing";
                    isLoading = false;
                    return;
                }
                
                // Get image from texture
                const image = texture.image;
                if (!image) {
                    errorMessage = "Failed to get texture image";
                    isLoading = false;
                    return;
                }
                
                // Set canvas size to the size of cape part
                canvas.width = CAPE_SRC_WIDTH;
                canvas.height = CAPE_SRC_HEIGHT;
                
                // Determine source coordinates based on 'part' prop
                const sx = part === 'back' ? BACK_X : FRONT_X;
                const sy = part === 'back' ? BACK_Y : FRONT_Y;
                
                // Draw only the selected part of the cape texture
                context.drawImage(
                    image,
                    sx, sy, CAPE_SRC_WIDTH, CAPE_SRC_HEIGHT,  // Source rectangle
                    0, 0, CAPE_SRC_WIDTH, CAPE_SRC_HEIGHT     // Destination rectangle
                );
                
                // Create a new texture from the canvas
                const croppedTexture = new THREE.Texture(canvas);
                croppedTexture.needsUpdate = true;
                croppedTexture.magFilter = THREE.NearestFilter;
                croppedTexture.minFilter = THREE.NearestFilter;
                
                createCapeModel(croppedTexture);
                isLoading = false;
            },
            (progress: { loaded: number, total: number }) => {
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

        // Create a group to hold the cape
        cape = new THREE.Group();
        scene.add(cape);

        // Create cape material with the loaded texture
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5
        });

        // Create cape geometry (cloth-like with segments)
        const geometry = new THREE.PlaneGeometry(
            CAPE_WIDTH, 
            CAPE_HEIGHT, 
            CAPE_SEGMENTS_X, 
            CAPE_SEGMENTS_Y
        );

        // Create cape mesh
        const capeMesh = new THREE.Mesh(geometry, material);
        
        // Position the cape
        capeMesh.position.set(0, 0, 0);
        
        // Add to the cape group
        cape.add(capeMesh);
        
        // Position the cape group
        cape.position.set(0, 0, 0);
        
        // Apply a slight curve to the cape to make it look more natural
        applyCurve(geometry);
    }

    // Apply a curve to the cape geometry to make it look more natural
    function applyCurve(geometry: THREE.PlaneGeometry) {
        const positions = geometry.attributes.position;
        
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Apply a slight curve based on y position (height)
            const curveAmount = 1.5;
            const normalizedY = (y + CAPE_HEIGHT/2) / CAPE_HEIGHT; // 0 at top, 1 at bottom
            const curve = Math.pow(normalizedY, 2) * curveAmount;
            
            positions.setZ(i, z - curve);
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
    }

    // Animation loop
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        
        if (!scene || !camera || !renderer || !controls) return;
        
        // Update cape animation (wind effect)
        if (cape) {
            animateCape();
        }
        
        // Update controls
        controls.update();
        
        // Render scene
        renderer.render(scene, camera);
    }

    // Animate the cape to simulate wind
    function animateCape() {
        if (!cape) return;
        
        const time = Date.now() * 0.001; // Convert to seconds
        const windStrength = 0.3;
        const windFrequency = 0.5;
        
        // Get the cape mesh
        const capeMesh = cape.children[0] as THREE.Mesh;
        if (!capeMesh || !capeMesh.geometry) return;
        
        // Get position attribute
        const positions = capeMesh.geometry.attributes.position;
        
        // Apply wind effect
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Original z position (from the curve)
            const normalizedY = (y + CAPE_HEIGHT/2) / CAPE_HEIGHT;
            const curveAmount = 1.5;
            const baseZ = -Math.pow(normalizedY, 2) * curveAmount;
            
            // Wind effect (stronger at the bottom)
            const windEffect = Math.sin(time * windFrequency + y * 0.2) * windStrength * normalizedY;
            
            // Apply the wind effect
            positions.setZ(i, baseZ + windEffect);
        }
        
        capeMesh.geometry.attributes.position.needsUpdate = true;
    }

    // Effect to update when props change
    $effect(() => {
        if (controls) {
            controls.autoRotate = autoRotate;
        }
    });

    // Effect to update when part or imageUrl changes
    $effect(() => {
        if (scene && cape && (part !== currentPart || imageUrl)) {
            console.log(`[Cape3DRenderer] Part changed from ${currentPart} to ${part}, reloading texture`);
            currentPart = part;
            
            // Clear existing cape
            scene.remove(cape);
            cape.traverse((object: THREE.Object3D) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                    if (object.material instanceof THREE.Material) {
                        object.material.dispose();
                    } else if (Array.isArray(object.material)) {
                        object.material.forEach((material: THREE.Material) => material.dispose());
                    }
                }
            });
            cape = null;
            
            // Reload cape texture with new part
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
            title="Cape {part} 3D view"
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