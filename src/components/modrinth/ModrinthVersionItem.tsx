"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import type { ModrinthFile, ModrinthVersion } from "../../types/modrinth";
import { formatFileSize } from "../../utils/format-file-size";
import { cn } from "../../lib/utils";
import { Button } from "../ui/buttons/Button";
import { useThemeStore } from "../../store/useThemeStore";

interface ModrinthVersionItemProps {
  version: ModrinthVersion;
  file: ModrinthFile;
  installState: "idle" | "installing" | "adding" | "success" | "error";
  onInstall: () => void;
  isModpack?: boolean;
}

export function ModrinthVersionItem({
  version,
  file,
  installState,
  onInstall,
  isModpack = false,
}: ModrinthVersionItemProps) {
  const isInstalling =
    installState === "installing" || installState === "adding";
  const isInstalled = installState === "success";
  const hasError = installState === "error";
  const accentColor = useThemeStore((state) => state.accentColor);

  const [progressWidth, setProgressWidth] = useState(0);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isInstalling) {
      setProgressWidth(0);
      interval = setInterval(() => {
        setProgressWidth((prev) => {
          const increment = prev < 30 ? 5 : prev < 60 ? 3 : prev < 80 ? 1 : 0.5;
          return Math.min(prev + increment, 90);
        });
      }, 100);
    } else if (isInstalled) {
      setProgressWidth(100);
      setShowSuccessAnimation(true);
      const timer = setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setProgressWidth(0);
      setShowSuccessAnimation(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInstalling, isInstalled]);

  const formattedSize = formatFileSize(file.size);

  const gameVersions = version.game_versions?.join(", ") || "Unknown";
  const loaders = version.loaders?.join(", ") || "Any";

  return (
    <div
      className="version-item backdrop-blur-md p-3 flex flex-col relative overflow-hidden rounded-lg border-2 border-b-4 shadow-md"
      style={{
        backgroundColor: `${accentColor.value}15`,
        borderColor: `${accentColor.value}40`,
        borderBottomColor: `${accentColor.value}60`,
      }}
    >
      {(isInstalling || isInstalled) && (
        <div className="absolute bottom-0 left-0 h-1 bg-blue-500/20 w-full">
          <div
            className={cn(
              "h-full transition-all duration-300 ease-out",
              isInstalled ? "bg-green-500" : `bg-[${accentColor.value}]`,
              showSuccessAnimation && "animate-pulse",
            )}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      )}

      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <h4 className="text-white font-minecraft text-2xl tracking-wide lowercase select-none">
            {version.name || version.version_number}
          </h4>
          <div className="text-white/70 text-lg font-minecraft-ten tracking-wide lowercase select-none mt-1">
            <span className="mr-3">
              <Icon
                icon="pixel:calendar-alt-solid"
                className="inline-block mr-1 w-4 h-4"
              />
              {new Date(version.date_published).toLocaleDateString()}
            </span>
            <span className="mr-3">
              <Icon
                icon="pixel:cube-solid"
                className="inline-block mr-1 w-4 h-4"
              />
              {gameVersions}
            </span>
            {version.loaders && version.loaders.length > 0 && (
              <span>
                <Icon
                  icon="pixel:cogs-solid"
                  className="inline-block mr-1 w-4 h-4"
                />
                {loaders}
              </span>
            )}
          </div>
          <div className="text-white/50 text-lg font-minecraft-ten mt-2 tracking-wide lowercase select-none">
            <span className="mr-3">
              <Icon
                icon="pixel:file-alt-solid"
                className="inline-block mr-1 w-4 h-4"
              />
              {file.filename}
            </span>
            <span>
              <Icon
                icon="pixel:hdd-solid"
                className="inline-block mr-1 w-4 h-4"
              />
              {formattedSize}
            </span>
          </div>
        </div>
        <Button
          onClick={onInstall}
          disabled={isInstalling || isInstalled}
          size="sm"
          className="min-w-0 self-center"
          variant={
            isInstalled
              ? "success"
              : isInstalling
                ? "info"
                : hasError
                  ? "destructive"
                  : "default"
          }
          icon={
            isInstalling ? (
              <Icon
                icon="pixel:circle-notch-solid"
                className="animate-spin w-5 h-5"
              />
            ) : isInstalled ? (
              <Icon icon="pixel:check" className="w-5 h-5" />
            ) : hasError ? (
              <Icon
                icon="pixel:exclamation-triangle-solid"
                className="w-5 h-5"
              />
            ) : (
              <Icon
                icon={
                  isModpack ? "pixel:folder-plus-solid" : "pixel:download-solid"
                }
                className="w-5 h-5"
              />
            )
          }
        >
          {isInstalling
            ? isModpack
              ? "Creating Profile..."
              : "Installing..."
            : isInstalled
              ? isModpack
                ? "Profile Created"
                : "Installed"
              : hasError
                ? "Retry"
                : isModpack
                  ? "Create Profile"
                  : "Install"}
        </Button>
      </div>
    </div>
  );
}
