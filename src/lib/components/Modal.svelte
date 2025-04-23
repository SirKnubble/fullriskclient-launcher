<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    
    // Modal props
    const { 
        show = false,
        title = '',
        fullWidth = false,
        fullHeight = false,
        closeOnClickOutside = true
    } = $props<{
        show: boolean;
        title: string;
        fullWidth?: boolean;
        fullHeight?: boolean;
        closeOnClickOutside?: boolean;
    }>();
    
    // Event dispatcher
    const dispatch = createEventDispatcher();
    
    // Close modal
    function closeModal() {
        dispatch('close');
    }
    
    // Handle click outside modal content
    function handleBackdropClick(event: MouseEvent) {
        if (closeOnClickOutside && event.target === event.currentTarget) {
            closeModal();
        }
    }
    
    // Handle escape key press
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }
    
    // Add/remove keydown event listener
    onMount(() => {
        if (show) {
            document.addEventListener('keydown', handleKeydown);
        }
        
        return () => {
            document.removeEventListener('keydown', handleKeydown);
        };
    });
    
    // Watch for changes in show prop
    $effect(() => {
        if (show) {
            document.addEventListener('keydown', handleKeydown);
            document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
        } else {
            document.removeEventListener('keydown', handleKeydown);
            document.body.style.overflow = ''; // Restore scrolling when modal is closed
        }
    });
</script>

{#if show}
    <div class="modal-backdrop" on:click={handleBackdropClick}>
        <div class="modal-container {fullWidth ? 'full-width' : ''} {fullHeight ? 'full-height' : ''}">
            <div class="modal-header">
                <h3 class="modal-title">{title}</h3>
                <button type="button" class="close-button" aria-label="Close" on:click={closeModal}>×</button>
            </div>
            <div class="modal-content">
                <slot />
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .modal-container {
        background-color: white;
        border-radius: 8px;
        width: 65%;
        max-width: 650px;
        max-height: 70vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        overflow: hidden;
    }
    
    .modal-container.full-width {
        width: 95%;
        max-width: 95%;
    }
    
    .modal-container.full-height {
        height: 90vh;
        max-height: 90vh;
    }
    
    .modal-header {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .modal-title {
        margin: 0;
        font-size: 1.125rem;
        color: #333;
    }
    
    .close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
        padding: 0;
        line-height: 1;
        width: 24px;
        height: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 50%;
        transition: background-color 0.2s;
    }
    
    .close-button:hover {
        background-color: #f0f0f0;
        color: #333;
    }
    
    .modal-content {
        padding: 0.75rem;
        overflow-y: auto;
        flex: 1;
    }
</style> 