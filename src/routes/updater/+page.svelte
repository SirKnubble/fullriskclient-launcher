<script lang="ts">
	import { relaunch } from '@tauri-apps/plugin-process';
	import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from "svelte";
  import { check } from "@tauri-apps/plugin-updater";
  import Logo from "$lib/images/norisk_logo.png";
  import OfflineLogo from "$lib/images/norisk_logo_dead.png";
  const appWindow = getCurrentWebviewWindow()

  let dots = "";
  let text: string | null = null;
  let error = "";
  let copyErrorButton = "Copy Error";
  

  onMount(async () => {
    animateLoadingText();

    let hasConnection = false;
    hasConnection = await invoke("has_internet_connection");
    console.log(`Has internet connection: ${hasConnection}`);

    text = hasConnection ? "Checking for Updates" : null;
    if (!hasConnection) return appWindow.show();

    try {
      const update = await check();

      if (update != null) {
        appWindow.show();
        console.log(`Installing update: ${update.rawJson}`);
        text = "Installing Update";

        return;
        // Install the update. This will also restart the app on Windows!
        // await installUpdate().catch(reason => {
        //   noriskError(reason);
        // });
        console.log(`Update was installed`);
        text = "Restarting";

        console.log(`Trying to relaunch`);

        await relaunch().catch(reason => {
          console.error(reason);
        });
      } else {
        console.log(`No updates available`);
        text = "";
        if (error.trim() == "") {
          await invoke("close_updater").then(() => {
            console.log(`updater closed -> Main window shown`);
          }).catch(reason => {
            console.error(`Failed to close updater / show main window: ${reason}`);
          });
        } else {
          appWindow.show();
        }
      }
    } catch (error) {
      console.error(error);
    }
  });

  function animateLoadingText() {
    return setInterval(function() {
      dots += ".";
      if (dots.length > 3) {
        dots = "";
      }
    }, 500);
  }

  function copyError() {
    navigator.clipboard.writeText(error);
    copyErrorButton = "Copied!";
    setTimeout(() => {
      copyErrorButton = "Copy Error";
    }, 1000);
  }
</script>

<!-- svelte-ignore element_invalid_self_closing_tag -->
<div class="drag-overlay" data-tauri-drag-region />
<div class="container">
  <div class="content">
    <img style={`opacity: ${text == null ? '0.3' : '1'};`} src={text != null ? Logo : OfflineLogo} alt="NoRiskClient Logo">
    {#if text == null}
      <p class="branch-font offline">OFFLINE!</p>
    {:else if error.trim() == ""}
      <p class="branch-font primary-text">{text}{dots}</p>
    {:else}
      <p class="branch-font red-text">ERROR! :(</p>
    {/if}
  </div>
  {#if text == null}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <p class="copy-error red-text" on:click={() => invoke("quit")}>Exit</p>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  {:else if error.trim() != ""}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <p class="copy-error primary-text" on:click={() => copyError()}>{copyErrorButton}</p>
  {/if}
</div>

<style>
  .container {
    height: 100vh;
    width: 100vw;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    cursor: default;
  }

  .drag-overlay {
    position: absolute;
    height: 100%;
    width: 100%;
    z-index: 100;
    background-color: transparent;
  }

  .content {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    height: 70%;
    width: 100%;
  }

  img {
    width: 200px;
    height: 200px;
    -webkit-user-drag: none;
    -webkit-mask:linear-gradient(-60deg,#fff 40%,#0005 50%,#fff 60%) right/275% 100%; /* right/275% 100%: length and hight of mask */
    animation: effect 3.5s infinite; /* remove infinite to trigger once */
  }
  
  @keyframes effect {
    0% { transform: scale(1.0); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1.0); -webkit-mask-position:left }
  }

  .branch-font {
    font-family: 'Press Start 2P', serif;
    font-size: 14px;
    margin-top: 2em;
  }

  .offline {
    font-size: 20px;
    opacity: 0.5;
  }

  .copy-error {
    font-family: 'Press Start 2P', serif;
    font-size: 16px;
    text-shadow: none;
    margin-top: 1em;
    text-align: center;
    transition-duration: 200ms;
    z-index: 101;
    cursor: pointer;
  }

  .copy-error:hover {
    transform: scale(1.2);
  }
</style>
