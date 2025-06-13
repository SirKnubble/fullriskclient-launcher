"use client";

import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinecraftProfile, TexturesData } from "../../types/minecraft";
import type {
  GetStarlightSkinRenderPayload,
  MinecraftSkin,
  SkinVariant,
} from "../../types/localSkin";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";
import { MinecraftSkinService } from "../../services/minecraft-skin-service";
import { Button } from "../ui/buttons/Button";
import { IconButton } from "../ui/buttons/IconButton";
import { Icon } from "@iconify/react";
import { StatusMessage } from "../ui/StatusMessage";
import { SkinViewer } from "../launcher/SkinViewer";
import { Modal } from "../ui/Modal";
import { useDebounce } from "../../hooks/useDebounce";
import { useThemeStore } from "../../store/useThemeStore";
import { useSkinStore } from "../../store/useSkinStore";
import { toast } from "react-hot-toast";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Input } from "../ui/Input";
import { RadioButton } from "../ui/RadioButton";
import { TabLayout } from "../ui/TabLayout";
import { cn } from "../../lib/utils";
import { Card } from "../ui/Card";

const SkinPreview = memo(
  ({
    skin,
    index,
    loading,
    localSkinsLoading,
    selectedLocalSkin,
    isApplied,
    onClick,
    onEditSkin,
    onDeleteSkin,
  }: {
    skin: MinecraftSkin;
    index: number;
    loading: boolean;
    localSkinsLoading: boolean;
    selectedLocalSkin: MinecraftSkin | null;
    isApplied?: boolean;
    onClick: (skin: MinecraftSkin) => void;
    onEditSkin?: (
      skin: MinecraftSkin,
      event: React.MouseEvent<HTMLButtonElement>,
    ) => void;
    onDeleteSkin?: (
      skinId: string,
      skinName: string,
      event: React.MouseEvent<HTMLButtonElement>,
    ) => void;
  }) => {
    const accentColor = useThemeStore((state) => state.accentColor);
    const isBackgroundAnimationEnabled = useThemeStore(
      (state) => state.isBackgroundAnimationEnabled,
    );
    const isSelected = selectedLocalSkin?.id === skin.id;
    const isDisabled = loading && isSelected;

    const [starlightRenderUrl, setStarlightRenderUrl] = useState<string | null>(
      null,
    );
    const [isRenderLoading, setIsRenderLoading] = useState<boolean>(true);
    const [canShowSpinner, setCanShowSpinner] = useState<boolean>(false);
    const spinnerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      let isMounted = true;
      setIsRenderLoading(true);
      setStarlightRenderUrl(null);
      setCanShowSpinner(false);

      if (spinnerTimeoutRef.current) {
        clearTimeout(spinnerTimeoutRef.current);
      }

      spinnerTimeoutRef.current = setTimeout(() => {
        if (isMounted && isRenderLoading) {
          setCanShowSpinner(true);
        }
      }, 500);

      const fetchRender = async () => {
        if (skin && skin.name) {
          try {
            const payload: GetStarlightSkinRenderPayload = {
              player_name: "skin",
              render_type: "default",
              render_view: "full",
              base64_skin_data: skin.base64_data,
            };
            const localPath =
              await MinecraftSkinService.getStarlightSkinRender(payload);
            if (isMounted) {
              if (localPath) {
                setStarlightRenderUrl(convertFileSrc(localPath));
              } else {
                console.warn(
                  `[SkinPreview] Starlight render returned empty path for ${skin.name}.`,
                );
                setStarlightRenderUrl("");
              }
              setIsRenderLoading(false);
              setCanShowSpinner(false);
              if (spinnerTimeoutRef.current)
                clearTimeout(spinnerTimeoutRef.current);
            }
          } catch (error) {
            console.error(
              `[SkinPreview] Failed to fetch Starlight skin render for ${skin.name}:`,
              error,
            );
            if (isMounted) {
              setStarlightRenderUrl("");
              setIsRenderLoading(false);
              setCanShowSpinner(false);
              if (spinnerTimeoutRef.current)
                clearTimeout(spinnerTimeoutRef.current);
            }
          }
        } else {
          if (isMounted) {
            console.warn(
              `[SkinPreview] No skin.name provided, cannot fetch Starlight render.`,
            );
            setStarlightRenderUrl("");
            setIsRenderLoading(false);
            setCanShowSpinner(false);
            if (spinnerTimeoutRef.current)
              clearTimeout(spinnerTimeoutRef.current);
          }
        }
      };

      fetchRender();

      return () => {
        isMounted = false;
        if (spinnerTimeoutRef.current) {
          clearTimeout(spinnerTimeoutRef.current);
        }
      };
    }, [skin?.name, skin?.base64_data, skin]);

    const animationStyle = isBackgroundAnimationEnabled
      ? { animationDelay: `${index * 0.075}s` }
      : {};
    const animationClasses = isBackgroundAnimationEnabled
      ? "animate-in fade-in duration-500 fill-mode-both"
      : "";

    return (
      <div key={skin.id} style={animationStyle} className={animationClasses}>
        <Card
          className={cn(
            "relative p-4 pt-1 pb-2 h-[380px] flex flex-col text-center group",
            "transition-all duration-300 ease-out hover:scale-105 hover:z-10",
            isDisabled ? "opacity-60 pointer-events-none" : "",
          )}
          variant={isSelected ? "flat" : "flat"}
          onClick={() =>
            !isDisabled && !isApplied && !isSelected && onClick(skin)
          }
        >
          <p
            className="font-minecraft text-white lowercase truncate text-3xl transition-transform duration-300 ease-out group-hover:scale-110"
            title={skin.name}
          >
            {skin.name}
          </p>

          <div className="h-64 flex relative pt-2 pb-2 flex-grow items-center justify-center transition-transform duration-300 ease-out group-hover:scale-105">
            {isRenderLoading && canShowSpinner ? (
              <div className="w-12 h-12 border-4 border-t-transparent border-[var(--accent)] rounded-full animate-spin"></div>
            ) : !isRenderLoading ? (
              <SkinViewer
                skinUrl={starlightRenderUrl || ""}
                width={130}
                height={260}
                className="mx-auto"
              />
            ) : null}
          </div>

          <div className="flex items-center justify-between mt-auto">
            <p className="text-white/60 font-minecraft lowercase text-2xl transition-transform duration-300 ease-out group-hover:scale-110">
              {skin.variant === "slim" ? "Slim" : "Classic"}
            </p>

            {isApplied && (
              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-minecraft flex items-center transition-transform duration-300 ease-out group-hover:scale-110">
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-1" />
                Applied
              </span>
            )}
          </div>

          {isDisabled && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20 transition-opacity duration-300 ease-in-out">
              <div className="w-20 h-20 border-4 border-t-transparent border-white rounded-full animate-spin mb-4 transition-all duration-300"></div>
              <span className="font-minecraft text-2xl text-white lowercase animate-pulse transition-all duration-300">
                Applying...
              </span>
            </div>
          )}

          <div className="absolute bottom-1.5 right-1.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out group-hover:scale-110">
            {onEditSkin && (
              <IconButton
                onClick={(event) => {
                  event.stopPropagation();
                  onEditSkin(skin, event);
                }}
                title="Edit skin properties"
                disabled={isDisabled}
                size="xs"
                variant="secondary"
                icon={<Icon icon="solar:pen-bold" className="w-4 h-4" />}
              />
            )}

            {onDeleteSkin && (
              <IconButton
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteSkin(skin.id, skin.name, event);
                }}
                title="Delete skin"
                disabled={isDisabled}
                size="xs"
                variant="destructive"
                icon={
                  <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                }
              />
            )}
          </div>
        </Card>
      </div>
    );
  },
);

const AddSkinCard = memo(
  ({ index, onClick }: { index: number; onClick: () => void }) => {
    const isBackgroundAnimationEnabled = useThemeStore(
      (state) => state.isBackgroundAnimationEnabled,
    );

    const animationStyle = isBackgroundAnimationEnabled
      ? { animationDelay: `${index * 0.075}s` }
      : {};
    const animationClasses = isBackgroundAnimationEnabled
      ? "animate-in fade-in duration-500 fill-mode-both"
      : "";

    return (
      <div
        key={`add-skin-${index}`}
        style={animationStyle}
        className={animationClasses}
      >
        <Card
          className="relative p-4 pt-1 pb-2 h-[380px] flex flex-col text-center group cursor-pointer border-dashed transition-all duration-300 ease-out hover:scale-105 hover:z-10"
          variant="flat"
          onClick={onClick}
        >
          <p className="font-minecraft text-white lowercase truncate text-3xl transition-transform duration-300 ease-out group-hover:scale-110">
            Add New Skin
          </p>

          <div className="h-64 flex relative pt-2 pb-2 flex-grow items-center justify-center transition-transform duration-300 ease-out group-hover:scale-105">
            <SkinViewer
              skinUrl="/skins/default_skin_full.png"
              width={130}
              height={260}
              className="mx-auto opacity-70 group-hover:opacity-100 transition-opacity"
            />
          </div>

          <p className="text-white/60 font-minecraft lowercase text-2xl mt-auto transition-transform duration-300 ease-out group-hover:scale-110">
            Upload or import a skin
          </p>
        </Card>
      </div>
    );
  },
);

const EditSkinModal = memo(
  ({
    skin,
    cancel,
    saveSkin,
    addSkin,
    localSkinsLoading,
  }: {
    skin?: MinecraftSkin;
    cancel: () => void;
    saveSkin: (skin: MinecraftSkin) => Promise<void>;
    addSkin: (
      skinInput: string,
      targetName: string,
      targetVariant: SkinVariant,
      description?: string | null,
    ) => Promise<void>;
    localSkinsLoading: boolean;
  }) => {
    const [name, setName] = useState<string>(skin?.name ?? "");
    const [variant, setVariant] = useState<SkinVariant>(
      skin?.variant ?? "classic",
    );
    const [skinInput, setSkinInput] = useState<string>("");
    const accentColor = useThemeStore((state) => state.accentColor);

    const handleOpenFileUpload = async () => {
      try {
        const selectedFile = await open({
          multiple: false,
          directory: false,
          filters: [
            {
              name: "Skin Image",
              extensions: ["png"],
            },
          ],
          title: "Select Skin File (.png)",
        });

        if (typeof selectedFile === "string") {
          setSkinInput(selectedFile);
          toast.success("File selected: " + selectedFile.split(/[\\/]/).pop());
        } else if (selectedFile === null) {
          console.log("User cancelled file selection.");
        }
      } catch (error) {
        console.error("Error opening file dialog:", error);
        toast.error(
          "Failed to open file dialog. Ensure Tauri dialog plugin is configured.",
        );
      }
    };

    const finishEditingSkin = async () => {
      if (skin) {
        await saveSkin({
          ...skin,
          name,
          variant,
        });
      } else {
        const trimmedInput = skinInput.trim();
        if (!trimmedInput) {
          toast.error(
            "Skin source (Username, UUID, URL, or File Path) cannot be empty.",
          );
          return;
        }

        let targetName = "";
        const looksLikeHttpUrl = /^(https?):\/\//i.test(trimmedInput);
        const isLikelyFilePath = (input: string): boolean => {
          if (input.startsWith("file://")) return true;
          const hasPathSeparators = /[\\/]/.test(input);
          const isHttp = /^(https?):\/\//i.test(input);
          return hasPathSeparators && !isHttp;
        };

        if (looksLikeHttpUrl) {
          try {
            const url = new URL(trimmedInput);
            const pathnameParts = url.pathname
              .split("/")
              .filter((part) => part.length > 0);
            targetName = pathnameParts.pop() || url.hostname || "Web_Skin";
            if (targetName.match(/\.(png|jpg|jpeg|gif)$/i)) {
              targetName = targetName.substring(0, targetName.lastIndexOf("."));
            }
          } catch (e) {
            targetName = "Invalid_Web_Skin_Url";
            console.error("Error parsing HTTP URL for name:", e);
          }
        } else if (isLikelyFilePath(trimmedInput)) {
          let pathForNameExtraction = trimmedInput;
          if (trimmedInput.startsWith("file://")) {
            try {
              const tempUrl = new URL(trimmedInput);
              pathForNameExtraction = decodeURIComponent(tempUrl.pathname);
            } catch (e) {
              console.error(
                "Error parsing file:// URL for name extraction:",
                e,
              );
            }
          }
          const pathParts = pathForNameExtraction.split(/[\\/]/);
          targetName = pathParts.pop() || "File_Skin";
          if (targetName.match(/\.(png|jpg|jpeg|gif)$/i)) {
            targetName = targetName.substring(0, targetName.lastIndexOf("."));
          }
        } else {
          targetName = trimmedInput;
        }

        if (!targetName.trim()) {
          targetName = "Unnamed_Skin";
          console.warn(
            "Derived target name was empty, falling back to Unnamed_Skin for input:",
            trimmedInput,
          );
        }

        await addSkin(trimmedInput, targetName, variant, null);
      }
    };

    return (
      <Modal
        title={`${skin ? "Edit Skin Properties" : "Add Skin"}`}
        onClose={cancel}
        variant="flat"
        footer={
          <div className="flex gap-3 justify-center">
            <Button
              variant="flat"
              onClick={finishEditingSkin}
              disabled={localSkinsLoading}
              size="sm"
            >
              {localSkinsLoading ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="flat-secondary"
              onClick={cancel}
              disabled={localSkinsLoading}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          {skin && (
            <div>
              <label className="block font-minecraft text-3xl text-white/80 lowercase mb-2">
                Skin Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter skin name"
                disabled={localSkinsLoading}
                size="md"
                variant="flat"
              />
            </div>
          )}

          {!skin && (
            <div className="space-y-2">
              <label className="block font-minecraft text-3xl text-white/80 lowercase">
                Skin
              </label>
              <div className="flex gap-2">
                <Input
                  id="skinInputField"
                  value={skinInput}
                  onChange={(e) => setSkinInput(e.target.value)}
                  placeholder="Copy by username, UUID or download from URL"
                  disabled={localSkinsLoading}
                  size="md"
                  variant="flat"
                  className="flex-grow"
                />
                <IconButton
                  onClick={handleOpenFileUpload}
                  title="Upload Skin from file"
                  disabled={localSkinsLoading}
                  size="md"
                  variant="flat-secondary"
                  icon={<Icon icon="solar:folder-bold" className="w-5 h-5" />}
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <p className="font-minecraft text-3xl text-white/80 lowercase mb-4">
              Skin Variant
            </p>
            <div className="flex flex-col space-y-3">
              <RadioButton
                name="editSkinVariant"
                value="classic"
                checked={variant === "classic"}
                onChange={() => setVariant("classic")}
                disabled={localSkinsLoading}
                label="Classic (Steve)"
                size="md"
                shadowDepth="none"
              />
              <RadioButton
                name="editSkinVariant"
                value="slim"
                checked={variant === "slim"}
                onChange={() => setVariant("slim")}
                disabled={localSkinsLoading}
                label="Slim (Alex)"
                size="md"
                shadowDepth="none"
              />
            </div>
          </div>
        </div>
      </Modal>
    );
  },
);

export function SkinsTab() {
  const {
    activeAccount,
    isLoading: accountLoading,
    error: accountError,
    initializeAccounts,
  } = useMinecraftAuthStore();
  const { selectedSkinId, setSelectedSkinId } = useSkinStore();
  const [skinData, setSkinData] = useState<MinecraftProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [localSkins, setLocalSkins] = useState<MinecraftSkin[]>([]);
  const [localSkinsLoading, setLocalSkinsLoading] = useState<boolean>(false);
  const [localSkinsError, setLocalSkinsError] = useState<string | null>(null);
  const [selectedLocalSkin, setSelectedLocalSkin] =
    useState<MinecraftSkin | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [isEditingSkin, setIsEditingSkin] = useState<boolean>(false);
  const [editingSkin, setEditingSkin] = useState<MinecraftSkin | null>(null);
  const [search, setSearch] = useState<string>("");
  const [currentSkinId, setCurrentSkinId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 250);
  const accentColor = useThemeStore((state) => state.accentColor);

  const filteredSkins = useMemo(() => {
    if (!debouncedSearch.trim()) return localSkins;
    return localSkins.filter((skin) =>
      skin.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
    );
  }, [localSkins, debouncedSearch]);

  const loadSkinData = useCallback(async () => {
    if (!activeAccount) return;

    setLoading(true);

    try {
      const data = await MinecraftSkinService.getUserSkinData(
        activeAccount.id,
        activeAccount.access_token,
      );
      setSkinData(data);

      if (data?.properties) {
        const texturesProp = data.properties.find(
          (prop: { name: string; value: string }) => prop.name === "textures",
        );

        if (texturesProp) {
          try {
            const decodedValue = atob(texturesProp.value);
            const texturesJson = JSON.parse(decodedValue) as TexturesData;
            const skinInfo = texturesJson.textures?.SKIN;

            if (skinInfo?.url) {
              const urlParts = skinInfo.url.split("/");
              const skinIdFromUrl = urlParts[urlParts.length - 1].split(".")[0];
              setCurrentSkinId(skinIdFromUrl);
            }
          } catch (e) {
            console.error("Error parsing skin textures:", e);
            toast.error("Failed to parse skin details.");
          }
        }
      }
    } catch (err) {
      console.error("Error loading skin data:", err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeAccount]);

  const loadLocalSkins = useCallback(async () => {
    setLocalSkinsLoading(true);
    setLocalSkinsError(null);

    try {
      const skins = await MinecraftSkinService.getAllSkins();

      setLocalSkins(skins);
      console.log(`Loaded ${skins.length} local skins`);

      if (selectedSkinId) {
        const selectedSkin = skins.find((skin) => skin.id === selectedSkinId);
        if (selectedSkin) {
          setSelectedLocalSkin(selectedSkin);
        }
      }
      setLocalSkinsLoading(false);
    } catch (err) {
      console.error("Error loading local skins:", err);
      setLocalSkinsError(err instanceof Error ? err.message : String(err));
      setLocalSkinsLoading(false);
    }
  }, [selectedSkinId]);

  useEffect(() => {
    if (activeAccount) {
      loadSkinData();
    }

    loadLocalSkins();

    if (!activeAccount && !accountLoading) {
      initializeAccounts();
    }
  }, [
    activeAccount,
    loadSkinData,
    loadLocalSkins,
    initializeAccounts,
    accountLoading,
  ]);

  const startEditSkin = (
    skin: MinecraftSkin | null,
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation();
    setEditingSkin(skin);
    setIsEditingSkin(true);
  };

  const cancelEditSkin = () => {
    setEditingSkin(null);
    setIsEditingSkin(false);
  };

  const saveSkin = async (skin: MinecraftSkin) => {
    if (!skin) return;
    setLocalSkinsLoading(true);

    try {
      const updatedSkin = await MinecraftSkinService.updateSkinProperties(
        skin.id,
        skin.name,
        skin.variant,
      );

      if (updatedSkin) {
        toast.success(`Successfully updated skin: ${updatedSkin.name}`);
        setLocalSkins((prevSkins) =>
          prevSkins.map((s) => (s.id === updatedSkin.id ? updatedSkin : s)),
        );
        if (selectedLocalSkin?.id === updatedSkin.id) {
          setSelectedLocalSkin(updatedSkin);
        }
        setIsEditingSkin(false);
        setEditingSkin(null);
      } else {
        setLocalSkinsError("Skin not found. It may have been deleted.");
        setEditingSkin(null);
        setIsEditingSkin(false);
      }
    } catch (err) {
      console.error("Error updating skin properties:", err);
      setLocalSkinsError(err instanceof Error ? err.message : String(err));
    } finally {
      setLocalSkinsLoading(false);
    }
  };

  const addSkin = async (
    skinInput: string,
    targetName: string,
    targetVariant: SkinVariant,
    description?: string | null,
  ) => {
    setModalLoading(true);
    try {
      const newSkin = await MinecraftSkinService.addSkinLocally(
        skinInput,
        targetName,
        targetVariant,
        description,
      );
      toast.success(`Successfully added skin: ${newSkin.name}`);
      setLocalSkins((prevSkins) =>
        [...prevSkins, newSkin].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setIsEditingSkin(false);
      setEditingSkin(null);
    } catch (err) {
      console.error("Error adding new skin:", err);
      const errorMessage =
        err instanceof Error ? err.message : String(err.message);
      toast.error(`Failed to add skin: ${errorMessage}`);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteSkin = async (skinId: string, skinName: string) => {
    const deletePromise = async () => {
      const removed = await MinecraftSkinService.removeSkin(skinId);
      if (!removed) {
        throw new Error(
          `Skin "${skinName}" could not be found or was already deleted.`,
        );
      }
      return removed;
    };

    toast.promise(
      deletePromise(),
      {
        loading: `Deleting skin "${skinName}"...`,
        success: () => {
          setLocalSkins((prevSkins) =>
            prevSkins.filter((s) => s.id !== skinId),
          );
          if (selectedLocalSkin?.id === skinId) {
            setSelectedLocalSkin(null);
            setSelectedSkinId(null);
          }
          return `Successfully deleted skin: ${skinName}`;
        },
        error: (err) => {
          console.error("Error deleting skin:", err);
          return err instanceof Error ? err.message : String(err.message);
        },
      },
      {
        success: { duration: 4000 },
        error: { duration: 5000 },
      },
    );
  };

  const applyLocalSkin = async (skin: MinecraftSkin) => {
    if (!activeAccount) {
      toast.error("You must be logged in to apply a skin");
      return;
    }

    if (isSkinApplied(skin)) {
      toast.error(`Skin "${skin.name}" is already applied to your account`);
      return;
    }

    setLoading(true);
    setSelectedLocalSkin(skin);

    try {
      await MinecraftSkinService.applySkinFromBase64(
        activeAccount.id,
        activeAccount.access_token,
        skin.base64_data,
        skin.variant,
      );

      toast.success(
        `Successfully applied skin: ${skin.name} (${skin.variant} model)`,
      );
      await loadSkinData();
    } catch (err) {
      console.error("Error applying local skin:", err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const isSkinApplied = (skin: MinecraftSkin): boolean => {
    if (!currentSkinId) return false;
    return skin.id === currentSkinId;
  };

  // Add skin button for the TabLayout
  const addSkinButton = (
    <Button
      onClick={() => startEditSkin(null)}
      variant="flat"
      size="md"
      className="h-[42px]"
      icon={<Icon icon="solar:add-circle-bold" className="w-5 h-5" />}
      iconPosition="left"
      disabled={!activeAccount}
    >
      ADD SKIN
    </Button>
  );

  return (
    <TabLayout
      title="Skins"
      icon="solar:user-id-bold"
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search skins...",
      }}
      actions={addSkinButton}
    >
      <div className="space-y-8">
        {accountLoading ? (
          <p className="text-white/70 font-minecraft text-xl text-center py-4">
            Loading account...
          </p>
        ) : accountError ? (
          <StatusMessage
            type="error"
            className="font-minecraft text-lg"
            message={`Account Error: ${accountError}`}
          />
        ) : !activeAccount ? (
          <p className="text-white/70 italic font-minecraft text-xl text-center py-10">
            Please log in to a Minecraft account to manage skins.
          </p>
        ) : (
          <>
            <div className="space-y-5 text-center">
              {localSkinsLoading && !editingSkin ? (
                <p className="text-white/70 font-minecraft text-xl text-center py-4">
                  Loading skins...
                </p>
              ) : localSkinsError && !editingSkin ? (
                <StatusMessage
                  type="error"
                  className="font-minecraft text-lg"
                  message={localSkinsError}
                />
              ) : !localSkinsLoading &&
                localSkins.length === 0 &&
                !localSkinsError &&
                !editingSkin ? (
                <p className="text-white/70 italic font-minecraft text-lg">
                  No local skins found. Upload skins to add them to your
                  library.
                </p>
              ) : !localSkinsLoading &&
                localSkins.length > 0 &&
                filteredSkins.length === 0 &&
                !localSkinsError &&
                !editingSkin ? (
                <p className="text-white/70 italic font-minecraft text-lg">
                  No skins match your search. Try a different search term.
                </p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                  <AddSkinCard
                    index={0}
                    onClick={() => startEditSkin(null, undefined)}
                  />
                  {filteredSkins.map((skin, index) => (
                    <SkinPreview
                      key={skin.id}
                      skin={skin}
                      index={index + 1}
                      loading={loading}
                      localSkinsLoading={localSkinsLoading}
                      selectedLocalSkin={selectedLocalSkin}
                      isApplied={isSkinApplied(skin)}
                      onClick={applyLocalSkin}
                      onEditSkin={startEditSkin}
                      onDeleteSkin={handleDeleteSkin}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isEditingSkin && (
        <EditSkinModal
          skin={editingSkin}
          cancel={cancelEditSkin}
          saveSkin={saveSkin}
          addSkin={addSkin}
          localSkinsLoading={modalLoading}
        />
      )}
    </TabLayout>
  );
}
