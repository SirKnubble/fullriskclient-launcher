"use client";

import { memo, useState } from "react";
import type { MinecraftSkin, SkinVariant } from "../../types/localSkin";
import { useThemeStore } from "../../store/useThemeStore";
import { useGlobalModal } from "../../hooks/useGlobalModal";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";
import { IconButton } from "../ui/buttons/IconButton";
import { Icon } from "@iconify/react";
import { Input } from "../ui/Input";
import { RadioButton } from "../ui/RadioButton";
import { toast } from "react-hot-toast";
import { open } from "@tauri-apps/plugin-dialog";
import { MinecraftSkinService } from "../../services/minecraft-skin-service";
import { SkinView3DWrapper } from "../common/SkinView3DWrapper";

interface AddSkinModalProps {
  skin?: MinecraftSkin;
  onSave: (skin: MinecraftSkin) => Promise<void>;
  onAdd: (
    skinInput: string,
    targetName: string,
    targetVariant: SkinVariant,
    description?: string | null,
  ) => Promise<void>;
  isLoading: boolean;
}

export const AddSkinModal = memo(
  ({ skin, onSave, onAdd, isLoading }: AddSkinModalProps) => {
    const [name, setName] = useState<string>(skin?.name ?? "");
    const [variant, setVariant] = useState<SkinVariant>(
      skin?.variant ?? "classic",
    );
    const [skinInput, setSkinInput] = useState<string>("");
    const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
    const [previewBase64Url, setPreviewBase64Url] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
    const accentColor = useThemeStore((state) => state.accentColor);
    const { hideModal } = useGlobalModal();

    const handleClose = () => {
      hideModal('add-skin-modal');
    };

    const handlePreview = async () => {
      const trimmedInput = skinInput.trim();
      if (!trimmedInput) {
        toast.error("Skin source (Username, UUID, URL, or File Path) cannot be empty.");
        return;
      }

      setIsPreviewLoading(true);

      try {
        // Create SkinSourceDetails based on input type (similar to addSkinLocally logic)
        let sourceDetails: any;

        // Regex patterns (should match the ones in minecraft-skin-service.ts)
        const MINECRAFT_USERNAME_REGEX = /^[a-zA-Z0-9_]{2,16}$/;
        const UUID_REGEX = /^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

        if (MINECRAFT_USERNAME_REGEX.test(trimmedInput)) {
          sourceDetails = { type: "Profile", details: { query: trimmedInput } };
        } else if (UUID_REGEX.test(trimmedInput)) {
          sourceDetails = { type: "Profile", details: { query: trimmedInput } };
        } else {
          let isHttpUrl = false;
          let isFileProtocolUrl = false;
          let pathFromUrlIfFileProtocol = "";

          try {
            const parsedUrl = new URL(trimmedInput);
            if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
              isHttpUrl = true;
            } else if (parsedUrl.protocol === "file:") {
              isFileProtocolUrl = true;
              let rawPath = decodeURIComponent(parsedUrl.pathname);
              // Normalize path: remove leading slash on Windows if it looks like /C:/path
              if (rawPath.length > 2 && rawPath.startsWith('/') && rawPath[2] === ':') {
                rawPath = rawPath.substring(1);
              }
              pathFromUrlIfFileProtocol = rawPath;
            }
          } catch (e) {
            // Not a parsable URL, will be treated as FilePath
          }

          if (isHttpUrl) {
            sourceDetails = { type: "Url", details: { url: trimmedInput } };
          } else if (isFileProtocolUrl) {
            sourceDetails = { type: "FilePath", details: { path: pathFromUrlIfFileProtocol } };
          } else {
            // Assume it's a direct file path
            sourceDetails = { type: "FilePath", details: { path: trimmedInput } };
          }
        }

        // Get base64 data from the source
        const base64Data = await MinecraftSkinService.getBase64FromSkinSource(sourceDetails);

        // Create data URL for the skin viewer
        const base64Url = `data:image/png;base64,${base64Data}`;

        setPreviewBase64Url(base64Url);
        setIsPreviewMode(true);
        toast.success("Skin preview loaded successfully!");

      } catch (error) {
        console.error("Error loading skin preview:", error);
        toast.error("Failed to load skin preview. Please check your input.");
      } finally {
        setIsPreviewLoading(false);
      }
    };

    const handleBackToEdit = () => {
      setIsPreviewMode(false);
      setPreviewBase64Url(null);
      setIsPreviewLoading(false);
    };

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

    const handleSave = async () => {
      if (skin) {
        await onSave({
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

        // Use the same name generation logic as in the original code
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

        await onAdd(trimmedInput, targetName, variant, null);
        toast.success("Skin saved successfully!");
      }
    };

    return (
      <Modal
        title={isPreviewMode ? "Skin Preview" : (skin ? "Edit Skin Properties" : "Add Skin")}
        onClose={handleClose}
        variant="flat"
        footer={
          <div className="flex gap-3 justify-center">
            {isPreviewMode ? (
              <>
                <Button
                  variant="flat"
                  onClick={handleSave}
                  disabled={isLoading}
                  size="sm"
                >
                  {isLoading ? "Saving..." : "Save Skin"}
                </Button>
                <Button
                  variant="flat-secondary"
                  onClick={handleBackToEdit}
                  disabled={isLoading}
                  size="sm"
                >
                  Back to Edit
                </Button>
              </>
            ) : (
              <>
                {!skin && (
                  <Button
                    variant="flat-secondary"
                    onClick={handlePreview}
                    disabled={isPreviewLoading}
                    size="sm"
                  >
                    {isPreviewLoading ? "Loading..." : "Preview Skin"}
                  </Button>
                )}
                {skin && (
                  <Button
                    variant="flat"
                    onClick={handleSave}
                    disabled={isLoading}
                    size="sm"
                  >
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                )}
                <Button
                  variant="flat-secondary"
                  onClick={handleClose}
                  disabled={isLoading || isPreviewLoading}
                  size="sm"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        }
      >
        {isPreviewMode ? (
          <div className="p-4">
            <div className="flex justify-center">
              <div className="w-64 h-80">
                <SkinView3DWrapper
                  skinUrl={previewBase64Url || undefined}
                  enableAutoRotate={true}
                  autoRotateSpeed={0.2}
                  zoom={0.9}
                />
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="font-minecraft text-2xl text-white/60 lowercase">
                Skin Variant: {variant === "classic" ? "Classic (Steve)" : "Slim (Alex)"}
              </p>
            </div>
          </div>
        ) : (
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
                  disabled={isLoading}
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
                    disabled={isLoading}
                    size="md"
                    variant="flat"
                    className="flex-grow"
                  />
                  <IconButton
                    onClick={handleOpenFileUpload}
                    title="Upload Skin from file"
                    disabled={isLoading}
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
                  disabled={isLoading}
                  label="Classic (Steve)"
                  size="md"
                  shadowDepth="none"
                />
                <RadioButton
                  name="editSkinVariant"
                  value="slim"
                  checked={variant === "slim"}
                  onChange={() => setVariant("slim")}
                  disabled={isLoading}
                  label="Slim (Alex)"
                  size="md"
                  shadowDepth="none"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    );
  },
);
