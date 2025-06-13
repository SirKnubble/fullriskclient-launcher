"use client";

import type React from "react";
import { useState } from "react";
import { Icon } from "@iconify/react";
import type { ModrinthSearchHit } from "../../types/modrinth";
import type { ContentInstallStatus } from "../../types/profile";
import { Button } from "../ui/buttons/Button";
import { IconButton } from "../ui/buttons/IconButton";
import { Label } from "../ui/Label";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";

interface ModrinthProjectCardProps {
  project: ModrinthSearchHit;
  isExpanded?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  onToggleExpand?: () => void;
  children?: React.ReactNode;
  installStatus?: ContentInstallStatus | "loading" | "error" | null;
  onInstall?: (project: ModrinthSearchHit) => void;
  onInstallModpack?: (project: ModrinthSearchHit) => void;
}

export function ModrinthProjectCard({
  project,
  isExpanded = false,
  isLoading = false,
  onClick,
  onToggleExpand,
  children,
  installStatus,
  onInstall,
  onInstallModpack,
}: ModrinthProjectCardProps) {
  const [imageError, setImageError] = useState(false);
  const accentColor = useThemeStore((state) => state.accentColor);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand();
    }
  };

  const handleInstall = () => {
    if (project.project_type === "modpack") {
      onInstallModpack?.(project);
    } else {
      onInstall?.(project);
    }
  };

  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case "mod":
        return "pixel:bolt-solid";
      case "modpack":
        return "pixel:folder-open-solid";
      case "resourcepack":
        return "pixel:image-solid";
      case "shader":
        return "pixel:sun-solid";
      case "datapack":
        return "pixel:cube-solid";
      default:
        return "pixel:grid-solid";
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-200 hover:bg-white/5 cursor-pointer rounded-lg border-2 border-b-4 shadow-md",
        isExpanded && "bg-white/5",
      )}
      style={{
        backgroundColor: `${accentColor.value}10`,
        borderColor: `${accentColor.value}40`,
        borderBottomColor: `${accentColor.value}60`,
        boxShadow: isExpanded ? `0 0 10px ${accentColor.value}30` : "none",
      }}
      onClick={handleClick}
    >
      <div className="p-4">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            {!imageError && project.icon_url ? (
              <img
                src={project.icon_url || "/placeholder.svg"}
                alt={project.title}
                className="w-28 h-28 object-cover rounded-lg border-2 border-b-4 shadow-md"
                style={{
                  borderColor: `${accentColor.value}40`,
                  borderBottomColor: `${accentColor.value}60`,
                }}
                onError={() => setImageError(true)}
              />
            ) : (
              <div
                className="w-28 h-28 rounded-lg border-2 border-b-4 shadow-md flex items-center justify-center"
                style={{
                  backgroundColor: `${accentColor.value}20`,
                  borderColor: `${accentColor.value}40`,
                  borderBottomColor: `${accentColor.value}60`,
                }}
              >
                <Icon
                  icon={getProjectTypeIcon(project.project_type)}
                  className="w-12 h-12 text-white/70"
                />
              </div>
            )}
          </div>

          <div className="flex-grow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-minecraft text-3xl mb-1 tracking-wide lowercase select-none">
                  {project.title}
                </h3>

                {installStatus === "loading" && (
                  <Label
                    variant="info"
                    size="xs"
                    icon={
                      <Icon
                        icon="pixel:circle-notch-solid"
                        className="animate-spin"
                      />
                    }
                    withAnimation={false}
                  />
                )}

                {installStatus === "error" && (
                  <Label
                    variant="destructive"
                    size="xs"
                    icon={<Icon icon="pixel:exclamation-triangle-solid" />}
                    title="Error checking installation status"
                    withAnimation={false}
                  />
                )}

                {typeof installStatus === "object" &&
                  installStatus?.is_included_in_norisk_pack && (
                    <Label
                      variant="info"
                      size="xs"
                      icon={<Icon icon="pixel:cube-solid" />}
                      withAnimation={false}
                    >
                      NORISK PACK
                    </Label>
                  )}

                {typeof installStatus === "object" &&
                  installStatus?.is_installed && (
                    <Label
                      variant="success"
                      size="xs"
                      icon={<Icon icon="pixel:check" />}
                      withAnimation={false}
                    >
                      Installed
                    </Label>
                  )}
              </div>

              <IconButton
                icon={
                  <Icon
                    icon={
                      isExpanded ? "pixel:chevron-up" : "pixel:chevron-down"
                    }
                  />
                }
                onClick={handleExpandClick}
                variant="ghost"
                size="sm"
                className={isLoading ? "animate-pulse" : ""}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              />
            </div>

            <p className="text-white/70 font-minecraft-ten text-base mb-2 line-clamp-2 tracking-wide lowercase select-none">
              {project.description}
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {/* @ts-ignore */}
              {project.categories?.slice(0, 3).map((category) => (
                <Label
                  key={category}
                  variant="secondary"
                  size="xs"
                  withAnimation={false}
                >
                  {category}
                </Label>
              ))}
            </div>

            <div className="flex items-center gap-4 text-white/70">
              <div className="flex items-center gap-1">
                <Icon icon="pixel:download-solid" className="w-5 h-5" />
                <span className="text-xl font-minecraft-ten tracking-wide lowercase select-none">
                  {project.downloads.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Icon
                  icon={getProjectTypeIcon(project.project_type)}
                  className="w-5 h-5"
                />
                <span className="text-xl font-minecraft-ten tracking-wide lowercase select-none">
                  {project.project_type}
                </span>
              </div>
            </div>
            {onInstall && (
              <div className="mt-3">
                <Button
                  onClick={handleInstall}
                  size="md"
                  className="min-w-0"
                  icon={
                    <Icon
                      icon={
                        project.project_type === "modpack"
                          ? "pixel:folder-plus-solid"
                          : "pixel:download-solid"
                      }
                      className="w-6 h-6"
                    />
                  }
                >
                  {project.project_type === "modpack"
                    ? "Create Profile"
                    : "Install"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
