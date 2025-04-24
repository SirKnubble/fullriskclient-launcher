<script lang="ts">
    import type { FileNode } from '$lib/types/fileSystem';
    import { createEventDispatcher, onMount } from 'svelte';

    // Component props with $props in Runes mode
    const props = $props<{
        rootNode: FileNode | null;
        loading: boolean;
        error: string | null;
        selectedFiles: Set<string>;
        checkboxesEnabled: boolean;
        // Neue Eigenschaften für Vorauswahlen
        preSelectPaths?: string[]; // Pfade oder Teilpfade, die automatisch ausgewählt werden sollen
        selectChildrenWithParent?: boolean; // Kinder automatisch mit Elternelementen auswählen
        // Neue Optionen für Root-Darstellung
        hideRootNode?: boolean; // Root-Knoten vollständig ausblenden und nur Kinder anzeigen
        defaultRootCollapsed?: boolean; // Root-Knoten standardmäßig einklappen
    }>();

    // Default values for props
    const rootNode = $derived(props.rootNode || null);
    const loading = $derived(props.loading || false);
    const error = $derived(props.error || null);
    const selectedFiles = $derived(props.selectedFiles || new Set<string>());
    const checkboxesEnabled = $derived(props.checkboxesEnabled !== false); // true by default
    const preSelectPaths = $derived(props.preSelectPaths || []); // Leeres Array als Standard
    const selectChildrenWithParent = $derived(props.selectChildrenWithParent !== false); // true by default
    const hideRootNode = $derived(props.hideRootNode || false); // Root-Knoten standardmäßig anzeigen
    const defaultRootCollapsed = $derived(props.defaultRootCollapsed || false); // Root-Knoten standardmäßig ausgeklappt

    // Set to track expanded folders - use $state for reactivity
    let expandedNodes = $state(new Set<string>());
    
    // Track if root has been set up
    let rootInitialized = $state(false);
    
    // Tracker für die initiale Anwendung der Vorauswahl
    let preSelectionsApplied = $state(false);
    
    // Event dispatcher
    const dispatch = createEventDispatcher();

    // Watch for changes to the root node and expand it if necessary
    $effect(() => {
        if (rootNode && rootNode.path && !rootInitialized) {
            console.log("[FileNodeViewer Component] Root node detected, automatically expanding:", rootNode.path);
            
            // Nur expandieren, wenn der Root nicht standardmäßig eingeklappt sein soll
            if (!defaultRootCollapsed) {
                expandedNodes.add(rootNode.path);
            }
            
            rootInitialized = true;
            
            // Log root node details
            console.log("[FileNodeViewer Component] Root node details:", {
                name: rootNode.name,
                path: rootNode.path,
                childrenCount: rootNode.children?.length || 0,
                isExpanded: expandedNodes.has(rootNode.path),
                hideRootNode,
                defaultRootCollapsed
            });
            
            // Wenn preSelectPaths vorhanden sind, führe die Vorauswahl durch (nur beim ersten Mal)
            if (preSelectPaths && preSelectPaths.length > 0 && !preSelectionsApplied) {
                applyPreSelection();
                preSelectionsApplied = true;
            }
        }
    });

    // Listen for changes to preSelectPaths property
    $effect(() => {
        // Nur anwenden, wenn sich preSelectPaths ändert und noch nicht angewendet wurde
        if (rootNode && preSelectPaths && preSelectPaths.length > 0 && !preSelectionsApplied) {
            applyPreSelection();
            preSelectionsApplied = true;
        }
    });

    // Add onMount debug
    onMount(() => {
        console.log("[FileNodeViewer Component] Component mounted with initial props:", {
            rootNodeExists: !!rootNode,
            rootPath: rootNode?.path,
            loading,
            error,
            selectedFilesCount: selectedFiles.size,
            preSelectPaths,
            selectChildrenWithParent,
            hideRootNode,
            defaultRootCollapsed
        });
        
        // If rootNode already exists at mount time, expand it (unless configured not to)
        if (rootNode && rootNode.path) {
            console.log("[FileNodeViewer Component] Root node exists at mount time:", rootNode.path);
            
            if (!defaultRootCollapsed) {
                expandedNodes.add(rootNode.path);
                console.log("[FileNodeViewer Component] Expanding root node in onMount");
            } else {
                console.log("[FileNodeViewer Component] Root node left collapsed per configuration");
            }
            
            rootInitialized = true;
            
            // Wende Vorauswahl an, wenn vorhanden und noch nicht angewendet
            if (preSelectPaths && preSelectPaths.length > 0 && !preSelectionsApplied) {
                applyPreSelection();
                preSelectionsApplied = true;
            }
        }
    });
    
    // Explicitly toggle folder expanded state
    function toggleFolderExpanded(path: string, event?: Event): void {
        if (!path) {
            console.error("[FileNodeViewer Component] Cannot toggle undefined path");
            return;
        }
        
        if (event) {
            event.stopPropagation(); // Prevent selection when toggling expansion
        }
        
        console.log("[FileNodeViewer Component] Attempt to toggle folder for path:", path);
        
        // Create a new Set for reactivity
        const newExpandedNodes = new Set(expandedNodes);
        
        if (expandedNodes.has(path)) {
            newExpandedNodes.delete(path);
            console.log("[FileNodeViewer Component] Folder collapsed:", path);
        } else {
            newExpandedNodes.add(path);
            console.log("[FileNodeViewer Component] Folder expanded:", path);
        }
        
        // Update the state
        expandedNodes = newExpandedNodes;
    }
    
    // Toggle file or folder selection with child selection support
    function toggleSelection(node: FileNode, event: Event): void {
        if (!node || !node.path) return;
        
        event.stopPropagation();
        
        console.log("[FileNodeViewer Component] Toggling selection for:", node.path);
        const newSelectedFiles = new Set<string>(selectedFiles);
        const isSelected = selectedFiles.has(node.path);
        
        // Entscheiden, ob wir auswählen oder abwählen
        if (isSelected) {
            // Wenn es ein Ordner ist und selectChildrenWithParent aktiv ist, alle Kinder mit abwählen
            if (node.is_dir && selectChildrenWithParent) {
                removeNodeAndChildren(node, newSelectedFiles);
            } else {
                // Nur den aktuellen Knoten abwählen
                newSelectedFiles.delete(node.path);
            }
        } else {
            // Wenn es ein Ordner ist und selectChildrenWithParent aktiv ist, alle Kinder mit auswählen
            if (node.is_dir && selectChildrenWithParent) {
                addNodeAndChildren(node, newSelectedFiles);
            } else {
                // Nur den aktuellen Knoten auswählen
                newSelectedFiles.add(node.path);
            }
        }
        
        // Dispatch event with updated selection
        dispatch('selectionChange', { selectedFiles: newSelectedFiles });
    }

    // Handle checkbox changes with child selection support
    function handleCheckboxChange(node: FileNode, event: Event): void {
        if (!node || !node.path) return;
        
        // Prevent event bubbling to parent elements
        event.stopPropagation();
        
        const target = event.target as HTMLInputElement;
        console.log("[FileNodeViewer Component] Checkbox changed:", {
            path: node.path,
            checked: target.checked
        });
        
        const newSelectedFiles = new Set<string>(selectedFiles);
        
        if (target.checked) {
            // Wenn wir auswählen und es ein Ordner ist und selectChildrenWithParent aktiv
            if (node.is_dir && selectChildrenWithParent) {
                addNodeAndChildren(node, newSelectedFiles);
            } else {
                // Nur den aktuellen Knoten auswählen
                newSelectedFiles.add(node.path);
            }
        } else {
            // Wenn wir abwählen und es ein Ordner ist und selectChildrenWithParent aktiv
            if (node.is_dir && selectChildrenWithParent) {
                removeNodeAndChildren(node, newSelectedFiles);
            } else {
                // Nur den aktuellen Knoten abwählen
                newSelectedFiles.delete(node.path);
            }
        }
        
        // Dispatch event with updated selection
        dispatch('selectionChange', { selectedFiles: newSelectedFiles });
    }

    // Rekursiv einen Knoten und alle seine Kinder zum Auswahl-Set hinzufügen
    function addNodeAndChildren(node: FileNode, selectedSet: Set<string>): void {
        // Füge den aktuellen Knoten hinzu
        selectedSet.add(node.path);
        
        // Wenn es ein Ordner ist, füge rekursiv alle Kinder hinzu
        if (node.is_dir && node.children && node.children.length > 0) {
            for (const child of node.children) {
                addNodeAndChildren(child, selectedSet);
            }
        }
    }
    
    // Rekursiv einen Knoten und alle seine Kinder aus dem Auswahl-Set entfernen
    function removeNodeAndChildren(node: FileNode, selectedSet: Set<string>): void {
        // Entferne den aktuellen Knoten
        selectedSet.delete(node.path);
        
        // Wenn es ein Ordner ist, entferne rekursiv alle Kinder
        if (node.is_dir && node.children && node.children.length > 0) {
            for (const child of node.children) {
                removeNodeAndChildren(child, selectedSet);
            }
        }
    }
    
    // Prüft, ob ein Pfad mit einem bestimmten Präfix beginnt oder übereinstimmt
    function doesPathMatch(path: string, prefixOrPattern: string): boolean {
        // Einfache Überprüfung: enthält den Pfad oder ist gleich
        return path.includes(prefixOrPattern) || path === prefixOrPattern;
    }
    
    // Wendet die Vorauswahl anhand der preSelectPaths an
    function applyPreSelection(): void {
        if (!rootNode || !preSelectPaths || preSelectPaths.length === 0) return;
        
        console.log("[FileNodeViewer Component] Applying pre-selection with patterns:", preSelectPaths);
        
        const newSelectedFiles = new Set<string>(selectedFiles);
        
        // Durchlaufe den Dateibaum rekursiv und wende die Vorauswahl an
        function traverseAndSelect(node: FileNode): void {
            // Prüfe, ob der aktuelle Pfad mit einem der Vorauswahl-Muster übereinstimmt
            for (const pattern of preSelectPaths) {
                if (doesPathMatch(node.path, pattern)) {
                    // Bei Übereinstimmung diesen Knoten und ggf. Kinder auswählen
                    if (node.is_dir && selectChildrenWithParent) {
                        addNodeAndChildren(node, newSelectedFiles);
                        // Klappe den Ordner automatisch auf, wenn er vorausgewählt ist
                        expandedNodes.add(node.path);
                    } else {
                        newSelectedFiles.add(node.path);
                    }
                    // Stoppe nach der ersten Übereinstimmung
                    break;
                }
            }
            
            // Rekursiv für Kinder prüfen
            if (node.is_dir && node.children && node.children.length > 0) {
                for (const child of node.children) {
                    traverseAndSelect(child);
                }
            }
        }
        
        // Starte mit dem Root-Knoten
        traverseAndSelect(rootNode);
        
        // Nur updaten, wenn sich etwas geändert hat
        if (newSelectedFiles.size !== selectedFiles.size) {
            console.log("[FileNodeViewer Component] Pre-selection applied, selected count:", newSelectedFiles.size);
            dispatch('selectionChange', { selectedFiles: newSelectedFiles });
        }
    }

    // Format file size
    function formatFileSize(size: number): string {
        if (size < 1024) {
            return `${size} B`;
        } else if (size < 1024 * 1024) {
            return `${(size / 1024).toFixed(1)} KB`;
        } else if (size < 1024 * 1024 * 1024) {
            return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        } else {
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        }
    }

    // Format last modified date
    function formatDate(timestamp: number | null): string {
        if (!timestamp) return 'Unknown';
        return new Date(timestamp * 1000).toLocaleString();
    }
    
    // Debug function to list expanded nodes
    function getExpandedNodesList(): string {
        return Array.from(expandedNodes).join(', ');
    }
</script>

<div class="file-node-viewer">
    {#if loading}
        <div class="loading">Loading file structure...</div>
    {:else if error}
        <div class="error">{error}</div>
    {:else if !rootNode}
        <div class="empty">No file structure available</div>
    {:else}
        <!-- Wenn Root-Node ausgeblendet werden soll, zeige nur die Kinder an -->
        {#if hideRootNode}
            {#if rootNode.children && rootNode.children.length > 0}
                <ul class="file-tree root-children-only">
                    {#each rootNode.children as childNode (childNode.path)}
                        <li class="file-node {childNode.is_dir ? 'directory' : 'file'} {selectedFiles.has(childNode.path) ? 'selected' : ''}">
                            <div class="node-content">
                                <!-- Expand/collapse button for directories -->
                                {#if childNode.is_dir && childNode.children && childNode.children.length > 0}
                                    <button 
                                        type="button" 
                                        class="expand-toggle-button"
                                        on:click={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleFolderExpanded(childNode.path, e);
                                        }}
                                    >
                                        {expandedNodes.has(childNode.path) ? '▼' : '►'}
                                    </button>
                                {:else}
                                    <span class="expand-placeholder"></span>
                                {/if}
                                
                                <!-- Checkbox for selection -->
                                {#if checkboxesEnabled}
                                    <input 
                                        type="checkbox" 
                                        checked={selectedFiles.has(childNode.path)} 
                                        class="file-checkbox" 
                                        aria-label="Select {childNode.name}"
                                        on:click={(e) => e.stopPropagation()}
                                        on:change={(e) => handleCheckboxChange(childNode, e)}
                                    />
                                {/if}
                                
                                <span class="node-icon">{childNode.is_dir ? '📁' : '📄'}</span>
                                
                                <!-- Make name clickable for appropriate action -->
                                <span 
                                    class="node-name"
                                    on:click={(e) => {
                                        e.preventDefault();
                                        childNode.is_dir 
                                            ? toggleFolderExpanded(childNode.path, e) 
                                            : toggleSelection(childNode, e);
                                    }}
                                >
                                    {childNode.name}
                                </span>
                                
                                {#if !childNode.is_dir}
                                    <span class="node-size">{formatFileSize(childNode.size)}</span>
                                {/if}
                                
                                <span class="node-date">{formatDate(childNode.last_modified)}</span>
                            </div>
                            
                            <!-- Render children of directories (if expanded) -->
                            {#if childNode.is_dir && expandedNodes.has(childNode.path) && childNode.children && childNode.children.length > 0}
                                <ul class="file-children">
                                    {#each childNode.children as grandChildNode (grandChildNode.path)}
                                        <li class="file-node {grandChildNode.is_dir ? 'directory' : 'file'} {selectedFiles.has(grandChildNode.path) ? 'selected' : ''}">
                                            <div class="node-content">
                                                <!-- Expand/collapse button for directories -->
                                                {#if grandChildNode.is_dir && grandChildNode.children && grandChildNode.children.length > 0}
                                                    <button 
                                                        type="button" 
                                                        class="expand-toggle-button"
                                                        on:click={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            toggleFolderExpanded(grandChildNode.path, e);
                                                        }}
                                                    >
                                                        {expandedNodes.has(grandChildNode.path) ? '▼' : '►'}
                                                    </button>
                                                {:else}
                                                    <span class="expand-placeholder"></span>
                                                {/if}
                                                
                                                <!-- Checkbox for selection -->
                                                {#if checkboxesEnabled}
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedFiles.has(grandChildNode.path)} 
                                                        class="file-checkbox" 
                                                        aria-label="Select {grandChildNode.name}"
                                                        on:click={(e) => e.stopPropagation()}
                                                        on:change={(e) => handleCheckboxChange(grandChildNode, e)}
                                                    />
                                                {/if}
                                                
                                                <span class="node-icon">{grandChildNode.is_dir ? '📁' : '📄'}</span>
                                                
                                                <span 
                                                    class="node-name"
                                                    on:click={(e) => {
                                                        e.preventDefault();
                                                        grandChildNode.is_dir 
                                                            ? toggleFolderExpanded(grandChildNode.path, e) 
                                                            : toggleSelection(grandChildNode, e);
                                                    }}
                                                >
                                                    {grandChildNode.name}
                                                </span>
                                                
                                                {#if !grandChildNode.is_dir}
                                                    <span class="node-size">{formatFileSize(grandChildNode.size)}</span>
                                                {/if}
                                                
                                                <span class="node-date">{formatDate(grandChildNode.last_modified)}</span>
                                            </div>
                                            
                                            <!-- Tiefere Ebenen anzeigen falls notwendig -->
                                            {#if grandChildNode.is_dir && expandedNodes.has(grandChildNode.path) && grandChildNode.children && grandChildNode.children.length > 0}
                                                <ul class="file-children">
                                                    <!-- Hier weiteren verschachtelten Code für die nächste Ebene, wie oben -->
                                                </ul>
                                            {/if}
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </li>
                    {/each}
                </ul>
            {:else}
                <div class="empty">Keine Dateien verfügbar</div>
            {/if}
        {:else}
            <!-- Klassische Anzeige mit Root-Node -->
            <ul class="file-tree">
                <!-- Root node rendering -->
                <li class="file-node directory {selectedFiles.has(rootNode.path) ? 'selected' : ''}">
                    <div class="node-content">
                        {#if rootNode.children && rootNode.children.length > 0}
                            <!-- Explicit expand/collapse button for the root -->
                            <button 
                                type="button" 
                                class="expand-toggle-button"
                                on:click={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleFolderExpanded(rootNode.path, e);
                                }}
                            >
                                {expandedNodes.has(rootNode.path) ? '▼' : '►'}
                            </button>
                        {:else}
                            <span class="expand-placeholder"></span>
                        {/if}
                        
                        {#if checkboxesEnabled}
                            <input 
                                type="checkbox" 
                                checked={selectedFiles.has(rootNode.path)} 
                                class="file-checkbox" 
                                aria-label="Select {rootNode.name}"
                                on:click={(e) => e.stopPropagation()}
                                on:change={(e) => handleCheckboxChange(rootNode, e)}
                            />
                        {/if}
                        
                        <span class="node-icon">📁</span>
                        <span 
                            class="node-name"
                            on:click={(e) => {
                                e.preventDefault();
                                toggleFolderExpanded(rootNode.path, e);
                            }}
                        >
                            {rootNode.name}
                        </span>
                    </div>
                    
                    <!-- Root's children - only shown if expanded -->
                    {#if expandedNodes.has(rootNode.path) && rootNode.children && rootNode.children.length > 0}
                        <ul class="file-children">
                            {#each rootNode.children as childNode (childNode.path)}
                                <li class="file-node {childNode.is_dir ? 'directory' : 'file'} {selectedFiles.has(childNode.path) ? 'selected' : ''}">
                                    <div class="node-content">
                                        <!-- Expand/collapse button for directories -->
                                        {#if childNode.is_dir && childNode.children && childNode.children.length > 0}
                                            <button 
                                                type="button" 
                                                class="expand-toggle-button"
                                                on:click={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleFolderExpanded(childNode.path, e);
                                                }}
                                            >
                                                {expandedNodes.has(childNode.path) ? '▼' : '►'}
                                            </button>
                                        {:else}
                                            <span class="expand-placeholder"></span>
                                        {/if}
                                        
                                        <!-- Checkbox for selection -->
                                        {#if checkboxesEnabled}
                                            <input 
                                                type="checkbox" 
                                                checked={selectedFiles.has(childNode.path)} 
                                                class="file-checkbox" 
                                                aria-label="Select {childNode.name}"
                                                on:click={(e) => e.stopPropagation()}
                                                on:change={(e) => handleCheckboxChange(childNode, e)}
                                            />
                                        {/if}
                                        
                                        <span class="node-icon">{childNode.is_dir ? '📁' : '📄'}</span>
                                        
                                        <!-- Make name clickable for appropriate action -->
                                        <span 
                                            class="node-name"
                                            on:click={(e) => {
                                                e.preventDefault();
                                                childNode.is_dir 
                                                    ? toggleFolderExpanded(childNode.path, e) 
                                                    : toggleSelection(childNode, e);
                                            }}
                                        >
                                            {childNode.name}
                                        </span>
                                        
                                        {#if !childNode.is_dir}
                                            <span class="node-size">{formatFileSize(childNode.size)}</span>
                                        {/if}
                                        
                                        <span class="node-date">{formatDate(childNode.last_modified)}</span>
                                    </div>
                                    
                                    <!-- Render children of directories (if expanded) -->
                                    {#if childNode.is_dir && expandedNodes.has(childNode.path) && childNode.children && childNode.children.length > 0}
                                        <ul class="file-children">
                                            {#each childNode.children as grandChildNode (grandChildNode.path)}
                                                <li class="file-node {grandChildNode.is_dir ? 'directory' : 'file'} {selectedFiles.has(grandChildNode.path) ? 'selected' : ''}">
                                                    <div class="node-content">
                                                        <!-- Expand/collapse button for directories -->
                                                        {#if grandChildNode.is_dir && grandChildNode.children && grandChildNode.children.length > 0}
                                                            <button 
                                                                type="button" 
                                                                class="expand-toggle-button"
                                                                on:click={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    toggleFolderExpanded(grandChildNode.path, e);
                                                                }}
                                                            >
                                                                {expandedNodes.has(grandChildNode.path) ? '▼' : '►'}
                                                            </button>
                                                        {:else}
                                                            <span class="expand-placeholder"></span>
                                                        {/if}
                                                        
                                                        <!-- Checkbox for selection -->
                                                        {#if checkboxesEnabled}
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedFiles.has(grandChildNode.path)} 
                                                                class="file-checkbox" 
                                                                aria-label="Select {grandChildNode.name}"
                                                                on:click={(e) => e.stopPropagation()}
                                                                on:change={(e) => handleCheckboxChange(grandChildNode, e)}
                                                            />
                                                        {/if}
                                                        
                                                        <span class="node-icon">{grandChildNode.is_dir ? '📁' : '📄'}</span>
                                                        
                                                        <span 
                                                            class="node-name"
                                                            on:click={(e) => {
                                                                e.preventDefault();
                                                                grandChildNode.is_dir 
                                                                    ? toggleFolderExpanded(grandChildNode.path, e) 
                                                                    : toggleSelection(grandChildNode, e);
                                                            }}
                                                        >
                                                            {grandChildNode.name}
                                                        </span>
                                                        
                                                        {#if !grandChildNode.is_dir}
                                                            <span class="node-size">{formatFileSize(grandChildNode.size)}</span>
                                                        {/if}
                                                        
                                                        <span class="node-date">{formatDate(grandChildNode.last_modified)}</span>
                                                    </div>
                                                    
                                                    <!-- Render deeper levels if needed -->
                                                    {#if grandChildNode.is_dir && expandedNodes.has(grandChildNode.path) && grandChildNode.children && grandChildNode.children.length > 0}
                                                        <ul class="file-children">
                                                            {#each grandChildNode.children as greatGrandChildNode (greatGrandChildNode.path)}
                                                                <li class="file-node {greatGrandChildNode.is_dir ? 'directory' : 'file'} {selectedFiles.has(greatGrandChildNode.path) ? 'selected' : ''}">
                                                                    <div class="node-content">
                                                                        <!-- Simple placeholder for deeper levels -->
                                                                        <span class="expand-placeholder"></span>
                                                                        
                                                                        {#if checkboxesEnabled}
                                                                            <input 
                                                                                type="checkbox" 
                                                                                checked={selectedFiles.has(greatGrandChildNode.path)} 
                                                                                class="file-checkbox" 
                                                                                aria-label="Select {greatGrandChildNode.name}"
                                                                                on:click={(e) => e.stopPropagation()}
                                                                                on:change={(e) => handleCheckboxChange(greatGrandChildNode, e)}
                                                                            />
                                                                        {/if}
                                                                        
                                                                        <span class="node-icon">{greatGrandChildNode.is_dir ? '📁' : '📄'}</span>
                                                                        
                                                                        <span 
                                                                            class="node-name" 
                                                                            on:click={(e) => {
                                                                                e.preventDefault();
                                                                                toggleSelection(greatGrandChildNode, e);
                                                                            }}
                                                                        >
                                                                            {greatGrandChildNode.name}
                                                                        </span>
                                                                        
                                                                        {#if !greatGrandChildNode.is_dir}
                                                                            <span class="node-size">{formatFileSize(greatGrandChildNode.size)}</span>
                                                                        {/if}
                                                                        
                                                                        <span class="node-date">{formatDate(greatGrandChildNode.last_modified)}</span>
                                                                    </div>
                                                                </li>
                                                            {/each}
                                                        </ul>
                                                    {/if}
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </li>
            </ul>
        {/if}
    {/if}

    <!-- Debug View -->
    <div class="debug-section">
        <details>
            <summary>Debug Info</summary>
            <div class="debug-content">
                <p>Loading: {loading}</p>
                <p>Error: {error || 'None'}</p>
                <p>Root Node: {rootNode ? `${rootNode.name} (${rootNode.children?.length || 0} children)` : 'Not available'}</p>
                <p>Selected Files: {selectedFiles.size}</p>
                <p>Expanded Nodes Count: {expandedNodes.size}</p>
                <p>Root Initialized: {rootInitialized ? 'Yes' : 'No'}</p>
                <p>PreSelect Paths: {preSelectPaths?.join(', ') || 'None'}</p>
                <p>Select Children With Parent: {selectChildrenWithParent ? 'Yes' : 'No'}</p>
                <p>Hide Root Node: {hideRootNode ? 'Yes' : 'No'}</p>
                <p>Default Root Collapsed: {defaultRootCollapsed ? 'Yes' : 'No'}</p>
                {#if rootNode}
                    <p>Root Path: {rootNode.path || 'undefined'}</p>
                    <p>Root Expanded: {expandedNodes.has(rootNode.path) ? 'Yes' : 'No'}</p>
                    <p>Expanded Nodes: {getExpandedNodesList()}</p>
                {/if}
            </div>
        </details>
    </div>
</div>

<style>
    .file-node-viewer {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        margin: 1rem 0;
    }

    .loading, .error, .empty {
        padding: 1rem;
        background-color: #f5f5f5;
        border-radius: 4px;
        text-align: center;
    }

    .error {
        background-color: #fff0f0;
        color: #c00;
    }

    .file-tree {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .file-tree.root-children-only {
        padding-left: 0; /* Keine Einrückung für Kinder ohne Root */
    }

    .file-children {
        list-style: none;
        padding-left: 1.5rem;
        margin: 0;
    }

    .file-node {
        margin: 0.25rem 0;
    }

    .node-content {
        display: flex;
        align-items: center;
        padding: 0.25rem 0;
        border-radius: 4px;
        transition: background-color 0.15s ease;
    }

    .node-content:hover {
        background-color: #f0f8ff;
    }

    /* Placeholder for nodes that don't expand */
    .expand-placeholder {
        width: 20px;
        display: inline-block;
        margin-right: 0.25rem;
        visibility: visible;
    }

    .expand-toggle-button {
        width: 20px;
        height: 20px;
        padding: 0;
        margin-right: 0.25rem;
        background: none;
        border: none;
        font-size: 0.8em;
        color: #666;
        cursor: pointer;
        text-align: center;
        line-height: 1;
    }
    
    .expand-toggle-button:hover {
        background-color: #e0e0e0;
        border-radius: 3px;
    }

    .file-checkbox {
        margin-right: 0.5rem;
        cursor: pointer;
    }

    .node-icon {
        margin-right: 0.5rem;
    }

    .node-name {
        flex: 1;
        word-break: break-all;
        cursor: pointer;
    }

    .node-size {
        margin-left: 0.5rem;
        color: #666;
        font-size: 0.9em;
        width: 70px;
        text-align: right;
    }

    .node-date {
        margin-left: 0.5rem;
        color: #666;
        font-size: 0.9em;
        width: 150px;
        text-align: right;
    }

    .file-node.directory > .node-content {
        font-weight: bold;
    }

    .file-node.selected > .node-content {
        background-color: #e3f2fd;
    }

    /* Debug styles */
    .debug-section {
        margin-top: 1rem;
        border-top: 1px dashed #ccc;
        padding-top: 0.5rem;
    }

    .debug-section summary {
        cursor: pointer;
        color: #666;
        font-size: 0.9rem;
    }

    .debug-content {
        padding: 0.5rem;
        background-color: #f5f5f5;
        border-radius: 4px;
        margin-top: 0.5rem;
        font-family: monospace;
        font-size: 0.9rem;
    }

    .debug-content p {
        margin: 0.2rem 0;
    }
</style> 