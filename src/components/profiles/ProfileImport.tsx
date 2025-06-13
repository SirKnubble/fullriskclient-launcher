"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";
import { StatusMessage } from "../ui/StatusMessage";
import { useThemeStore } from "../../store/useThemeStore";
import { Card } from "../ui/Card";
import { toast } from "react-hot-toast";
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import * as ProfileService from "../../services/profile-service";
import { useProfileStore } from "../../store/profile-store";

interface ProfileImportProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export function ProfileImport({
  onClose,
  onImportComplete,
}: ProfileImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const accentColor = useThemeStore((state) => state.accentColor);
  const contentRef = useRef<HTMLDivElement>(null);
  const formatItemsRef = useRef<HTMLUListElement>(null);

  const handleImport = async () => {
    const operationId = `profile-import-dialog-${Date.now()}`;
    let loadingToastId: string | undefined = undefined; // To ensure it's only used if a file is selected

    try {
      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Modpack Files",
            extensions: ["noriskpack", "mrpack"],
          },
        ],
        title: "Select Modpack to Import",
      });

      if (selectedPath && typeof selectedPath === "string") {
        setIsImporting(true);
        onClose();

        loadingToastId = `loading-${operationId}`;
        const fileName = selectedPath.substring(selectedPath.lastIndexOf('/') + 1).substring(selectedPath.lastIndexOf('\\') + 1);
        toast.loading(`Importing profile from ${fileName}...`, { id: loadingToastId });

        await ProfileService.importProfileByPath(selectedPath);

        toast.success(`Profile from ${fileName} imported successfully! List will refresh.`, { 
          id: loadingToastId,
          duration: 4000, 
        });
        useProfileStore.getState().fetchProfiles();
        onImportComplete();

      } else {
        if (selectedPath === null) {
          console.log("Profile import dialog cancelled by user.");
          // No toast for cancellation is usually fine
        } else {
          console.warn("File selection dialog did not return a valid path or was an array:", selectedPath);
          toast.error("Could not get selected file path. Please try again.");
        }
      }
    } catch (err) {
      console.error("Failed to import profile:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (loadingToastId) {
        toast.error(`Failed to import profile: ${errorMessage}`, { id: loadingToastId });
      } else {
        toast.error(`Failed to import profile: ${errorMessage}`);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const renderFooter = () => (
    <div className="flex justify-end">
      <Button
        variant="default"
        onClick={handleImport}
        disabled={isImporting}
        icon={<Icon icon="solar:upload-bold" className="w-5 h-5 text-white" />}
        size="md"
      >
        {isImporting ? (
          <>
            <Icon
              icon="solar:refresh-bold"
              className="w-5 h-5 animate-spin text-white"
            />
            <span>importing...</span>
          </>
        ) : (
          "select file to import"
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      title="import profile"
      onClose={onClose}
      width="lg"
      footer={renderFooter()}
    >
      <div className="p-6" ref={contentRef}>
        {error && <StatusMessage type="error" message={error} />}
        {success && <StatusMessage type="success" message={success} />}

        <div className="space-y-6">
          <div>
            <h3 className="text-3xl font-minecraft text-white mb-5 lowercase select-none">
              import profile pack
            </h3>
            <p className="text-2xl text-white/70 mb-6 font-minecraft tracking-wide select-none">
              Import a .mrpack or .noriskpack file to create a new profile. This
              will open a file selection dialog.
            </p>
          </div>

          <Card className="p-5">
            <h3 className="text-2xl text-white font-minecraft mb-4 select-none lowercase">
              supported formats:
            </h3>
            <ul
              className="text-xl text-white/80 space-y-4 select-none font-minecraft"
              ref={formatItemsRef}
            >
              <li className="flex items-center">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center mr-4"
                  style={{
                    backgroundColor: `${accentColor.value}30`,
                    borderWidth: "2px",
                    borderStyle: "solid",
                    borderColor: `${accentColor.value}60`,
                  }}
                >
                  <Icon
                    icon="solar:file-bold"
                    className="w-5 h-5 text-blue-400"
                  />
                </div>
                <span>.mrpack (Modrinth)</span>
              </li>
              <li className="flex items-center">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center mr-4"
                  style={{
                    backgroundColor: `${accentColor.value}30`,
                    borderWidth: "2px",
                    borderStyle: "solid",
                    borderColor: `${accentColor.value}60`,
                  }}
                >
                  <Icon
                    icon="solar:file-bold"
                    className="w-5 h-5 text-green-400"
                  />
                </div>
                <span>.noriskpack (NoRisk Launcher)</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </Modal>
  );
}
