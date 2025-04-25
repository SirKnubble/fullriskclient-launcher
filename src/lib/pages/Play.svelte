<script lang="ts">
	import VersionList from './../components/play/VersionList.svelte';
    import SlidingPageWrapper from '$lib/components/SlidingPageWrapper.svelte';
    import VersionBackground from '$lib/images/versions/1.21.webp';
    import { launcherStartCompleted } from '$lib/utils/missilaniousUtils';
    import { translations } from '$lib/utils/translationUtils';
    import { IdleAnimation, SkinViewer } from "skinview3d";
    import { onMount } from 'svelte';
    import { profiles, selectedProfile } from '$lib/utils/profileUtils';
    import { addAccount, selectedAccount } from '$lib/utils/accountUtils';
    import NoUserSkin from '$lib/images/no_user_skin.png';
    import NoUserSkinDark from '$lib/images/no_user_skin_dark.png';
    import { launchProfile } from '$lib/api/profiles';
    import type { EventPayload } from '$lib/types/core';
    import { currentEvent } from '$lib/utils/eventUtils';

    $: lang = $translations;

    let skinViewer: SkinViewer;
    let launchButtonHovered = false;
    let launchButtonVisible = $launcherStartCompleted;

    let startProgress: EventPayload | null = null;

    function selectVersion() {
        launchButtonVisible = false;
    }

    async function login() {
        startProgress = {
            target_id: '1',
            event_id: '1',
            event_type: 'account_login',
            message: lang.play.button.logging_in,
            progress: 0,
            error: '',
        }
        await addAccount();
        startProgress = null;
    }

    async function launch() {
        startProgress = {
            target_id: '1',
            event_id: '1',
            event_type: 'launching_minecraft',
            message: lang.play.button.launching,
            progress: 0,
            error: '',
        }
        await launchProfile($selectedProfile!.id);
    }

    selectedAccount.subscribe((account) => {
        if (account != null) {
            skinViewer?.loadSkin(`https://crafatar.com/skins/${account.id}`);
        } else {
            skinViewer?.loadSkin(NoUserSkinDark);
        }
    });

    currentEvent.subscribe((event) => {
        if (!event) return;
        if (!['minecraft_output', 'account_login', 'account_refresh', 'account_logout', 'profile_update', 'trigger_profile_update', 'minecraft_process_exited', 'error'].includes(event.event_type)) {
            startProgress = event;

            if (event.event_type === 'launching_minecraft') {
                setTimeout(() => {
                    startProgress = null;
                }, 5000);
            }
        } else if (event.event_type === 'minecraft_process_exited') {
            startProgress = null;
        }
    });

    onMount(async() => {
        const canvas = document.createElement("canvas");
        skinViewer = new SkinViewer({
          canvas: canvas,
          width: 250,
          height: 420,
          skin: $selectedAccount != null ? `https://crafatar.com/skins/${$selectedAccount.id}` : NoUserSkinDark,
          animation: new IdleAnimation,
        });
        skinViewer.controls.enabled = false;
        skinViewer.camera.position.set(15, 5, 40);
        skinViewer.playerObject.position.set(0, -14, 0)
        document.getElementById('skin')?.appendChild(canvas);

        setTimeout(() => {
            launchButtonVisible = true;
        }, 350);
    });
</script>

<SlidingPageWrapper page="play">
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <div class="image-outline" />
    <!-- svelte-ignore a11y_img_redundant_alt -->
    <img class="image" class:dark={!launchButtonVisible && $launcherStartCompleted} src={VersionBackground} alt="Background Image">
    <div class="version-selector-container">
        {#if !launchButtonVisible && $launcherStartCompleted}
            <VersionList bind:isClosed={launchButtonVisible} />
        {:else}
            <div class="profile-display" class:hidden={!launchButtonVisible || $selectedAccount == null}>
                <p class="name" style={($selectedProfile?.name?.length ?? 0) > 13 ? 'font-size: 120px; margin-top: -5px;' : 'font-size: 200px; margin-top: -25px;'}>{$selectedProfile?.name.toLowerCase()}</p>
                <p class="version">{$selectedProfile?.game_version.toLowerCase()}</p>
            </div>
        {/if}
    </div>
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <div
        class="skin"
        class:hidden={!launchButtonVisible}
        class:levetating={launchButtonHovered}
        id="skin"
    />
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="play-button"
        class:hidden={!launchButtonVisible}
        class:is-start-progress={startProgress != null}
        id="play-button"
        onmouseenter={() => launchButtonHovered = true}
        onmouseleave={() => launchButtonHovered = false}
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <p
            class="launch-text"
            onclick={$selectedAccount == null ? login : launch}
        >{$selectedAccount == null && startProgress == null ? lang.play.button.login : startProgress != null ? startProgress.message.toLowerCase() : lang.play.button.launch}</p>
        {#if launchButtonHovered && startProgress == null && $profiles.length > 1 && $selectedAccount != null}
            <div class="spacer" />
            <div class="dropdown-arrow-wrapper">
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <p class="dropdown-arrow" onclick={selectVersion}>></p>
            </div>
        {/if}
    </div>
</SlidingPageWrapper>

<style>
    .image {
        image-rendering: optimizeSpeed;
        width: calc(100% - 2 * 35px);
        max-height: calc(100% - 2 * 35px);
        object-fit: cover;
        mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.4));
    }

    .image.dark {
        filter: brightness(0.15);
    }
    
    .image-outline {
        position: absolute;
        width: calc(100% - 2 * 35px);
        height: calc(100% - 2 * 35px);
        border: var(--primary-color) 6.5px solid;
        z-index: 100;
    }

    .version-selector-container {
        position: absolute;
        width: calc(100% - 2 * 35px);
        height: calc(100% - 2 * 35px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 100;
    }

    .profile-display {
        display: flex;
        flex-direction: column;
        padding-left: 50px;
        width: 100%;
        height: 100%;
    }

    .profile-display.hidden {
        opacity: 0;
    }

    .profile-display .name {
        color: white;
    }
    
    .profile-display .version {
        font-size: 85px;
        color: white;
    }

    .skin {
        position: absolute;
        bottom: 60px;
    }

    .skin.levetating {
        bottom: 80px;
    }

    .skin.hidden {
        transform: translateY(100%);
    }

    .play-button {
        position: fixed !important;
        width: 250px;
        height: 65px;
        bottom: 15px;
        display: flex;
        z-index: 100;
        justify-content: center;
        align-items: center;
        flex-direction: row;
        background-color: var(--secondary-color);
        border: var(--primary-color) 6.5px solid;
        cursor: pointer;
    }

    .play-button.hidden, .play-button:hover.hidden {
        transform: translateY(500%);
    }

    .play-button.is-start-progress {
        filter: brightness(0.9);
        pointer-events: none;
        width: 450px;
        transform: scale(1);
    }

    .play-button .launch-text {
        font-size: 60px;
        width: 100%;
        height: 65px;
        text-align: center;
        color: var(--background-color);
    }

    .play-button.play-button.is-start-progress .launch-text {
        font-size: 30px;
        height: 30px;
        color: white;
    }

    .play-button:hover {
        transform: scale(1.05);
    }

    .play-button:hover .launch-text {
        color: var(--hover-color);
        transform: scaleX(1.1);
    }

    .play-button .spacer {
        width: 3.5px;
        height: 60%;
        margin-right: 5px;
        background-color: var(--primary-color);
    }

    .play-button .dropdown-arrow-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 45px;
        height: 100%;
    }

    .play-button .dropdown-arrow {
        position: absolute;
        margin-top: 5px;
        font-size: 70px;
        margin-left: 12.5px;
        transform: rotateZ(90deg);
        color: var(--background-color);
    }

    .dropdown-arrow:hover {
        color: var(--hover-color);
        transform: rotateZ(90deg) scale(1.1);
    }
</style>