<script lang="ts">
    import VersionBackground from '$lib/images/versions/1.21.webp';
    import type { Profile } from '$lib/types/profile';
    import { profiles, selectedProfileId, selectProfile } from '$lib/utils/profileUtils';
    import { onMount } from 'svelte';

    export let isClosed: boolean;

    let profileRows: Profile[][] = [];

    onMount(async () => {
        for (let i = 0; i < $profiles.length / 4; i++) {
            profileRows.push($profiles.slice(i * 4, (i + 1) * 4));
        }
        profileRows = profileRows;
    });
</script>

<div class="profile-list-root">
    {#each profileRows as profileRow, i}
        <div class="profile-list-row" style={i == profileRows.length - 1 ? "margin-bottom: 20px" : ""}>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            {#each profileRow as profile}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="profile-list-item"
                    class:active={profile.id == $selectedProfileId}
                    style={`animation-delay: ${$profiles.indexOf(profile) * 0.035}s;`}
                    on:click={() => {
                        selectProfile(profile.id);
                        isClosed = true;
                    }}
                >
                    <img src={VersionBackground} alt="Profile Background" class="background" />
                    <div class="name" style={`font-size: ${profile.name.length > 10 ? 40 : 50}px`}>{profile.name.toLowerCase()}</div>
                    <div class="version">{profile.game_version.toLowerCase()}</div>
                </div>
            {/each}
        </div>
    {/each}
</div>

<style>
    .profile-list-root {
        display: flex;
        flex-direction: column;
        justify-content: start;
        align-items: start;
        width: 100%;
        height: 100%;
        overflow-y: scroll;
        overflow-x: hidden;
    }

    .profile-list-row {
        display: flex;
        flex-direction: row;
        justify-content: start;
        align-items: start;
        margin: 20px 0 5px 20px;
        width: 100%;
        height: 150px;
    }
    
    .profile-list-item {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-right: 22.5px;
        width: 250px;
        height: 150px;
        border: 3px solid white;
        animation: fadeIn 0.2s ease-in-out;
        opacity: 0;
        animation-fill-mode: forwards;
        cursor: pointer;
    }

    .profile-list-item.active {
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

    .profile-list-item .background {
        image-rendering: optimizeSpeed;
        position: absolute;
        width: 250px;
        min-height: 150px;
        object-fit: cover;
        filter: grayscale(1) brightness(0.5) blur(2px);
        z-index: -1;
    }

    .profile-list-item:not(.active):hover .background {
        filter: brightness(0.5) blur(1px);
    }

    .profile-list-item.active .background {
        filter: brightness(0.5);
    }

    .profile-list-item .name {
        color: var(--secondary-color);
        text-align: center;
    }

    .profile-list-item:not(.active):hover .name {
        letter-spacing: 2px;
    }

    .profile-list-item.active .name {
        color: var(--primary-color);
    }
    
    .profile-list-item .version {
        font-size: 40px;
        text-align: center;
        color: white;
    }



    @keyframes fadeIn {
        0% {
            opacity: 0;
            transform: translateY(100%);
        }
        100% {
            opacity: 1;
            transform: translateY(0);
        }
    }

    ::-webkit-scrollbar {
        width: 0px !important;
    }
</style>
