<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let isOpen: boolean = false;
	export let profileName: string | null = null; // Name des betroffenen Profils
	export let exitCode: string | null = null; // Exit-Code als String (wie im Backend formatiert)
	export let processId: string | null = null; // ID des Prozesses für evtl. weitere Aktionen (Logs)

	const dispatch = createEventDispatcher();

	const close = () => {
		isOpen = false; // Intern schließen (optional, je nach State-Management)
		dispatch('close'); // Event senden, damit der Parent den State ändern kann
	};

	// Klick auf Overlay schließt das Popup
	const handleOverlayClick = () => {
		close();
	};

	// Klick in Content-Box verhindert Schließen
	const handleContentClick = (event: MouseEvent) => {
		event.stopPropagation();
	};

	// Hilfsfunktion für Exit-Code-Beschreibung (wie in React-Beispiel)
	const getExitCodeDescription = (code: string | null): string => {
		if (!code) return 'Unbekannter Fehler';
		// Extrahiere den reinen Code-String
		const match = code.match(/-?\d+/);
		const numericCode = match ? parseInt(match[0], 10) : NaN;

		const hexCode = !isNaN(numericCode)
			? `0x${(numericCode >>> 0).toString(16).toUpperCase()}`
			: 'N/A';
		const displayCode = `${numericCode} (${hexCode})`;

		switch (numericCode) {
			case -1073741819: // 0xC0000005
				return `Zugriffsverletzung (${displayCode})`;
			case -1073741571: // 0xC00000FD
				return `Stacküberlauf (${displayCode})`;
			case -1073740791: // 0xC0000409
				return `Stack-Pufferüberlauf (${displayCode})`;
			case -1073741515: // 0xC0000135
				return `.NET Framework Initialisierungsfehler (${displayCode})`;
			case 1:
				return `Allgemeiner Fehler (${displayCode})`;
			default:
				return `Code: ${displayCode}`;
		}
	};

	//$: sorgt dafür, dass description neu berechnet wird, wenn exitCode sich ändert
	$: description = getExitCodeDescription(exitCode);

	// Funktion für den optionalen "Logs anzeigen"-Button
	const showLogs = () => {
		console.log('Anzeigen der Logs für Prozess:', processId);
		// Hier Logik zum Anzeigen der Logs einfügen (z.B. Navigation zu Log-Seite oder API-Aufruf)
		// Eventuell ein weiteres Event dispatch('showlogs', { processId });
		close(); // Popup nach Klick schließen
	};
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class="error-popup-overlay" on:click={handleOverlayClick}>
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
		<div class="error-popup-content" on:click={handleContentClick}>
			<h2>Minecraft ist abgestürzt!</h2>
			<p>
				Der Start des Profils "{profileName || 'Unbekanntes Profil'}" ist fehlgeschlagen.
			</p>

			<div class="error-details">
				<strong>Grund:</strong>
				{description}
			</div>

			<button on:click={close}> Okay </button>
			<!-- Optional: Button um Logs anzuzeigen -->
			{#if processId}
				<button class="secondary-button" on:click={showLogs}> Logs anzeigen </button>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* CSS bleibt größtenteils gleich wie im vorherigen Beispiel */
	.error-popup-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		font-family: sans-serif;
	}

	.error-popup-content {
		background-color: #fff;
		padding: 30px;
		border-radius: 8px;
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
		max-width: 450px;
		width: 90%;
		text-align: center;
		border-left: 5px solid #e74c3c;
	}

	.error-popup-content h2 {
		color: #e74c3c;
		margin-top: 0;
		margin-bottom: 15px;
		font-size: 1.4em;
	}

	.error-popup-content p {
		margin-bottom: 10px;
		line-height: 1.5;
		color: #333;
	}

	.error-popup-content .error-details {
		background-color: #f8f8f8;
		border: 1px solid #eee;
		padding: 10px 15px;
		border-radius: 4px;
		font-family: monospace;
		color: #555;
		margin-top: 20px;
		margin-bottom: 25px;
		text-align: left;
		word-wrap: break-word;
	}

	.error-popup-content button {
		background-color: #3498db;
		color: white;
		border: none;
		padding: 12px 25px;
		border-radius: 5px;
		cursor: pointer;
		font-size: 16px;
		transition: background-color 0.2s ease;
	}

	.error-popup-content button:hover {
		background-color: #2980b9;
	}

    /* Styling für sekundären Button (Logs) */
	.error-popup-content button.secondary-button {
		margin-left: 10px;
		background-color: #7f8c8d; /* Grau */
	}
    .error-popup-content button.secondary-button:hover {
       background-color: #6c7a7d;
    }
</style> 