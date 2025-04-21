<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from '@tauri-apps/api/event';
  import ProfileManager from "../lib/components/ProfileManager.svelte";
  import ErrorPopup from "$lib/components/popups/ErrorPopup.svelte";
  import { profiles } from '$lib/stores/profileStore';
  import type { ParsedExitPayload } from '$lib/types';

  // State für das Error-Popup
  let isErrorPopupOpen = false;
	let errorProfileName: string | null = null;
	let errorExitCode: string | null = null;
	let errorProcessId: string | null = null;

  // --- Funktion, um den Profilnamen anhand der ID zu finden ---
	function getProfileNameByProfileId(profileId: string): string {
    // Greife direkt auf den Store-Wert zu (innerhalb des <script>-Blocks reaktiv)
    const currentProfiles = $profiles;
    const profile = currentProfiles.find(p => p.id === profileId);

    if (profile) {
       return profile.name;
    } else {
      console.warn(`Profile with ID ${profileId} not found in store.`);
      return `Profil ${profileId.substring(0, 8)}... (nicht gefunden)`;
    }
	}
	// --- Ende Funktion ---

  onMount(() => {
    // Variable für die Cleanup-Funktion
    let unlistenFunction: (() => void) | null = null;

    // Asynchrone Funktion für die Initialisierung
    const initializeListener = async () => {
      try {
        unlistenFunction = await listen<any>('state_event', (event) => {
          console.log('State Event Received:', event.payload); // Zum Debuggen

          if (event.payload?.event_type === 'minecraft_process_exited') {
            // Versuche, die Nachricht als JSON zu parsen
            try {
              const message = event.payload.message as string;
              if (!message) {
                console.warn("Received MinecraftProcessExited event without message payload.");
                return;
              }
              const parsedPayload: ParsedExitPayload = JSON.parse(message);

              // Prüfe, ob der Prozess *nicht* erfolgreich war
              if (!parsedPayload.success) {
                const profileId = parsedPayload.profile_id;
                const processId = parsedPayload.process_id;
                // Formatieren des Exit-Codes für die Anzeige (könnte null sein)
                const exitCodeDisplay = parsedPayload.exit_code !== null
                                        ? String(parsedPayload.exit_code)
                                        : "Kein Exit-Code";

                // Hole den Profilnamen anhand der ID aus dem geparsten Payload
                const profileName = getProfileNameByProfileId(profileId);

                // Setze die Daten für das Popup und öffne es
                errorProfileName = profileName;
                errorExitCode = exitCodeDisplay; // Verwende den formatierten Code
                errorProcessId = processId;
                isErrorPopupOpen = true;
              } else {
                // Prozess war erfolgreich
                console.log(`Minecraft process ${parsedPayload.process_id} exited successfully.`);
              }

            } catch (e) {
              console.error("Failed to parse MinecraftProcessExited message payload:", e, event.payload.message);
              // Optional: Fallback-Fehlermeldung anzeigen?
            }
          }
        });
      } catch (error) {
         console.error("Failed to initialize event listener:", error);
      }
    };

    initializeListener();

		// Synchrone Rückgabe der Cleanup-Funktion
		return () => {
			if (unlistenFunction) {
         console.log("Cleaning up state_event listener.");
				unlistenFunction();
			}
		};
	});

  // Funktion zum Schließen des Popups
  const handlePopupClose = () => {
		isErrorPopupOpen = false;
	};

</script>

<main>
  <ErrorPopup
    bind:isOpen={isErrorPopupOpen}
    profileName={errorProfileName}
    exitCode={errorExitCode}
    processId={errorProcessId}
    on:close={handlePopupClose}
  />
  <ProfileManager />
</main>
