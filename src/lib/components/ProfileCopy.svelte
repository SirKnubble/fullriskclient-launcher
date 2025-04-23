<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import FileNodeViewer from './FileNodeViewer.svelte';
    import type { FileNode } from '$lib/types/fileSystem';
    import { onMount } from "svelte";
    
    // Component props
    const props = $props<{
        sourceProfileId: string;
        sourceProfileName: string;
        onClose: () => void;
        onSuccess: () => void;
    }>();
    
    // States
    let newProfileName = $state(props.sourceProfileName + " (Kopie)");
    let isLoading = $state(true);
    let isSubmitting = $state(false);
    let directoryStructure: FileNode | null = $state(null);
    let error: string | null = $state(null);
    let selectedFiles = $state(new Set<string>());
    
    // Load the directory structure of the source profile
    onMount(async () => {
        try {
            isLoading = true;
            error = null;
            
            console.log(`[ProfileCopy] Loading directory structure for profile ${props.sourceProfileId}`);
            directoryStructure = await invoke<FileNode>("get_profile_directory_structure", {
                profileId: props.sourceProfileId
            });
            
            console.log(`[ProfileCopy] Directory structure loaded successfully`, directoryStructure);
        } catch (err) {
            console.error("[ProfileCopy] Error loading directory structure:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            isLoading = false;
        }
    });
    
    // Handle selection changes from FileNodeViewer
    function handleSelectionChange(event: CustomEvent) {
        selectedFiles = event.detail.selectedFiles;
        console.log(`[ProfileCopy] Selection changed, ${selectedFiles.size} files selected`);
    }
    
    // Submit the copy operation
    async function copyProfile() {
        if (!newProfileName || newProfileName.trim() === "") {
            error = "Bitte gib einen Namen für das neue Profil ein";
            return;
        }
        
        try {
            isSubmitting = true;
            error = null;
            
            console.log(`[ProfileCopy] Copying profile ${props.sourceProfileId} to "${newProfileName}"`);
            console.log(`[ProfileCopy] Selected ${selectedFiles.size} files to copy`);
            
            // Convert Set to array for Tauri RPC
            const includeFiles = Array.from(selectedFiles);
            
            await invoke("copy_profile", {
                params: {
                    source_profile_id: props.sourceProfileId,
                    new_profile_name: newProfileName,
                    include_files: includeFiles.length > 0 ? includeFiles : undefined
                }
            });
            
            console.log(`[ProfileCopy] Profile copied successfully`);
            props.onSuccess();
        } catch (err) {
            console.error("[ProfileCopy] Error copying profile:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            isSubmitting = false;
        }
    }
</script>

<div class="profile-copy-container">
    <div class="modal-header">
        <h3>Profil kopieren</h3>
        <button class="close-button" on:click={props.onClose} aria-label="Schließen">×</button>
    </div>
    
    <div class="modal-body">
        {#if error}
            <div class="error-message">
                <span>{error}</span>
            </div>
        {/if}
        
        <div class="form-group">
            <label for="profileName">Name des neuen Profils:</label>
            <input 
                type="text" 
                id="profileName" 
                bind:value={newProfileName}
                placeholder="Neuer Profilname"
                disabled={isSubmitting}
            />
        </div>
        
        <div class="file-selection-container">
            <h4>Dateien auswählen (optional)</h4>
            <p class="helper-text">
                Wähle die Dateien und Ordner aus, die in das neue Profil kopiert werden sollen.
                Wenn keine Dateien ausgewählt sind, wird nur das Profil ohne Inhalte kopiert.
            </p>
            
            <FileNodeViewer
                rootNode={directoryStructure}
                loading={isLoading}
                error={error}
                selectedFiles={selectedFiles}
                checkboxesEnabled={true}
                selectChildrenWithParent={true}
                on:selectionChange={handleSelectionChange}
            />
        </div>
    </div>
    
    <div class="modal-footer">
        <button 
            class="cancel-button" 
            on:click={props.onClose}
            disabled={isSubmitting}
        >
            Abbrechen
        </button>
        <button 
            class="primary-button" 
            on:click={copyProfile}
            disabled={isSubmitting || !newProfileName}
        >
            {isSubmitting ? 'Kopiere...' : 'Profil kopieren'}
        </button>
    </div>
</div>

<style>
    .profile-copy-container {
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
    
    .form-group {
        margin-bottom: 20px;
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
    }
    
    input:focus {
        border-color: #3498db;
        outline: none;
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
    }
    
    .file-selection-container {
        margin-top: 20px;
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
</style> 