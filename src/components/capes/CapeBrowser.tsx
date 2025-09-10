"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  browseCapes,
  deleteCape,
  downloadTemplateAndOpenExplorer,
  equipCape,
  getPlayerCapes,
  unequipCape,
  uploadCape,
} from "../../services/cape-service";
import type {
  BrowseCapesOptions,
  CosmeticCape,
  GetPlayerCapesPayloadOptions,
  PaginationInfo,
} from "../../types/noriskCapes";
import { CapeList } from "./CapeList";
import type { CapeFiltersData } from "./CapeFilters";
import { Icon } from "@iconify/react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Modal } from "../ui/Modal";
import { SkinView3DWrapper } from "../common/SkinView3DWrapper";
import { Button } from "../ui/buttons/Button";
import { IconButton } from "../ui/buttons/IconButton";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";
import { SearchWithFilters } from "../ui/SearchWithFilters";
import { useThemeStore } from "../../store/useThemeStore";
import { preloadIcons } from "../../lib/icon-utils";

export function CapeBrowser() {
  const [capesData, setCapesData] = useState<CosmeticCape[]>([]);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isEquippingCapeId, setIsEquippingCapeId] = useState<string | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isUnequipping, setIsUnequipping] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [filters, setFilters] = useState<CapeFiltersData>({
    sortBy: "",
    timeFrame: "",
    showOwnedOnly: false,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");

  const accentColor = useThemeStore((state) => state.accentColor);

  // Filter options for SearchWithFilters
  const sortOptions = [
    { value: "", label: "Newest", icon: "solar:sort-by-time-linear" },
    { value: "oldest", label: "Oldest", icon: "mdi:arrow-up-bold-circle-outline" },
    { value: "mostUsed", label: "Most Used", icon: "solar:heart-bold" },
  ];

  const filterOptions = [
    { value: "", label: "All Time", icon: "solar:calendar-mark-linear" },
    { value: "weekly", label: "Weekly", icon: "mdi:calendar-week-outline" },
    { value: "monthly", label: "Monthly", icon: "solar:calendar-date-linear" },
  ];

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImagePath, setPreviewImagePath] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showElytraPreview, setShowElytraPreview] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  // Helper function to format error messages
  const formatErrorMessage = (error: string): string => {
    const detailsIndex = error.indexOf("Details:");
    if (detailsIndex !== -1) {
      return error.substring(detailsIndex + 8).trim(); // +8 to skip "Details:"
    }
    return error; // Fallback to original error if "Details:" not found
  };

  // Helper function to determine if error is a warning (contains "In Review")
  const isWarningMessage = (error: string): boolean => {
    return error.toLowerCase().includes("in review");
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [capeToDelete, setCapeToDelete] = useState<CosmeticCape | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { activeAccount } = useMinecraftAuthStore();

  useEffect(() => {
    preloadIcons(["solar:add-square-bold-duotone"]);
  }, []);

  const hasMoreItems = paginationInfo
    ? paginationInfo.currentPage < paginationInfo.totalPages - 1
    : false;

  const fetchCapesData = useCallback(
    async (
      pageToFetch: number,
      currentFilters: CapeFiltersData,
      currentSearchQuery: string,
      append = false,
    ) => {
      console.log("[CapeBrowser] fetchCapesData called with:", {
        pageToFetch,
        currentFilters,
        currentSearchQuery,
        append,
      });
      if (append) {
        setIsFetchingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        let response;
        if (currentFilters.showOwnedOnly && activeAccount) {
          console.log(
            "[CapeBrowser] Fetching capes for active account:",
            activeAccount.username,
          );
          const playerCapesOptions: GetPlayerCapesPayloadOptions = {
            player_identifier: activeAccount.id,
          };
          response = await getPlayerCapes(playerCapesOptions);
          setCapesData(response);
          setPaginationInfo({
            currentPage: 0,
            pageSize: response.length,
            totalItems: response.length,
            totalPages: 1,
          });
        } else if (currentSearchQuery && currentSearchQuery.trim() !== "") {
          const playerCapesOptions: GetPlayerCapesPayloadOptions = {
            player_identifier: currentSearchQuery.trim(),
          };
          response = await getPlayerCapes(playerCapesOptions);
          setCapesData(response);
          setPaginationInfo({
            currentPage: 0,
            pageSize: response.length,
            totalItems: response.length,
            totalPages: 1,
          });
        } else {
          const browseOptions: BrowseCapesOptions = {
            page: pageToFetch,
            page_size: 20,
            sort_by:
              currentFilters.sortBy === "" ? undefined : currentFilters.sortBy,
            time_frame:
              currentFilters.timeFrame === ""
                ? undefined
                : currentFilters.timeFrame,
          };
          response = await browseCapes(browseOptions);
          setCapesData((prevActualCapes) =>
            append ? [...prevActualCapes, ...response.capes] : response.capes,
          );
          setPaginationInfo(response.pagination);
        }
      } catch (err: any) {
        console.error("Error fetching capes:", err);
        const errorMessage =
          err?.message || "Failed to load capes. Please try again later.";
        toast.error(errorMessage);
        if (!append) {
          setCapesData([]);
        }
      } finally {
        if (append) {
          setIsFetchingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [activeAccount],
  );

  useEffect(() => {
    console.log(
      "[CapeBrowser] Filter/Search useEffect. CurrentPage will be reset to 0 by handlers.",
    );
    if (currentPage === 0) {
      fetchCapesData(0, filters, searchQuery, false);
    }
  }, [filters, searchQuery, fetchCapesData]);

  useEffect(() => {
    if (currentPage > 0) {
      console.log(
        `[CapeBrowser] CurrentPage changed to ${currentPage}, fetching more items.`,
      );
      fetchCapesData(currentPage, filters, searchQuery, true);
    }
  }, [currentPage, fetchCapesData]);

  const loadMoreCapes = useCallback(() => {
    if (hasMoreItems && !isFetchingMore) {
      console.log(
        "[CapeBrowser] loadMoreCapes called. Current page:",
        currentPage,
        "Pagination:",
        paginationInfo,
      );
      setCurrentPage((prevPage) => prevPage + 1);
    }
  }, [hasMoreItems, isFetchingMore, paginationInfo, currentPage]);

  const handleSortChange = (value: string) => {
    const newFilters = { ...filters, sortBy: value || undefined };
    const hasMajorFilterChanged = newFilters.sortBy !== filters.sortBy;

    setFilters(newFilters);
    if (hasMajorFilterChanged) {
      setSearchQuery("");
      setCurrentPage(0);
    } else if (currentPage !== 0) {
      setCurrentPage(0);
    }
  };

  const handleFilterChange = (value: string) => {
    const newFilters = { ...filters, timeFrame: value || undefined };
    const hasMajorFilterChanged = newFilters.timeFrame !== filters.timeFrame;

    setFilters(newFilters);
    if (hasMajorFilterChanged) {
      setSearchQuery("");
      setCurrentPage(0);
    } else if (currentPage !== 0) {
      setCurrentPage(0);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
  };


  const refreshCurrentView = () => {
    console.log("[CapeBrowser] Refreshing current view...");
    if (currentPage === 0) {
      fetchCapesData(0, filters, searchQuery, false);
    } else {
      setCurrentPage(0);
    }
  };

  const handleEquipCape = async (capeHash: string) => {
    setIsEquippingCapeId(capeHash);
    const promise = equipCape(capeHash);
    toast.promise(promise, {
      loading: "Equipping cape...",
      success: () => {
        setIsEquippingCapeId(null);
        return "Cape equipped successfully!";
      },
      error: (err: any) => {
        setIsEquippingCapeId(null);
        console.error("Error equipping cape:", err);
        return `Failed to equip cape: ${err.message || "Unknown error"}`;
      },
    });
  };

  const handleUnequipCape = async () => {
    setIsUnequipping(true);
    try {
      await unequipCape();
      toast.success("Cape unequipped successfully!");
    } catch (err: any) {
      console.error("Error unequipping cape:", err);
      toast.error(`Failed to unequip cape: ${err.message || "Unknown error"}`);
    } finally {
      setIsUnequipping(false);
    }
  };

  const handleDeleteCapeClick = (cape: CosmeticCape) => {
    setCapeToDelete(cape);
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setCapeToDelete(null);
    setShowDeleteModal(false);
  };

  const handleConfirmDelete = async () => {
    if (!capeToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCape(capeToDelete._id);
      toast.success("Cape deleted successfully!");
      refreshCurrentView();
      setShowDeleteModal(false);
      setCapeToDelete(null);
    } catch (err: any) {
      console.error("Error deleting cape:", err);
      toast.error(`Failed to delete cape: ${err.message || "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadClick = async () => {
    try {
      const selectedFile = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "PNG Images", extensions: ["png"] }],
      });
      if (!selectedFile) return;
      const filePath = selectedFile as string;
      setPreviewImagePath(filePath);
      try {
        const imageUrl = convertFileSrc(filePath);
        setPreviewImageUrl(imageUrl);
        setShowPreviewModal(true);
      } catch (err: any) {
        console.error("Error creating preview URL:", err);
        toast.error(`Couldn't preview file: ${err.message || "Unknown error"}`);
        handleConfirmUpload(filePath);
      }
    } catch (err: any) {
      console.error("Error selecting cape file:", err);
      toast.error(
        `Failed to select cape file: ${err.message || "Unknown error"}`,
      );
    }
  };

  const handleCancelUpload = () => {
    setPreviewImagePath(null);
    setPreviewImageUrl(null);
    setShowPreviewModal(false);
    setShowElytraPreview(false);
    setUploadError(null);
    setUploadWarning(null);
  };

  const handleConfirmUpload = async (filePath?: string) => {
    const path = filePath || previewImagePath;
    if (!path) return;
    setIsUploading(true);
    setUploadError(null); // Reset error before upload
    setUploadWarning(null); // Reset warning before upload
    try {
      await uploadCape(path);
      toast.success("Cape uploaded successfully!");
      refreshCurrentView();
      setShowPreviewModal(false);
      setPreviewImagePath(null);
      setPreviewImageUrl(null);
      setShowElytraPreview(false);
    } catch (err: any) {
      console.error("Error uploading cape:", err);
      const formattedError = formatErrorMessage(err.message || "Unknown error");

      if (isWarningMessage(formattedError)) {
        setUploadWarning(formattedError);
        setUploadError(null);
      } else {
        setUploadError(formattedError);
        setUploadWarning(null);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const promise = downloadTemplateAndOpenExplorer();
    toast.promise(promise, {
      loading: "Downloading template...",
      success: "Template downloaded and folder opened!",
      error: (err: any) =>
        `Failed to download template: ${err.message || "Unknown error"}`,
    });
  };

  const capesForList = useMemo(() => {
    return [...capesData];
  }, [capesData]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 relative">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Group Tabs */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const newFilters = { ...filters, showOwnedOnly: false };
                setFilters(newFilters);
                setSearchQuery("");
                setCurrentPage(0);
              }}
              className={`px-3 py-1 rounded-lg font-minecraft text-2xl transition-all duration-200 flex items-center gap-2 border-2 ${
                !filters.showOwnedOnly
                  ? 'text-white'
                  : 'text-white/70 bg-black/30 hover:bg-black/40 border-white/10 hover:border-white/20'
              }`}
              style={{
                backgroundColor: !filters.showOwnedOnly ? `${accentColor.value}20` : undefined,
                borderColor: !filters.showOwnedOnly ? accentColor.value : undefined,
              }}
            >
              <span className="lowercase">all</span>
            </button>

            <button
              onClick={() => {
                if (!activeAccount) return;
                const newFilters = { ...filters, showOwnedOnly: true };
                setFilters(newFilters);
                setSearchQuery("");
                setCurrentPage(0);
              }}
              disabled={!activeAccount}
              className={`px-3 py-1 rounded-lg font-minecraft text-2xl transition-all duration-200 flex items-center gap-2 border-2 ${
                filters.showOwnedOnly
                  ? 'text-white'
                  : 'text-white/70 bg-black/30 hover:bg-black/40 border-white/10 hover:border-white/20'
              } ${!activeAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                backgroundColor: filters.showOwnedOnly ? `${accentColor.value}20` : undefined,
                borderColor: filters.showOwnedOnly ? accentColor.value : undefined,
              }}
              title={!activeAccount ? "No active Minecraft account" : undefined}
            >
              <Icon icon="solar:user-id-broken" className="w-4 h-4" />
              <span className="lowercase">my capes</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <SearchWithFilters
                placeholder="Search player..."
                searchValue={searchQuery}
                onSearchChange={handleSearchChange}
                sortOptions={sortOptions}
                sortValue={filters.sortBy || ""}
                onSortChange={handleSortChange}
                filterOptions={filterOptions}
                filterValue={filters.timeFrame || ""}
                onFilterChange={handleFilterChange}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {activeAccount && (
                <>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-black/30 hover:bg-black/40 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-lg font-minecraft text-2xl lowercase transition-all duration-200"
                    title="Download Cape Template"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <Icon icon="solar:download-bold" className="w-4 h-4" />
                    </div>
                    <span>template</span>
                  </button>

                  <button
                    onClick={handleUploadClick}
                    className="flex items-center gap-2 px-4 py-2 bg-black/30 hover:bg-black/40 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-lg font-minecraft text-2xl lowercase transition-all duration-200"
                    title="Upload Cape"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <Icon icon="solar:upload-bold" className="w-4 h-4" />
                    </div>
                    <span>upload</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cape List */}
        <CapeList
          capes={capesForList}
          onEquipCape={handleEquipCape}
          isLoading={isLoading}
          isEquippingCapeId={isEquippingCapeId}
          searchQuery={searchQuery}
          canDelete={filters.showOwnedOnly && !!activeAccount}
          onDeleteCape={handleDeleteCapeClick}
          loadMoreItems={loadMoreCapes}
          hasMoreItems={hasMoreItems}
          isFetchingMore={isFetchingMore}
          onTriggerUpload={activeAccount ? handleUploadClick : undefined}
          onDownloadTemplate={activeAccount ? handleDownloadTemplate : undefined}
          groupFavoritesInHeader={!filters.showOwnedOnly}
        />
      </div>

      {previewImageUrl && previewImagePath && showPreviewModal && (
        <Modal
          title="Preview & Upload Cape"
          onClose={handleCancelUpload}
          closeOnClickOutside={true}
          width="md"
          variant="flat"
        >
          <div className="p-4">
            <p className="text-white/80 mb-4 text-center font-minecraft-ten">
              {uploadError ? "Failed to upload Cape" : uploadWarning ? "Cape submitted for review" : "Does this look correct? If so, hit upload!"}
            </p>
            {uploadError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-md">
                <p className="text-red-400 text-sm font-minecraft-ten text-center">
                  {uploadError}
                </p>
              </div>
            )}
            {uploadWarning && (
              <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded-md">
                <p className="text-yellow-400 text-sm font-minecraft-ten text-center">
                  {uploadWarning}
                </p>
                <p className="text-yellow-300/70 text-xs font-minecraft-ten text-center mt-2">
                  Reviews can take up to 24 hours
                </p>
              </div>
            )}
            <div className="relative flex justify-center items-center mb-6 p-2 rounded-md aspect-[10/16] max-w-[200px] mx-auto">
              <SkinView3DWrapper
                capeUrl={previewImageUrl}
                className="w-full h-full"
                zoom={1.5}
                displayAsElytra={showElytraPreview}
              />
              <IconButton
                onClick={() => setShowElytraPreview(!showElytraPreview)}
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10"
                icon={
                  <Icon
                    icon={
                      showElytraPreview
                        ? "ph:airplane-tilt-fill"
                        : "ph:airplane-tilt-duotone"
                    }
                    className="w-5 h-5"
                  />
                }
                title={showElytraPreview ? "Show as Cape" : "Show as Elytra"}
              />
            </div>
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => handleConfirmUpload()}
                variant="flat"
                disabled={isUploading || !!uploadError || !!uploadWarning}
                size="lg"
              >
                {isUploading ? "Uploading..." : "Upload Cape"}
              </Button>
              <Button
                onClick={handleCancelUpload}
                variant="flat-secondary"
                disabled={isUploading}
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteModal && capeToDelete && (
        <Modal
          title="Confirm Deletion"
          onClose={handleCancelDelete}
          width="sm"
          variant="flat"
        >
          <div className="p-4">
            <p className="text-white/90 mb-6 text-center font-minecraft-ten">
              Are you sure you want to delete the cape{" "}
              <span style={{ color: "var(--accent)" }}>{capeToDelete._id}</span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                onClick={handleConfirmDelete}
                variant="destructive"
                disabled={isDeleting}
                size="md"
              >
                {isDeleting ? "Deleting..." : "Delete Cape"}
              </Button>
              <Button
                onClick={handleCancelDelete}
                variant="flat-secondary"
                disabled={isDeleting}
                size="md"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
