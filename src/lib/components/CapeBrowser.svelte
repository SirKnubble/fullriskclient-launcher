<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import { 
        activeAccount, 
        isLoading as accountLoading, 
        error as accountError,
        initializeAccounts
    } from '$lib/stores/accountStore';
    import { notificationStore } from '$lib/stores/notificationStore';
    import type { MinecraftProfile } from '$lib/types/minecraft';

    // Generate a simple random string instead of using uuid
    function generateRequestId(): string {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    // Define interfaces for cape data
    interface CosmeticCape {
        _id: string; // String in Rust, renamed from "_id" in JSON
        accepted: boolean; // bool in Rust
        uses: number; // i32 in Rust
        firstSeen: string; // Uuid in Rust, renamed from "firstSeen" in JSON
        moderatorMessage: string; // String in Rust, renamed from "moderatorMessage" in JSON
        creationDate: number; // i64 in Rust, renamed from "creationDate" in JSON
        elytra: boolean; // bool in Rust
    }

    interface PaginationInfo {
        currentPage: number; // i32 in Rust, renamed from "currentPage" in JSON
        pageSize: number; // i32 in Rust, renamed from "pageSize" in JSON
        totalItems: number; // i32 in Rust, renamed from "totalItems" in JSON
        totalPages: number; // i32 in Rust, renamed from "totalPages" in JSON
    }

    interface CapesBrowseResponse {
        capes: CosmeticCape[];
        pagination: PaginationInfo;
    }

    // State variables
    let capes: CosmeticCape[] = $state([]);
    let pagination: PaginationInfo = $state({
        currentPage: 0,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0
    });
    let loading: boolean = $state(true);
    let error: string | null = $state(null);

    // Filter and sort options
    let page: number = $state(0);
    let pageSize: number = $state(20);
    let sortBy: string = $state("mostUsed"); // newest, oldest, mostUsed
    let filterHasElytra: boolean | null = $state(true);
    let filterCreator: string | null = $state(null);
    let timeFrame: string = $state("allTime"); // allTime, weekly, monthly

    // Selected cape
    let selectedCape: CosmeticCape | null = $state(null);

    // State for creator names in the grid
    let creatorNames = $state(new Map<string, string | null>());
    let loadingCreatorNames = $state(new Map<string, boolean>());

    // Equip state
    let equipping: boolean = $state(false);

    onMount(async () => {
        // Initialize accounts if not already loaded
        if (!$activeAccount) {
            await initializeAccounts();
        }

        // Load capes
        await loadCapes();
    });

    // Reactive effect to reload capes when active account changes
    $effect(() => {
        if ($activeAccount) {
            loadCapes();
        } else {
            capes = [];
            pagination = {
                currentPage: 0,
                pageSize: 20,
                totalItems: 0,
                totalPages: 0
            };
        }
    });

    // Load capes with current filter settings
    async function loadCapes() {
        if (!$activeAccount) return;

        loading = true;
        error = null;

        try {
            // Generate a request ID for tracking
            const requestUuid = generateRequestId();

            console.log("Loading capes with parameters:", { 
                page, 
                page_size: pageSize, 
                sort_by: sortBy, 
                filter_has_elytra: filterHasElytra, 
                filter_creator: filterCreator, 
                time_frame: timeFrame
            });

            // Call the browse_capes command
            const response = await invoke<CapesBrowseResponse>("browse_capes", {
                page,
                pageSize: pageSize,
                sortBy: sortBy,
                filterHasElytra: filterHasElytra,
                filterCreator: filterCreator,
                timeFrame: timeFrame
            });

            console.log("Raw API response:", response);

            capes = response.capes;
            pagination = response.pagination;

            // Trigger fetching for unique creator UUIDs in the current page results
            const uniqueCreatorUuids = new Set(capes.map(cape => cape.firstSeen).filter(uuid => !!uuid));
            uniqueCreatorUuids.forEach(uuid => {
                fetchAndStoreCreatorName(uuid);
            });

            console.log("Capes array:", capes);
            if (capes.length > 0) {
                console.log("First cape object:", capes[0]);
                console.log("First cape hash:", capes[0]?._id);
                console.log("First cape hash type:", typeof capes[0]?._id);
            }

            console.log(`Loaded ${capes.length} capes (page ${pagination?.currentPage + 1} of ${pagination?.totalPages})`);
        } catch (err) {
            console.error("Error loading capes:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    // Handle page change
    async function changePage(newPage: number) {
        if (newPage < 0 || newPage >= pagination.totalPages) return;

        page = newPage;
        await loadCapes();
    }

    // Handle sort change
    async function changeSort(newSortBy: string) {
        sortBy = newSortBy;
        page = 0; // Reset to first page when changing sort
        await loadCapes();
    }

    // Handle filter changes
    async function applyFilters() {
        page = 0; // Reset to first page when applying filters
        await loadCapes();
    }

    // Reset all filters
    async function resetFilters() {
        page = 0;
        pageSize = 20;
        sortBy = "newest";
        filterHasElytra = null;
        filterCreator = null;
        timeFrame = "allTime";
        await loadCapes();
    }

    // Format date from timestamp
    function formatDate(timestamp: number): string {
        console.log("Formatting date with timestamp:", timestamp);
        const date = new Date(timestamp);
        console.log("Converted to Date object:", date);
        const formatted = date.toLocaleDateString();
        console.log("Formatted date:", formatted);
        return formatted;
    }

    // Fetch creator username using their UUID and store it in the map
    async function fetchAndStoreCreatorName(creatorUuid: string) {
        // Check if already loading or fetched
        if (loadingCreatorNames.get(creatorUuid) || creatorNames.has(creatorUuid)) {
            return; // Already handling this UUID
        }

        if (!$activeAccount?.access_token) {
            console.warn(`Cannot fetch creator name for ${creatorUuid}: No active account or access token.`);
            return;
        }

        loadingCreatorNames.set(creatorUuid, true);
        // Trigger reactivity explicitly by creating a new map
        loadingCreatorNames = new Map(loadingCreatorNames); 

        try {
            // console.log(`Fetching profile for UUID: ${creatorUuid}`);
            const profile = await invoke<MinecraftProfile>("get_user_skin_data", {
                uuid: creatorUuid,
                accessToken: $activeAccount.access_token
            });
            console.log(`[fetchAndStoreCreatorName] SUCCESS for ${creatorUuid}:`, profile);
            creatorNames.set(creatorUuid, profile.name);
            // Trigger reactivity explicitly by creating a new map
            creatorNames = new Map(creatorNames);
            console.log(`[fetchAndStoreCreatorName] Set name for ${creatorUuid} to ${profile.name}. Map size: ${creatorNames.size}`);
        } catch (err) {
            console.error(`[fetchAndStoreCreatorName] ERROR fetching profile for UUID ${creatorUuid}:`, err);
            creatorNames.set(creatorUuid, `(${creatorUuid.substring(0,4)}..err)`); 
            // Trigger reactivity explicitly by creating a new map
            creatorNames = new Map(creatorNames);
            console.log(`[fetchAndStoreCreatorName] Set error state for ${creatorUuid}. Map size: ${creatorNames.size}`);
        } finally {
            loadingCreatorNames.set(creatorUuid, false);
            // Trigger reactivity explicitly by creating a new map
            loadingCreatorNames = new Map(loadingCreatorNames);
            console.log(`[fetchAndStoreCreatorName] Set loading=false for ${creatorUuid}`);
        }
    }

    // Select a cape
    function selectCape(cape: CosmeticCape) {
        console.log("Selected cape:", cape);
        console.log("Cape hash:", cape?._id);
        console.log("Cape hash type:", typeof cape?._id);
        selectedCape = cape;
        // No need to fetch name here anymore, it's handled by loadCapes
    }

    // Load player capes
    async function loadPlayerCapes(playerUuid: string) {
        if (!$activeAccount) return;

        loading = true;
        error = null;
        filterCreator = playerUuid;

        console.log("Loading capes for player:", playerUuid);

        try {
            // Generate a request ID for tracking
            const requestUuid = generateRequestId();

            console.log("Player capes request parameters:", {
                playerUuid: playerUuid,
                page: 0,
                pageSize: 20,
                filterAccepted: true,
                requestUuid: requestUuid,
            });

            // Call the get_player_capes command
            const response = await invoke<CapesBrowseResponse>("get_player_capes", {
                playerUuid: playerUuid,
                page: 0,
                pageSize: 20,
                filterAccepted: true,
                requestUuid: requestUuid,
            });

            console.log("Player capes raw API response:", response);

            capes = response.capes;
            pagination = response.pagination;

            console.log("Player capes array:", capes);
            if (capes.length > 0) {
                console.log("First player cape object:", capes[0]);
                console.log("First player cape hash:", capes[0]?._id);
                console.log("First player cape hash type:", typeof capes[0]?._id);
            }

            console.log(`Loaded ${capes.length} capes for player ${playerUuid}`);
        } catch (err) {
            console.error("Error loading player capes:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    // Equip the selected cape
    async function equipCape(capeHash: string | undefined) {
        if (!capeHash) {
            notificationStore.error("Cannot equip cape: Cape ID is missing."); 
            console.error("Attempted to equip cape without a hash.");
            return;
        }

        equipping = true;

        try {
            console.log(`Attempting to equip cape with hash: ${capeHash}`);
            await invoke("equip_cape", { capeHash: capeHash });
            notificationStore.success(`Cape ${capeHash.substring(0, 8)}... equipped successfully!`); 
            console.log("Cape equipped successfully.");
        } catch (err) {
            console.error("Error equipping cape:", err);
            let errorMessage = "An unknown error occurred while equipping the cape.";
            if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
                errorMessage = err.message; 
            }
            notificationStore.error(`Failed to equip cape: ${errorMessage}`); 
        } finally {
            equipping = false;
        }
    }
</script>

<div class="cape-browser">
    <h3>NoRisk Cape Browser</h3>

    {#if $accountLoading}
        <p class="loading">Loading account data...</p>
    {:else if $accountError}
        <p class="error">{$accountError}</p>
    {:else if !$activeAccount}
        <p class="note">Please log in to browse capes.</p>
    {:else}
        <div class="filter-controls">
            <div class="filter-section">
                <h4>Sort By</h4>
                <div class="sort-options">
                    <button 
                        class:active={sortBy === "newest"} 
                        onclick={() => changeSort("newest")}
                    >
                        Newest
                    </button>
                    <button 
                        class:active={sortBy === "oldest"} 
                        onclick={() => changeSort("oldest")}
                    >
                        Oldest
                    </button>
                    <button 
                        class:active={sortBy === "mostUsed"} 
                        onclick={() => changeSort("mostUsed")}
                    >
                        Most Used
                    </button>
                </div>
            </div>

            <div class="filter-section">
                <h4>Filters</h4>
                <div class="filter-options">
                    <label>
                        <input 
                            type="checkbox" 
                            bind:checked={filterHasElytra} 
                            onchange={applyFilters}
                        />
                        Has Elytra
                    </label>

                    <select bind:value={timeFrame} onchange={applyFilters}>
                        <option value="allTime">All Time</option>
                        <option value="weekly">Last Week</option>
                        <option value="monthly">Last Month</option>
                    </select>

                    <button onclick={resetFilters} class="reset-button">
                        Reset Filters
                    </button>
                </div>
            </div>
        </div>

        {#if loading}
            <p class="loading">Loading capes...</p>
        {:else if error}
            <p class="error">{error}</p>
        {:else if capes.length === 0}
            <p class="note">No capes found matching your criteria.</p>
        {:else}
            <div class="capes-grid">
                {#each capes as cape, index (cape._id || `cape-${index}`)}
                    {@const imageUrl = `https://cdn.norisk.gg/capes-staging/prod/${cape._id}.png`}
                    {@const capeId = cape._id ? cape._id.substring(0, 8) + '...' : 'Unknown ID'}
                    {@const creatorUuid = cape.firstSeen}
                    {@const isLoading = loadingCreatorNames.get(creatorUuid)}
                    {@const creatorName = creatorNames.get(creatorUuid)}
                    <div 
                        class="cape-item" 
                        class:selected={selectedCape?._id === cape._id}
                        onclick={() => selectCape(cape)}
                    >
                        <div class="cape-preview">
                            <img 
                                src={imageUrl}
                                alt={`Cape ${cape._id || 'Unknown'}`} 
                                class="cape-image" 
                                onload={() => console.log(`Cape image loaded: ${imageUrl}`)}
                                onerror={(e) => console.error(`Cape image failed to load: ${imageUrl}`, e)}
                            />
                        </div>
                        <div class="cape-info">
                            {#if isLoading}
                                <p class="cape-creator loading-creator">Loading... {creatorName}</p>
                            {:else if creatorName}
                                <p class="cape-creator">{creatorName}</p>
                            {:else}
                                <p class="cape-creator">{creatorUuid ? creatorUuid.substring(0, 8) + '...' : 'Unknown'}</p>
                            {/if}
                            <p class="cape-date">{formatDate(cape.creationDate || 0)}</p>
                            <p class="cape-uses">Uses: {cape.uses || 0}</p>
                            <p class="cape-elytra">{cape.elytra ? 'Has Elytra' : 'No Elytra'}</p>
                        </div>
                        <button 
                            class="creator-button" 
                            onclick={(e) => {
                                e.stopPropagation();
                                loadPlayerCapes(cape.firstSeen);
                            }}
                            title="View creator's capes"
                        >
                            By Creator
                        </button>
                        <button 
                            class="equip-button-grid"
                            onclick={(e) => {
                                e.stopPropagation(); // Prevent selecting the cape item
                                equipCape(cape._id);
                            }}
                            disabled={equipping} 
                            title="Equip this cape"
                        >
                            {equipping ? '...' : 'Equip'}
                        </button>
                    </div>
                {/each}
            </div>

            <!-- Pagination controls -->
            <div class="pagination">
                <button 
                    onclick={() => changePage(0)} 
                    disabled={pagination.currentPage === 0}
                >
                    First
                </button>
                <button 
                    onclick={() => changePage(pagination.currentPage - 1)} 
                    disabled={pagination.currentPage === 0}
                >
                    Previous
                </button>

                <span class="page-info">
                    Page {(pagination?.currentPage ?? 0) + 1} of {pagination?.totalPages ?? 1}
                </span>

                <button 
                    onclick={() => changePage((pagination?.currentPage ?? 0) + 1)} 
                    disabled={(pagination?.currentPage ?? 0) === (pagination?.totalPages ?? 1) - 1}
                >
                    Next
                </button>
                <button 
                    onclick={() => changePage((pagination?.totalPages ?? 1) - 1)} 
                    disabled={(pagination?.currentPage ?? 0) === (pagination?.totalPages ?? 1) - 1}
                >
                    Last
                </button>
            </div>

            <div class="page-size-control">
                <label>
                    Items per page:
                    <select 
                        bind:value={pageSize} 
                        onchange={applyFilters}
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                    </select>
                </label>
            </div>
        {/if}

        <!-- Cape details when selected -->
        {#if selectedCape}
            {@const detailsImageUrl = `https://cdn.norisk.gg/capes-staging/prod/${selectedCape?._id || 'unknown'}.png`}
            {@debug selectedCape, detailsImageUrl}
            <div class="cape-details">
                <h4>Cape Details</h4>
                <div class="cape-details-content">
                    <div class="cape-details-image">
                        <img 
                            src={detailsImageUrl} 
                            alt={`Cape ${selectedCape?._id || 'Unknown'}`} 
                            class="cape-detail-image" 
                            onload={() => console.log(`Details image loaded: ${detailsImageUrl}`)}
                            onerror={(e) => console.error(`Details image failed to load: ${detailsImageUrl}`, e)}
                        />
                    </div>
                    <div class="cape-details-info">
                        <p><strong>ID:</strong> {selectedCape?._id || 'Unknown'} (Type: {typeof selectedCape?._id})</p>
                        <p><strong>Created:</strong> {formatDate(selectedCape?.creationDate || 0)}</p>
                        <p><strong>Creator:</strong> 
                            {#if loadingCreatorNames.get(selectedCape?._id || '')}
                                <span class="loading-creator">Loading name...</span>
                            {:else}
                                {creatorNames.get(selectedCape?._id || '') || selectedCape?.firstSeen || 'Unknown'}
                            {/if}
                        </p>
                        <p><strong>Uses:</strong> {selectedCape?.uses || 0}</p>
                        <p><strong>Has Elytra:</strong> {selectedCape?.elytra ? 'Yes' : 'No'}</p>
                        <p><strong>Status:</strong> {selectedCape?.accepted ? 'Accepted' : 'Pending'}</p>
                        {#if selectedCape && !selectedCape.accepted}
                            <p><strong>Moderator Message:</strong> {selectedCape.moderatorMessage || 'No message'}</p>
                        {/if}
                    </div>
                </div>
                <div class="cape-actions">
                    
                    <button onclick={() => selectedCape = null} class="close-button">
                        Close Details
                    </button>
                    
                    
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .cape-browser {
        padding: 15px;
        border: 1px solid #ddd;
        border-radius: 5px;
        margin-bottom: 20px;
    }

    h3 {
        margin-top: 0;
        margin-bottom: 15px;
    }

    h4 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 1em;
    }

    .filter-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-bottom: 20px;
        padding: 15px;
        background-color: #f5f5f5;
        border-radius: 5px;
    }

    .filter-section {
        flex: 1;
        min-width: 200px;
    }

    .sort-options {
        display: flex;
        gap: 10px;
    }

    .sort-options button {
        padding: 8px 12px;
        background-color: #f0f0f0;
        color: #333;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
    }

    .sort-options button.active {
        background-color: #4a90e2;
        color: white;
        border-color: #357abd;
    }

    .filter-options {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        align-items: center;
    }

    .filter-options label {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .filter-options select {
        padding: 6px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .reset-button {
        padding: 6px 12px;
        background-color: #e74c3c;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .reset-button:hover {
        background-color: #c0392b;
    }

    .capes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }

    .cape-item {
        border: 2px solid #ddd;
        border-radius: 5px;
        padding: 10px;
        cursor: pointer;
        transition: all 0.2s;
        background-color: #f9f9f9;
        position: relative;
    }

    .cape-item:hover {
        border-color: #4a90e2;
        transform: translateY(-2px);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }

    .cape-item.selected {
        border-color: #2ecc71;
        background-color: #e8f8f5;
    }

    .cape-preview {
        display: flex;
        justify-content: center;
        margin-bottom: 8px;
    }

    .cape-image {
        width: 100px;
        height: 100px;
        object-fit: contain;
        background-color: #e0e0e0;
    }

    .cape-info {
        text-align: center;
        margin-bottom: 25px; /* Add space below info for buttons */
    }

    .cape-creator {
        margin: 0 0 4px 0;
        font-weight: bold;
        font-size: 0.9em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cape-date, .cape-uses, .cape-elytra {
        margin: 0 0 4px 0;
        font-size: 0.8em;
        color: #666;
    }

    .creator-button {
        position: absolute;
        top: 5px;
        right: 5px;
        padding: 3px 8px;
        background-color: rgba(74, 144, 226, 0.8);
        color: white;
        border: none;
        border-radius: 3px;
        font-size: 0.8em;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .cape-item:hover .creator-button {
        opacity: 1;
    }

    .creator-button:hover {
        background-color: rgba(53, 122, 189, 1);
    }

    .equip-button-grid {
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        padding: 3px 10px;
        background-color: rgba(46, 204, 113, 0.8); /* Greenish */
        color: white;
        border: none;
        border-radius: 3px;
        font-size: 0.8em;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .cape-item:hover .equip-button-grid {
        opacity: 1;
    }

    .equip-button-grid:hover {
        background-color: rgba(39, 174, 96, 1);
    }

    .equip-button-grid:disabled {
        background-color: #ccc;
        cursor: not-allowed;
        opacity: 0.5; /* Make it visible but faded when disabled */
    }

    .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        margin-top: 20px;
    }

    .pagination button {
        padding: 6px 12px;
        background-color: #4a90e2;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .pagination button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    .page-info {
        margin: 0 10px;
    }

    .page-size-control {
        display: flex;
        justify-content: flex-end;
        margin-top: 15px;
    }

    .page-size-control select {
        margin-left: 10px;
        padding: 5px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .cape-details {
        margin-top: 30px;
        border-top: 1px solid #ddd;
        padding-top: 20px;
    }

    .cape-details-content {
        display: flex;
        gap: 20px;
        margin-top: 15px;
    }

    .cape-details-image {
        flex: 0 0 auto;
    }

    .cape-detail-image {
        width: 200px;
        height: 200px;
        object-fit: contain;
        background-color: #e0e0e0;
    }

    .cape-details-info {
        flex: 1;
    }

    .cape-details-info p {
        margin: 0 0 8px 0;
    }

    .close-button {
        margin-top: 15px;
        padding: 8px 16px;
        background-color: #e74c3c;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .close-button:hover {
        background-color: #c0392b;
    }

    .loading {
        color: #666;
        font-style: italic;
    }

    .error {
        color: #e74c3c;
        padding: 10px;
        background-color: #fbeae8;
        border: 1px solid #e74c3c;
        border-radius: 4px;
    }

    .note {
        color: #666;
        font-style: italic;
    }

    .cape-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 15px;
    }

    .equip-button {
        padding: 8px 16px;
        background-color: #4a90e2;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .equip-button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    .equip-error, .equip-success {
        margin-top: 10px;
        padding: 8px;
        background-color: #fbeae8;
        border: 1px solid #e74c3c;
        border-radius: 4px;
    }

    .loading-creator {
        color: #666;
        font-style: italic;
    }
</style>
