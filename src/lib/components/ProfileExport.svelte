<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import FileNodeViewer from "./FileNodeViewer.svelte";
    import type { FileNode } from "$lib/types/fileSystem";
    import { onMount } from "svelte";

    // Component props
    const props = $props<{
        profileId: string;
        profileName: string;
        onClose: () => void;
        onSuccess: () => void;
    }>();

    // States
    let exportFileName = $state(
        props.profileName.replace(/\s+/g, "_").toLowerCase(),
    );
    let isLoading = $state(true);
    let isSubmitting = $state(false);
    let directoryStructure: FileNode | null = $state(null);
    let error: string | null = $state(null);
    let selectedFiles = $state(new Set<string>());
    let exportPath: string | null = $state(null);

    // Load the directory structure of the profile
    onMount(async () => {
        try {
            isLoading = true;
            error = null;

            console.log(
                `[ProfileExport] Loading directory structure for profile ${props.profileId}`,
            );
            directoryStructure = await invoke<FileNode>(
                "get_profile_directory_structure",
                {
                    profileId: props.profileId,
                },
            );

            console.log(
                `[ProfileExport] Directory structure loaded successfully`,
                directoryStructure,
            );
        } catch (err) {
            console.error(
                "[ProfileExport] Error loading directory structure:",
                err,
            );
            error = err instanceof Error ? err.message : String(err);
        } finally {
            isLoading = false;
        }
    });

    // Handle selection changes from FileNodeViewer
    function handleSelectionChange(event: CustomEvent) {
        selectedFiles = event.detail.selectedFiles;
        console.log(
            `[ProfileExport] Selection changed, ${selectedFiles.size} files selected`,
        );
    }

    // Submit the export operation
    async function exportProfile() {
        if (!exportFileName || exportFileName.trim() === "") {
            error = "Bitte gib einen Dateinamen für den Export an";
            return;
        }

        try {
            isSubmitting = true;
            error = null;

            console.log(
                `[ProfileExport] Exporting profile ${props.profileId} with base name "${exportFileName}"`,
            );
            console.log(
                `[ProfileExport] Selected ${selectedFiles.size} files to include`,
            );

            // Convert Set to array for Tauri RPC
            const includeFiles = Array.from(selectedFiles);

            const result = await invoke<string>("export_profile", { params: {
                profile_id: props.profileId,
                output_path: null, // Use the hardcoded path in Rust
                file_name: exportFileName, // Just the base name
                include_files:
                    includeFiles.length > 0 ? includeFiles : null,
                open_folder: true, // Open the export folder after successful export
            }});

            exportPath = result;
            console.log(
                `[ProfileExport] Profile exported successfully to: ${result}`,
            );
            
            // The export_profile command opens the folder directly now, so no need for a separate call
            
            props.onSuccess();
        } catch (err) {
            console.error("[ProfileExport] Error exporting profile:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            isSubmitting = false;
        }
    }
</script>

<div class="profile-export-container">
    <div class="modal-header">
        <h3>Profil exportieren</h3>
        <button
            class="close-button"
            on:click={props.onClose}
            aria-label="Schließen">×</button
        >
    </div>

    <div class="modal-body">
        {#if error}
            <div class="error-message">
                <span>{error}</span>
            </div>
        {/if}

        {#if exportPath}
            <div class="success-message">
                <p>Profil erfolgreich exportiert nach:</p>
                <code>{exportPath}</code>
            </div>
        {:else}
            <div class="form-group">
                <label for="exportFileName">Name für den Export:</label>
                <input
                    type="text"
                    id="exportFileName"
                    bind:value={exportFileName}
                    placeholder="profilname"
                    disabled={isSubmitting}
                />
                <small class="helper-hint">.noriskpack wird automatisch angehängt</small>
            </div>

            <div class="file-selection-container">
                <h4>Dateien auswählen (optional)</h4>
                <p class="helper-text">
                    Wähle die Dateien und Ordner aus, die in die
                    .noriskpack-Datei aufgenommen werden sollen. Wenn keine
                    Dateien ausgewählt sind, wird nur das Profil ohne Inhalte
                    exportiert.
                </p>

                <FileNodeViewer
                    rootNode={directoryStructure}
                    loading={isLoading}
                    {error}
                    {selectedFiles}
                    checkboxesEnabled={true}
                    hideRootNode={true}
                    preSelectPaths={[
                        "resourcepacks",
                        "shaderpacks",
                        "options.txt",
                    ]}
                    selectChildrenWithParent={true}
                    on:selectionChange={handleSelectionChange}
                />
            </div>
        {/if}
    </div>

    <div class="modal-footer">
        <button
            class="cancel-button"
            on:click={props.onClose}
            disabled={isSubmitting}
        >
            {exportPath ? "Schließen" : "Abbrechen"}
        </button>
        {#if !exportPath}
            <button
                class="primary-button"
                on:click={exportProfile}
                disabled={isSubmitting || !exportFileName}
            >
                {isSubmitting ? "Exportiere..." : "Profil exportieren"}
            </button>
        {/if}
    </div>
</div>

<style>
    .profile-export-container {
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        width: 700px;
        max-width: 90vw;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #ddd;
    }

    .modal-header h3 {
        margin: 0;
        font-weight: 600;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }

    .close-button:hover {
        color: #333;
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }

    .error-message {
        background-color: #fbeae8;
        color: #e74c3c;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
    }

    .success-message {
        background-color: #eafaf1;
        color: #27ae60;
        padding: 15px;
        border-radius: 4px;
        margin-bottom: 15px;
    }

    .success-message code {
        display: block;
        background-color: #f9f9f9;
        padding: 8px;
        margin-top: 8px;
        border-radius: 3px;
        color: #333;
        word-break: break-all;
    }

    .form-group {
        margin-bottom: 20px;
        width: 100%;
        box-sizing: border-box;
    }

    .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
    }

    input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 16px;
        box-sizing: border-box;
    }

    input:focus {
        border-color: #3498db;
        outline: none;
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
    }

    .file-selection-container {
        margin-top: 20px;
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
    }

    .file-selection-container h4 {
        margin-top: 0;
        margin-bottom: 10px;
    }

    .helper-text {
        color: #666;
        font-size: 14px;
        margin-bottom: 15px;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 15px 20px;
        border-top: 1px solid #ddd;
    }

    button {
        padding: 8px 15px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
    }

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .cancel-button {
        background-color: #e0e0e0;
        color: #333;
    }

    .cancel-button:hover:not(:disabled) {
        background-color: #d0d0d0;
    }

    .primary-button {
        background-color: #3498db;
        color: white;
    }

    .primary-button:hover:not(:disabled) {
        background-color: #2980b9;
    }

    .helper-hint {
        display: block;
        font-size: 12px;
        color: #666;
        margin-top: 4px;
    }
</style>
