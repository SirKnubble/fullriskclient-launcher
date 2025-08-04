"use client";

import { useEffect, useState } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ThemeInitializer } from "./components/ThemeInitializer";
import { ScrollbarProvider } from "./components/ui/ScrollbarProvider";
import { GlobalToaster } from "./components/ui/GlobalToaster";
import { type Event as TauriEvent, listen } from "@tauri-apps/api/event";
import { toast } from "react-hot-toast";
import {
  type EventPayload as FrontendEventPayload,
  EventType as FrontendEventType,
  type MinecraftProcessExitedPayload,
} from "./types/events";
import { GlobalCrashReportModal } from "./components/modals/GlobalCrashReportModal";
import { TermsOfServiceModal } from "./components/modals/TermsOfServiceModal";
import { useCrashModalStore } from "./store/crash-modal-store";
import { useThemeStore } from "./store/useThemeStore";
import { refreshNrcDataOnMount } from "./services/nrc-service";
import {
  getLauncherConfig,
  setProfileGroupingPreference,
} from "./services/launcher-config-service";
import { useGlobalDragAndDrop } from './hooks/useGlobalDragAndDrop';

import flagsmith from 'flagsmith';
import { FlagsmithProvider } from 'flagsmith/react';

export type ProfilesTabContext = {
  currentGroupingCriterion: string;
  onGroupingChange: (newCriterion: string) => void;
};

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openCrashModal } = useCrashModalStore();
  const { hasAcceptedTermsOfService } = useThemeStore();

  const activeTab = location.pathname.substring(1) || "play";

  const [currentGroupingCriterion, setCurrentGroupingCriterion] =
    useState<string>("none");

  const FLAGSMITH_ENVIRONMENT_ID = "eNSibjDaDW2nNJQvJnjj9y"; // User confirmed this is set

  useEffect(() => {
    const unlisten = listen<FrontendEventPayload>(
      "state_event",
      (event: TauriEvent<FrontendEventPayload>) => {
        if (
          event.payload.event_type === FrontendEventType.MinecraftProcessExited
        ) {
          try {
            const exitPayload: MinecraftProcessExitedPayload = JSON.parse(
              event.payload.message,
            );
            console.log(
              "[App.tsx] Global MinecraftProcessExited event:",
              exitPayload,
            );
            if (!exitPayload.success) {
              const crashMsg = `Minecraft crashed (Exit Code: ${exitPayload.exit_code ?? "N/A"}). See crash report for details.`;
              toast.error(crashMsg, { duration: 10000 });
              openCrashModal(exitPayload);
            }
          } catch (e) {
            console.error(
              "[App.tsx] Failed to parse MinecraftProcessExitedPayload:",
              e,
            );
            toast.error("Could not globally process Minecraft process status.");
          }
        }
      },
    );

    return () => {
      unlisten.then((f) => f());
    };
  }, [openCrashModal]);

  useEffect(() => {
    refreshNrcDataOnMount();
  }, []);

  useEffect(() => {
    getLauncherConfig()
      .then((config) => {
        if (config && config.profile_grouping_criterion) {
          setCurrentGroupingCriterion(config.profile_grouping_criterion);
        } else {
          setCurrentGroupingCriterion("none");
        }
      })
      .catch((err) => {
        console.error(
          "Failed to get initial profile grouping from config:",
          err,
        );
        setCurrentGroupingCriterion("none");
      });
  }, []);

  const handleProfileGroupingChange = async (newCriterion: string) => {
    setCurrentGroupingCriterion(newCriterion);
    try {
      await setProfileGroupingPreference(newCriterion);
      console.log("[App.tsx] Grouping preference saved successfully.");
    } catch (error) {
      console.error("[App.tsx] Failed to save grouping preference:", error);
      toast.error("Failed to save grouping preference.");
    }
  };

  const handleNavChange = (tabId: string) => {
    navigate(`/${tabId}`);
  };

  const profilesTabContext: ProfilesTabContext = {
    currentGroupingCriterion,
    onGroupingChange: handleProfileGroupingChange,
  };

  useGlobalDragAndDrop();

  return (
    <FlagsmithProvider
      options={{
        environmentID: FLAGSMITH_ENVIRONMENT_ID,
        api: 'https://flagsmith-staging.norisk.gg/api/v1/',
      }}
      flagsmith={flagsmith}
    >
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <ThemeInitializer />
        <ScrollbarProvider />
        <GlobalToaster />
        <GlobalCrashReportModal />
        <TermsOfServiceModal isOpen={!hasAcceptedTermsOfService} />
        <AppLayout activeTab={activeTab} onNavChange={handleNavChange}>
          <Outlet context={profilesTabContext} />
        </AppLayout>
      </div>
    </FlagsmithProvider>
  );
}

export function useProfilesTabContext() {
  return useOutletContext<ProfilesTabContext>();
}
