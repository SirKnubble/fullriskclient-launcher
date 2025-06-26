"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { IconButton } from "../ui/buttons/IconButton";
import { useFriendsStore } from "../../store/useFriendsStore";
import * as ProcessService from "../../services/process-service";
import * as ConfigService from "../../services/launcher-config-service";
import type { LauncherConfig } from "../../types/launcherConfig";
import { toast } from "react-hot-toast";
import { useThemeStore } from "../../store/useThemeStore";
import { listen } from "@tauri-apps/api/event";

interface FriendsButtonProps {
  className?: string;
}

export function FriendsButton({ className }: FriendsButtonProps) {
  const { isSidebarOpen, setSidebarOpen, getOnlineFriendsCount } =
    useFriendsStore();
  const accentColor = useThemeStore((state) => state.accentColor);
  const [config, setConfig] = useState<LauncherConfig | null>(null);

  const onlineCount = getOnlineFriendsCount();

  // Load config on mount and when component becomes visible
  const loadConfig = async () => {
    try {
      const launcherConfig = await ConfigService.getLauncherConfig();
      setConfig(launcherConfig);
    } catch (error) {
      console.error("Failed to load launcher config:", error);
    }
  };

  useEffect(() => {
    loadConfig();

    // Listen for config changes
    const setupConfigListener = async () => {
      const unlisten = await listen("config-changed", (event) => {
        const payload = event.payload as any;
        if (payload && typeof payload.open_friends_in_window === "boolean") {
          setConfig((prevConfig) => {
            if (prevConfig) {
              return {
                ...prevConfig,
                open_friends_in_window: payload.open_friends_in_window,
              };
            }
            return prevConfig;
          });
        }
      });

      return unlisten;
    };

    let unlisten: (() => void) | undefined;
    setupConfigListener().then((unlistenFunc) => {
      unlisten = unlistenFunc;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleClick = async () => {
    if (config?.open_friends_in_window) {
      try {
        await ProcessService.openFriendsWindow();
      } catch (error) {
        toast("Failed to open friends window", {
          icon: (
            <Icon
              icon="solar:info-circle-bold"
              style={{ color: accentColor.value }}
            />
          ),
        });
      }
    } else {
      setSidebarOpen(!isSidebarOpen);
    }
  };

  return (
    <IconButton
      icon={
        <Icon 
          icon="solar:users-group-two-rounded-bold" 
          className="w-5 h-5" 
        />
      }
      onClick={handleClick}
      variant="flat"
      size="sm"
      aria-label={`Friends (${onlineCount} online)`}
      className={`text-white/70 hover:text-white h-10 w-10 ${className}`}
    />
  );
}
