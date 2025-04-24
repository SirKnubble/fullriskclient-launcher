<script lang="ts">
    // Modal props
    const props = $props<{
        show?: boolean; // Optional - defaults to true
    }>();
    
    const show = $derived(props.show ?? true);
</script>

<div class="modal-overlay" class:visible={show}>
    <div class="modal-container">
        <slot></slot>
    </div>
</div>

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
    }
    
    .modal-overlay.visible {
        opacity: 1;
        pointer-events: auto;
    }
    
    .modal-container {
        background-color: white;
        border-radius: 6px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        /* Width and height will be determined by content */
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
</style> 