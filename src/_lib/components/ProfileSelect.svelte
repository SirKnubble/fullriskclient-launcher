<script lang="ts">
    import { profiles, selectedProfileId } from '$lib/stores/profileStore';
    import { onMount } from 'svelte';

    // Note: It's generally better to load profiles in a higher-level component 
    // (like +layout.svelte or the page using this component) to avoid multiple loads.
    // If you load it here, uncomment the onMount block:
    /*
    import { loadProfiles } from '$lib/stores/profileStore';
    onMount(async () => {
        if ($profiles.length === 0) { 
            await loadProfiles();
        }
    });
    */

    // $: console.log('Profiles in store (ProfileSelect):', $profiles); // Debug log

</script>

<div class="profile-select-container">
    <label for="profile-select">Target Profile:</label>
    <select id="profile-select" bind:value={$selectedProfileId}>
        <!-- Provide a default disabled option -->
        <option value={null}>-- Select a Profile --</option> 
        {#if $profiles.length > 0}
            {#each $profiles as profile (profile.id)}
                <option value={profile.id}>{profile.name} ({profile.game_version} {profile.loader})</option>
            {/each}
        {:else}
            <!-- Keep the default disabled option visible while loading or if none exist -->
        {/if}
    </select>
    {#if $profiles.length === 0}
        <span class="loading-profiles">(Loading profiles...)</span> <!-- Or No profiles available -->
    {/if}
</div>

<style>
    .profile-select-container {
        display: flex;
        align-items: center;
        gap: 0.5em;
        margin-bottom: 1em;
        font-family: sans-serif;
    }
    label {
        font-weight: bold;
    }
    select {
        padding: 0.4em;
        border: 1px solid #ccc;
        border-radius: 4px;
        min-width: 150px; /* Adjust as needed */
        flex-grow: 1; /* Allow dropdown to grow */
    }
    .loading-profiles {
        font-size: 0.9em;
        color: #666;
    }
</style> 