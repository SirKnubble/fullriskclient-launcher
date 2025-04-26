<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { listen } from '@tauri-apps/api/event';
    import type { UnlistenFn } from '@tauri-apps/api/event';
    import { onMount, onDestroy } from "svelte";
    import type { ProcessState, ProcessMetadata } from '$lib/types';
    import { tick } from 'svelte';
    import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
    // --- Define Interfaces ---
    // Define EventPayload locally (ideally move to a shared types file)
    interface EventPayload {
        event_id: string;
        event_type: string;
        target_id: string | null;
        message: string;
        progress: number | null;
        error: string | null;
    }

    // --- State ---
    let processes = $state<ProcessMetadata[]>([]);
    let isLoading = $state(true);
    let error = $state<string | null>(null);
    let now = $state(new Date());
    let logs = $state<{ [id: string]: { lines: string[], timestamp: number } }>({});
    let expandedLogProcessIds = $state<Set<string>>(new Set());
    let logListener: UnlistenFn | null = null;
    let autoscrollSettings = $state<Map<string, boolean>>(new Map());
    let fullLogsLoaded = $state<Set<string>>(new Set());
    let isLoadingFullLogs = $state<string | null>(null);
    let fullLogError = $state<Map<string, string>>(new Map());

    // State for mclo.gs uploads
    let mclogsUrls = $state<{ [id: string]: string }>({});
    let isUploadingLog = $state<{ [id: string]: boolean }>({});
    let uploadError = $state<{ [id: string]: string | null }>({});

    async function loadProcesses() {
        try {
            console.log('Loading processes...');
            processes = await invoke<ProcessMetadata[]>("get_processes");
            console.log('Loaded processes:', processes);
            error = null;
        } catch (e) {
            console.error('Error loading processes:', e);
            error = e instanceof Error ? e.message : String(e);
        } finally {
            isLoading = false;
        }
    }

    async function stopProcess(id: string) {
        try {
            await invoke("stop_process", { processId: id });
            if (expandedLogProcessIds.has(id)) {
                expandedLogProcessIds.delete(id);
            }
            await loadProcesses();
        } catch (e) {
            console.error('Error stopping process:', e);
            error = e instanceof Error ? e.message : String(e);
        }
    }

    async function toggleLogView(id: string) {
        fullLogError.delete(id);
        const currentlyExpanded = expandedLogProcessIds.has(id);

        if (currentlyExpanded) {
            expandedLogProcessIds.delete(id);
            expandedLogProcessIds = expandedLogProcessIds;
        } else {
            if (!autoscrollSettings.has(id)) {
                autoscrollSettings.set(id, true);
            }
            expandedLogProcessIds.add(id);
            autoscrollSettings = autoscrollSettings;
            expandedLogProcessIds = expandedLogProcessIds;

            const shouldAutoscroll = autoscrollSettings.get(id) ?? true;

            if (!fullLogsLoaded.has(id)) {
                isLoadingFullLogs = id;
                try {
                    const fullLogContent: string = await invoke("get_full_log", { processId: id });
                    const lines = fullLogContent.split('\n').filter(line => line.trim() !== '');

                    logs[id] = { lines: lines, timestamp: Date.now() };

                    const MAX_LOG_LINES = 500;
                    if (logs[id].lines.length > MAX_LOG_LINES) {
                        logs[id].lines = logs[id].lines.slice(-MAX_LOG_LINES);
                    }

                    fullLogsLoaded.add(id);
                    if (shouldAutoscroll) {
                        await scrollToBottom(id);
                    }
                } catch (e) {
                    console.error(`Error loading full log for ${id}:`, e);
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    fullLogError.set(id, `Failed to load full log: ${errorMsg}`);
                } finally {
                    isLoadingFullLogs = null;
                }
            } else {
                if (shouldAutoscroll) {
                    await scrollToBottom(id);
                }
            }
        }
    }

    function handleAutoscrollChange(processId: string, event: Event) {
        const checkbox = event.target as HTMLInputElement;
        const isEnabled = checkbox.checked;
        autoscrollSettings.set(processId, isEnabled);
        autoscrollSettings = autoscrollSettings;
        console.log(`Autoscroll for ${processId} set to ${isEnabled}`);
        if (isEnabled) {
            scrollToBottom(processId);
        }
    }

    async function scrollToBottom(processId: string) {
        const element = document.querySelector(`pre[data-log-process-id="${processId}"]`) as HTMLPreElement | null;
        if (element) {
            await tick();
            element.scrollTop = element.scrollHeight;
            console.log(`Autoscrolled log for process ${processId}`);
        } else {
            await tick();
            const elementAfterTick = document.querySelector(`pre[data-log-process-id="${processId}"]`) as HTMLPreElement | null;
            if (elementAfterTick) {
                elementAfterTick.scrollTop = elementAfterTick.scrollHeight;
                console.log(`Autoscrolled log for process ${processId} after tick`);
            } else {
                console.warn(`Cannot find log element for process ${processId} to autoscroll.`);
            }
        }
    }

    // Open log window in a separate window
    async function openLogWindow() {
        try {
            await invoke("open_log_window");
            console.log("Opened log window");
        } catch (e) {
            console.error("Error opening log window:", e);
            error = e instanceof Error ? e.message : String(e);
        }
    }

    // Upload logs and copy URL to clipboard
    async function uploadAndCopyLog(processId: string) {
        // Reset previous error for this process
        uploadError[processId] = null;
        // Set loading state
        isUploadingLog[processId] = true;

        // Get log content
        const logData = logs[processId];
        if (!logData || logData.lines.length === 0) {
            console.error("No log content available to upload for process", processId);
            uploadError[processId] = "No log content found.";
            isUploadingLog[processId] = false;
            return;
        }

        const logContent = logData.lines.join('\n');

        try {
            // Invoke the backend command
            const url: string = await invoke("upload_log_to_mclogs_command", { logContent });

            // Store the URL
            mclogsUrls[processId] = url;

            // Copy to clipboard
            await writeText(url);
            console.log("Copied mclo.gs URL to clipboard:", url);

            // Optional: Visual feedback (z.B. kurz Button-Text ändern oder Benachrichtigung)

        } catch (e) {
            console.error(`Error uploading log for ${processId}:`, e);
            const errorMsg = e instanceof Error ? e.message : String(e);
            uploadError[processId] = `Upload failed: ${errorMsg}`;
        } finally {
            // Clear loading state
            isUploadingLog[processId] = false;
        }
    }

    onMount(() => {
        loadProcesses();
        const processInterval = setInterval(loadProcesses, 5000);
        const timeInterval = setInterval(() => {
            now = new Date();
        }, 1000);

        const startListening = async () => {
            try {
                logListener = await listen<EventPayload>('state_event', (event) => {
                    const payload = event.payload;
                    if (payload.event_type === 'minecraft_output' && payload.target_id) {
                        const process_id = payload.target_id;
                        const raw_line = payload.message;

                        if (fullLogsLoaded.has(process_id)) {
                            if (!logs[process_id]) {
                                logs[process_id] = { lines: [], timestamp: Date.now() };
                            }

                            logs[process_id].lines.push(raw_line);
                            logs[process_id].timestamp = Date.now();

                            const MAX_LOG_LINES = 500;
                            if (logs[process_id].lines.length > MAX_LOG_LINES) {
                                logs[process_id].lines.shift();
                            }
                            const shouldAutoscroll = autoscrollSettings.get(process_id) ?? true;
                            if (shouldAutoscroll && expandedLogProcessIds.has(process_id)) {
                                scrollToBottom(process_id);
                            }
                        } else {
                            console.debug(`Ignoring live log for ${process_id} as full logs not yet loaded.`);
                        }
                    }
                });
                console.log("Successfully listening for state_event (for logs).");
            } catch (err) {
                console.error("Failed to set up state_event listener:", err);
                error = err instanceof Error ? err.message : String(err);
            }
        };

        startListening();

        return () => {
            clearInterval(processInterval);
            clearInterval(timeInterval);
            if (logListener) {
                console.log("Unsubscribing from log updates.");
                logListener();
                logListener = null;
            }
        };
    });

    function getStateColor(state: ProcessState): string {
        switch (state) {
            case 'Starting':
                return '#f39c12'; // Orange
            case 'Running':
                return '#2ecc71'; // Green
            case 'Stopping':
                return '#e74c3c'; // Red
            case 'Stopped':
                return '#95a5a6'; // Gray
            case 'Crashed':
                return '#c0392b'; // Dark Red
            default:
                return '#95a5a6';
        }
    }

    function formatTime(date: string): string {
        return new Date(date).toLocaleTimeString();
    }

    function formatDate(date: string): string {
        return new Date(date).toLocaleDateString();
    }

    function formatRuntime(startTime: string): string {
        const start = new Date(startTime);
        const diff = now.getTime() - start.getTime();

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
</script>

<div class="process-list">
    <div class="process-list-header">
        <h3>Running Processes</h3>
        <button class="log-window-button" on:click={openLogWindow}>
            Open Log Window
        </button>
    </div>

    {#if isLoading}
        <div class="loading">Loading processes...</div>
    {:else if error}
        <div class="error">{error}</div>
    {:else if processes.length === 0}
        <div class="no-processes">No processes running</div>
    {:else}
        <div class="process-grid">
            {#each processes as process}
                <div class="process-card">
                    <div class="process-header">
                        <span class="process-id">Process #{process.id.slice(0, 8)}</span>
                        <span class="process-state" style="background-color: {getStateColor(process.state)}">
                            {process.state}
                        </span>
                    </div>

                    <div class="process-details">
                        <div class="detail-row">
                            <span class="label">Profile ID:</span>
                            <span class="value">{process.profile_id.slice(0, 8)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">PID:</span>
                            <span class="value">{process.pid}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Started:</span>
                            <span class="value">{formatDate(process.start_time)} {formatTime(process.start_time)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Runtime:</span>
                            <span class="value runtime">{formatRuntime(process.start_time)}</span>
                        </div>
                    </div>

                    <div class="process-actions">
                        <button 
                            on:click={() => stopProcess(process.id)} 
                            disabled={process.state === 'Stopped' || process.state === 'Stopping'}
                            class="stop-button"
                        >
                            Stop
                        </button>
                        {#if process.state === 'Running' || process.state === 'Starting'}
                            <button 
                                on:click={() => toggleLogView(process.id)}
                                class="log-toggle-button {expandedLogProcessIds.has(process.id) ? 'active' : ''}"
                            >
                                {expandedLogProcessIds.has(process.id) ? 'Hide' : 'View'} Logs
                            </button>
                        {/if}
                    </div>

                    {#if expandedLogProcessIds.has(process.id)}
                        <div class="log-display-area">
                            <h4 class="log-area-title">Minecraft Logs (Process #{process.id.slice(0, 8)})</h4>
                            {#if isLoadingFullLogs === process.id}
                                <div class="loading">Loading full log...</div>
                            {:else if fullLogError.has(process.id)}
                                <div class="error">{fullLogError.get(process.id)}</div>
                            {:else if logs[process.id] && logs[process.id].lines.length > 0}
                                <pre class="log-content" data-log-process-id={process.id}>
                                    {logs[process.id].lines.join('\n')}
                                </pre>
                                <div class="log-footer">
                                    <label class="autoscroll-label">
                                        <input 
                                            type="checkbox" 
                                            checked={autoscrollSettings.get(process.id) ?? true} 
                                            on:change={(event) => handleAutoscrollChange(process.id, event)}
                                        >
                                        Autoscroll
                                    </label>
                                    <span>Last update: {new Date(logs[process.id].timestamp).toLocaleTimeString()}</span>

                                    <!-- Upload & Copy Button -->
                                    <div class="upload-section">
                                        {#if uploadError[process.id]}
                                            <span class="upload-error">Error: {uploadError[process.id]}</span>
                                        {/if}
                                        <button 
                                            class="upload-button" 
                                            on:click={() => uploadAndCopyLog(process.id)} 
                                            disabled={isUploadingLog[process.id]}
                                        >
                                            {#if isUploadingLog[process.id]}
                                                Uploading...
                                            {:else if mclogsUrls[process.id]}
                                                Copy URL Again
                                            {:else}
                                                Upload & Copy URL
                                            {/if}
                                        </button>
                                        {#if mclogsUrls[process.id]}
                                            <a href={mclogsUrls[process.id]} target="_blank" rel="noopener noreferrer" class="mclogs-link">({mclogsUrls[process.id].split('/').pop()})</a>
                                        {/if}
                                    </div>
                                </div>
                            {:else}
                                <div class="no-logs">No logs received yet or process not running.</div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .process-list {
        margin: 1rem 0;
        padding: 1rem;
        background-color: var(--background-secondary);
        border-radius: 8px;
    }

    .process-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .process-list h3 {
        margin: 0;
        color: var(--text-primary);
        font-size: 1.2rem;
    }

    .log-window-button {
        padding: 0.5rem 1rem;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
        font-size: 0.9rem;
    }

    .log-window-button:hover {
        background-color: #2980b9;
    }

    .process-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
    }

    .process-card {
        background-color: var(--background-primary);
        border-radius: 6px;
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .process-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .process-id {
        font-weight: bold;
        color: var(--text-primary);
    }

    .process-state {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        color: white;
        font-size: 0.8rem;
        font-weight: bold;
    }

    .process-details {
        margin-bottom: 1rem;
    }

    .detail-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }

    .label {
        color: var(--text-secondary);
    }

    .value {
        color: var(--text-primary);
        font-family: monospace;
    }

    .runtime {
        font-weight: bold;
    }

    .process-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem; /* Add gap between buttons */
    }

    .stop-button {
        padding: 0.5rem 1rem;
        background-color: #e74c3c;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .stop-button:hover:not(:disabled) {
        background-color: #c0392b;
    }

    .stop-button:disabled {
        background-color: #95a5a6;
        cursor: not-allowed;
    }

    .loading, .error, .no-processes {
        text-align: center;
        padding: 1rem;
        color: var(--text-secondary);
    }

    .error {
        color: #e74c3c;
    }

    .log-toggle-button {
        padding: 0.5rem 1rem;
        background-color: #6c757d; /* Bootstrap secondary grey */
        border: 1px solid #5a6268;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .log-toggle-button:hover {
        background-color: #5a6268;
        border-color: #545b62;
    }

    .log-toggle-button.active {
        background-color: #343a40; /* Dark grey for active state */
        border-color: #343a40;
        color: white; /* Ensure text is visible */
    }

    /* Styles for the log display area */
    .log-display-area {
        margin-top: 1rem;
        border: 1px solid var(--border-color); /* Add border instead of just top border */
        padding: 1rem; /* Adjust padding */
        border-radius: 4px; /* Add border-radius */
        background-color: var(--background-secondary); /* Optional: distinct background */
    }

    /* Style for the new title */
    .log-area-title {
        margin: 0 0 0.75rem 0; 
        font-size: 1.1rem;
        color: var(--text-primary);
        font-weight: bold;
    }

    .log-content {
        background-color: var(--background-secondary);
        /* Remove padding from the pre tag itself */
        /* padding: 0.75rem; */ 
        border-radius: 4px;
        max-height: 300px; /* Limit height */
        overflow-y: auto; /* Add scrollbar */
        color: var(--text-secondary);
        font-family: monospace;
        font-size: 0.5em; /* Further reduced font size */
        white-space: pre-wrap; /* Wrap long lines */
        word-break: break-all; /* Break long words/strings */
    }

    .no-logs {
        color: var(--text-secondary);
        font-style: italic;
        font-size: 0.9rem;
        padding: 0.5rem;
    }

    .log-footer {
        display: flex; /* Use flexbox */
        justify-content: space-between; /* Space out items */
        align-items: center; /* Align items vertically */
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 0.5rem;
        flex-wrap: wrap; /* Allow wrapping on small screens */
        gap: 10px; /* Add gap between elements */
    }

    /* Re-add Style for the autoscroll label/checkbox */
    .autoscroll-label {
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
        cursor: pointer;
    }

    .autoscroll-label input[type="checkbox"] {
        cursor: pointer;
        /* Optional: Style checkbox further */
    }

    /* Styles for Upload Section */
    .upload-section {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .upload-button {
        padding: 4px 8px;
        font-size: 0.8rem;
        background-color: #17a2b8; /* Bootstrap info color */
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .upload-button:hover:not(:disabled) {
        background-color: #138496;
    }
    .upload-button:disabled {
        background-color: #95a5a6;
        cursor: wait;
    }
    .upload-error {
        color: #e74c3c;
        font-size: 0.8rem;
        margin-right: 5px;
    }
    .mclogs-link {
        font-size: 0.8rem;
        color: var(--link-color);
        text-decoration: none;
    }
    .mclogs-link:hover {
        text-decoration: underline;
    }
</style> 
