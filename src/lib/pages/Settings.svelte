<script lang="ts">
	import AccountsModal from '$lib/components/settings/AccountsModal.svelte';
    import SlidingPageWrapper from '$lib/components/SlidingPageWrapper.svelte';
    import { translations } from '$lib/utils/translationUtils';

    let showAccountsModal = true;

    $: lang = $translations;
</script>

<SlidingPageWrapper page="settings">
    <AccountsModal bind:showAccountsModal />
</SlidingPageWrapper>

<style>

</style>