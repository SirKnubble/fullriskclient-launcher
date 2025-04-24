<script lang="ts">
    export let show: boolean = true;
    export let title: string = "";
    export let onClose: () => void = () => {};

    function closeModal() {
        document.getElementById('modal')?.animate([
            { transform: 'translateY(0)' },
            { transform: 'translateY(100vh)' }
        ], {
            duration: 300,
            easing: 'ease-out',
            fill: 'forwards'
        });
        show = false;
        onClose();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-overlay" class:visible={show} onclick={closeModal}>
    <div class="modal" id="modal" onclick={(e) => e.stopPropagation()}>
        <div class="header">
            <h1 class="title">{title.toLowerCase()}</h1>
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <p class="close-button" onclick={closeModal}>x</p>
        </div>
        <div class="content">
            <slot />
        </div>
    </div>
</div>

<style>
    .modal-overlay {
        position: absolute;
        width: 100vw;
        height: 100vh;
        backdrop-filter: blur(5px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
    }
    
    .modal-overlay.visible {
        opacity: 1;
        pointer-events: auto;
    }

    .modal {
        background-color: var(--background-color);
        padding: 10px;
        min-width: 30%;
        max-width: 80%;
        outline: 4px solid var(--background-contrast-color);
        animation: slide-in 0.3s ease-out forwards;
        border-radius: 1px;
    }

    .modal .header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        margin-top: -25px;
        padding: 10px 10px 5px 10px;
        border-bottom: var(--background-contrast-color) 3px solid;
    }

    .modal .header .title {
        font-size: 50px;
        margin-right: 35px;
        color: var(--text-color);
    }

    .modal .header .close-button {
        cursor: pointer;
        font-size: 60px;
        color: var(--red-text);
    }

    .modal .content {
        padding: 5px 10px 10px 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100px;
    }

    @keyframes slide-in {
        from {
            transform: translateY(100vh);
        }
        to {
            transform: translateY(0);
        }
    }
</style> 