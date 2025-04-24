<script>
    import { accounts, addAccount, removeAccount, selectAccount, selectedAccount } from '$lib/utils/accountUtils';
    import { translations } from '$lib/utils/translationUtils';
	import Modal from './../Modal.svelte';

    export let showAccountsModal = false;

    $: lang = $translations;
</script>

<Modal bind:show={showAccountsModal} title={lang.settings.accounts.modal.title}>
    <div class="accounts">
        {#each $accounts ?? [] as account}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                class="account"
                class:active={$selectedAccount?.id == account.id}
            >
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="info" onclick={() => selectAccount(account.id)}>
                    <img src={`https://crafatar.com/avatars/${account.id}`} alt="Account Avatar" class="avatar" />
                    <p class="name" style={account.username.length > 12 ? 'font-size: 35px;' : 'font-size: 40px;'}>{account.username.toLowerCase()}</p>
                </div>
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <p class="close-btn" onclick={() => removeAccount(account.id)}>x</p>
            </div>
        {/each}
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <p class="add-btn" onclick={addAccount}>{lang.settings.accounts.modal.button.add}</p>
</Modal>

<style>
    .accounts {
        display: flex;
        flex-direction: column;
        max-height: 300px;
        width: 100%;
        overflow-y: scroll;
        margin-top: 10px;
        gap: 10px;
    }

    .account {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 5px;
        background-color: var(--background-contrast-color);
        border-radius: 2px;
    }

    .account:not(.active) .info {
        cursor: pointer;
    }

    .account:not(.active):hover .info .name {
        letter-spacing: 1px;
    }
    
    .account:not(.active):hover .info .avatar {
        filter: grayscale(0.65);
    }

    .account.active .info .avatar {
        filter: grayscale(0);
    }

    .account.active .info .name {
        color: var(--primary-color);
    }

    .account .info {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 15px;
    }

    .account .info .avatar {
        height: 60px;
        border-radius: 2px;
        filter: grayscale(1);
    }

    .account .info .name {
        color: var(--text-color);
        margin-top: -5px;
    }

    .account .close-btn {
        color: var(--red-text);
        font-size: 50px;
        margin-top: -10px;
        margin-right: 7.5px;
        cursor: pointer;
    }

    .add-btn {
        color: var(--primary-color);
        font-size: 50px;
        margin-bottom: -10px;
        margin-top: 20px;
        border-top: 3px solid var(--background-contrast-color);
        width: 100%;
        text-align: center;
        cursor: pointer;
    }

    .add-btn:hover {
        letter-spacing: 2px;
    }
</style>