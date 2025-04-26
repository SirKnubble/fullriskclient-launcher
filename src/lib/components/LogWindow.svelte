<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { listen } from '@tauri-apps/api/event';
    import type { UnlistenFn } from '@tauri-apps/api/event';
    import { onMount, onDestroy } from "svelte";
    import type { ProcessState, ProcessMetadata } from '$lib/types';
    import { tick } from 'svelte';
    import { writeText } from '@tauri-apps/plugin-clipboard-manager';

    // --- Define Interfaces ---
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
    let selectedProcessId = $state<string | null>(null);
    let logListener: UnlistenFn | null = null;
    let autoscrollEnabled = $state(true);
    let fullLogsLoaded = $state<Set<string>>(new Set());
    let isLoadingFullLogs = $state<string | null>(null);
    let fullLogError = $state<Map<string, string>>(new Map());

    // Search/filter functionality
    let searchQuery = $state('');
    let filteredLogs = $state<string[]>([]);
    let isFiltering = $state(false);

    // State for mclo.gs uploads
    let mclogsUrls = $state<{ [id: string]: string }>({});
    let isUploadingLog = $state<{ [id: string]: boolean }>({});
    let uploadError = $state<{ [id: string]: string | null }>({});

    async function loadProcesses() {
        try {
            console.log('Loading processes...');
            processes = await invoke<ProcessMetadata[]>("get_processes");
            console.log('Loaded processes:', processes);

            // If no process is selected and there are processes, select the first one
            if (selectedProcessId === null && processes.length > 0) {
                selectProcess(processes[0].id);
            } else if (selectedProcessId && !processes.some(p => p.id === selectedProcessId)) {
                // If the selected process no longer exists, clear selection
                selectedProcessId = null;
            }

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
            await loadProcesses();
        } catch (e) {
            console.error('Error stopping process:', e);
            error = e instanceof Error ? e.message : String(e);
        }
    }

    async function selectProcess(id: string) {
        fullLogError.delete(id);
        selectedProcessId = id;

        if (!fullLogsLoaded.has(id)) {
            isLoadingFullLogs = id;
            try {
                const fullLogContent: string = await invoke("get_full_log", { processId: id });
                const lines = fullLogContent.split('\n').filter(line => line.trim() !== '');

                logs[id] = { lines: lines, timestamp: Date.now() };

                const MAX_LOG_LINES = 1000; // Increased for the dedicated log window
                if (logs[id].lines.length > MAX_LOG_LINES) {
                    logs[id].lines = logs[id].lines.slice(-MAX_LOG_LINES);
                }

                fullLogsLoaded.add(id);
                if (autoscrollEnabled) {
                    await scrollToBottom();
                }
            } catch (e) {
                console.error(`Error loading full log for ${id}:`, e);
                const errorMsg = e instanceof Error ? e.message : String(e);
                fullLogError.set(id, `Failed to load full log: ${errorMsg}`);
            } finally {
                isLoadingFullLogs = null;
            }
        } else {
            if (autoscrollEnabled) {
                await scrollToBottom();
            }
        }
    }

    function handleAutoscrollChange(event: Event) {
        const checkbox = event.target as HTMLInputElement;
        autoscrollEnabled = checkbox.checked;
        console.log(`Autoscroll set to ${autoscrollEnabled}`);
        if (autoscrollEnabled && selectedProcessId) {
            scrollToBottom();
        }
    }

    async function scrollToBottom() {
        if (!selectedProcessId) return;

        const element = document.querySelector('.log-content') as HTMLPreElement | null;
        if (element) {
            await tick();
            element.scrollTop = element.scrollHeight;
            console.log(`Autoscrolled log for process ${selectedProcessId}`);
        } else {
            console.warn(`Cannot find log element for process ${selectedProcessId} to autoscroll.`);
        }
    }

    // Filter logs based on search query
    function filterLogs() {
        if (!selectedProcessId || !logs[selectedProcessId]) return;

        if (!searchQuery.trim()) {
            isFiltering = false;
            filteredLogs = [];
            return;
        }

        isFiltering = true;
        const query = searchQuery.toLowerCase();
        filteredLogs = logs[selectedProcessId].lines.filter(line => 
            line.toLowerCase().includes(query)
        );
    }

    // Handle search input changes
    function handleSearchInput(event: Event) {
        const input = event.target as HTMLInputElement;
        searchQuery = input.value;
        filterLogs();
    }

    // Clear search
    function clearSearch() {
        searchQuery = '';
        isFiltering = false;
        filteredLogs = [];
    }

    // Upload logs and copy URL to clipboard
    async function uploadAndCopyLog() {
        if (!selectedProcessId) return;

        // Reset previous error for this process
        uploadError[selectedProcessId] = null;
        // Set loading state
        isUploadingLog[selectedProcessId] = true;

        // Get log content
        const logData = logs[selectedProcessId];
        if (!logData || logData.lines.length === 0) {
            console.error("No log content available to upload for process", selectedProcessId);
            uploadError[selectedProcessId] = "No log content found.";
            isUploadingLog[selectedProcessId] = false;
            return;
        }

        const logContent = logData.lines.join('\n');

        try {
            // Invoke the backend command
            const url: string = await invoke("upload_log_to_mclogs_command", { logContent });

            // Store the URL
            mclogsUrls[selectedProcessId] = url;

            // Copy to clipboard
            await writeText(url);
            console.log("Copied mclo.gs URL to clipboard:", url);

        } catch (e) {
            console.error(`Error uploading log for ${selectedProcessId}:`, e);
            const errorMsg = e instanceof Error ? e.message : String(e);
            uploadError[selectedProcessId] = `Upload failed: ${errorMsg}`;
        } finally {
            // Clear loading state
            isUploadingLog[selectedProcessId] = false;
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

                            const MAX_LOG_LINES = 1000; // Increased for the dedicated log window
                            if (logs[process_id].lines.length > MAX_LOG_LINES) {
                                logs[process_id].lines.shift();
                            }

                            if (autoscrollEnabled && selectedProcessId === process_id) {
                                scrollToBottom();
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

<div class="log-window">
    <div class="log-container">
        <div class="log-header">
            <h3>Minecraft Logs</h3>

            {#if selectedProcessId && logs[selectedProcessId] && logs[selectedProcessId].lines.length > 0}
                <div class="log-controls">
                    <div class="search-container">
                        <div class="search-input-wrapper">
                            <input 
                                type="text" 
                                placeholder="Search logs..." 
                                value={searchQuery}
                                on:input={handleSearchInput}
                                class="search-input"
                            />
                            {#if searchQuery}
                                <button class="clear-search-button" on:click={clearSearch}>×</button>
                            {/if}
                        </div>
                        {#if searchQuery}
                            <div class="search-results">
                                {filteredLogs.length} matches
                            </div>
                        {/if}
                    </div>

                    <!-- Upload Button -->
                    <div class="upload-section">
                        <button 
                            class="upload-button" 
                            on:click={uploadAndCopyLog} 
                            disabled={isUploadingLog[selectedProcessId]}
                        >
                            {#if isUploadingLog[selectedProcessId]}
                                Uploading...
                            {:else if mclogsUrls[selectedProcessId]}
                                Copy URL Again
                            {:else}
                                Upload & Copy URL
                            {/if}
                        </button>
                        {#if uploadError[selectedProcessId]}
                            <span class="upload-error">Error: {uploadError[selectedProcessId]}</span>
                        {/if}
                        {#if mclogsUrls[selectedProcessId]}
                            <a href={mclogsUrls[selectedProcessId]} target="_blank" rel="noopener noreferrer" class="mclogs-link">
                                {mclogsUrls[selectedProcessId].split('/').pop()}
                            </a>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>

        <div class="log-content-container">
            {#if !selectedProcessId}
                <div class="no-selection">Select a process to view logs</div>
            {:else if isLoadingFullLogs === selectedProcessId}
                <div class="loading">Loading full log...</div>
            {:else if fullLogError.has(selectedProcessId)}
                <div class="error">{fullLogError.get(selectedProcessId)}</div>
            {:else if logs[selectedProcessId] && logs[selectedProcessId].lines.length > 0}
<pre class="log-content">{#if isFiltering}{filteredLogs.join('\n')}{:else}{logs[selectedProcessId].lines.join('\n')}{/if}</pre>
                <div class="log-footer">
                    <label class="autoscroll-label">
                        <input 
                            type="checkbox" 
                            checked={autoscrollEnabled} 
                            on:change={handleAutoscrollChange}
                        >
                        Autoscroll
                    </label>
                    <span>Last update: {new Date(logs[selectedProcessId].timestamp).toLocaleTimeString()}</span>
                </div>
            {:else}
                <div class="no-logs">No logs received yet or process not running.</div>
            {/if}
        </div>
    </div>

    <div class="process-container">
        <h3>Running Processes</h3>

        {#if isLoading}
            <div class="loading">Loading processes...</div>
        {:else if error}
            <div class="error">{error}</div>
        {:else if processes.length === 0}
            <div class="no-processes">No processes running</div>
        {:else}
            <div class="process-list">
                {#each processes as process}
                    <div 
                        class="process-item {selectedProcessId === process.id ? 'selected' : ''}"
                        on:click={() => selectProcess(process.id)}
                    >
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
                                on:click={(e) => {
                                    e.stopPropagation(); // Prevent selecting the process
                                    stopProcess(process.id);
                                }} 
                                disabled={process.state === 'Stopped' || process.state === 'Stopping'}
                                class="stop-button"
                            >
                                Stop
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .log-window {
        display: flex;
        height: 100vh;
        width: 100%;
        overflow: hidden; /* Prevent scrolling of the main window */
        position: fixed; /* Fix the window in place */
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
    }

    .log-container {
        flex: 3;
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--background-secondary);
        border-right: 1px solid var(--border-color);
        overflow: hidden; /* Prevent scrolling of the container */
    }

    .log-header {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        background-color: var(--background-secondary);
    }

    .log-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 0.5rem;
    }

    .search-container {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1;
        margin-right: 1rem;
    }

    .search-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        border-radius: 4px;
        border: 1px solid var(--border-color);
        background-color: var(--background-primary);
        padding: 0;
        overflow: hidden;
    }

    .search-input {
        width: 100%;
        padding: 0.5rem;
        border: none;
        background-color: transparent;
        color: var(--text-primary);
        font-size: 0.9rem;
        outline: none;
    }

    .search-input:focus {
        box-shadow: 0 0 0 2px var(--accent-color);
        opacity: 0.9;
    }

    .clear-search-button {
        position: absolute;
        right: 0.5rem;
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
    }

    .clear-search-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
        color: var(--text-primary);
    }

    .search-results {
        margin-left: 0.5rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
        white-space: nowrap;
        background-color: rgba(0, 0, 0, 0.05);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
    }

    .upload-button {
        padding: 0.5rem 1rem;
        background-color: var(--accent-color);
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .upload-button:hover:not(:disabled) {
        background-color: var(--accent-hover);
    }

    .upload-button:disabled {
        background-color: var(--border-color);
        cursor: wait;
    }

    .log-content-container {
        flex: 1;
        padding: 0 1rem 1rem 1rem;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .process-container {
        flex: 1;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--background-secondary);
        overflow-y: auto; /* Allow scrolling of the process list */
    }

    h3 {
        margin: 0;
        color: var(--text-primary);
        font-size: 1.2rem;
    }

    .log-content {
        flex: 1;
        background-color: var(--background-primary);
        border-radius: 4px;
        border: 1px solid var(--border-color); /* Add border to logs */
        padding: 0.75rem;
        overflow-y: auto; /* Allow scrolling of the logs */
        color: var(--text-secondary);
        font-family: monospace;
        font-size: 0.8em;
        white-space: pre-wrap;
        word-break: break-all;
        margin: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Add subtle shadow */
    }

    .process-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .process-item {
        background-color: var(--background-primary);
        border-radius: 6px;
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .process-item:hover {
        background-color: var(--background-hover);
    }

    .process-item.selected {
        border: 2px solid var(--accent-color);
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

    .loading, .error, .no-processes, .no-selection, .no-logs {
        text-align: center;
        padding: 1rem;
        color: var(--text-secondary);
    }

    .error {
        color: #e74c3c;
    }

    .log-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--border-color);
        flex-wrap: wrap;
        gap: 10px;
    }

    .autoscroll-label {
        display: inline-flex;
        align-items: center;
        gap: 0.3em;
        cursor: pointer;
    }

    .autoscroll-label input[type="checkbox"] {
        cursor: pointer;
    }

    .upload-section {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .upload-error {
        color: white;
        background-color: #e74c3c;
        font-size: 0.8rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        margin-left: 0.5rem;
    }

    .mclogs-link {
        font-size: 0.8rem;
        color: var(--link-color);
        text-decoration: none;
        background-color: rgba(0, 0, 0, 0.05);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .mclogs-link:hover {
        text-decoration: underline;
        background-color: rgba(0, 0, 0, 0.1);
    }

    /* Styles for no-selection, loading, error, and no-logs messages */
    .no-selection, .loading, .error, .no-processes, .no-logs {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-secondary);
        font-style: italic;
    }
</style>
