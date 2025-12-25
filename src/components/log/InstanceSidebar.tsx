import { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useThemeStore } from "../../store/useThemeStore";
import { useProcessStore, getProcessStatus, ProcessMetrics } from "../../store/useProcessStore";
import { useLaunchStateStore, LaunchState } from "../../store/launch-state-store";
import { ProcessMetadata, ProcessState } from "../../types/processState";
import { EventType } from "../../types/events";
import * as ProcessService from "../../services/process-service";

type InstanceStatus = "running" | "idle" | "crashed" | "starting" | "stopping";

interface InstanceData {
  id: string;
  profileId: string;
  name: string;
  version: string;
  loader: string;
  status: InstanceStatus;
  modCount: number;
  startTime: number;
  endTime?: number; // For stopped instances - when the process ended
  memoryUsage: number;
  memoryMax: number;
  cpuUsage: number;
  profileImageUrl?: string;
}

// Format memory
const formatMemory = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GB`;
  }
  return `${Math.round(mb)}MB`;
};

// Format elapsed time
const formatElapsedTime = (startTime: number, currentTime: number): string => {
  const elapsed = Math.floor((currentTime - startTime) / 1000);
  if (elapsed < 0) return "0:00";

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Convert ProcessMetadata to InstanceData
function processToInstance(process: ProcessMetadata, metrics?: ProcessMetrics, endTime?: number): InstanceData {
  const startTimeMs = new Date(process.start_time).getTime();

  return {
    id: process.id,
    profileId: process.profile_id,
    name: process.profile_name || "Unknown Profile",
    version: process.minecraft_version || "Unknown",
    loader: process.modloader?.toLowerCase() || "vanilla",
    status: getProcessStatus(process.state),
    modCount: 0, // Will be fetched from profile if needed
    startTime: startTimeMs,
    endTime: endTime,
    memoryUsage: metrics?.memoryBytes || 0,
    memoryMax: 4096 * 1024 * 1024, // Default 4GB, will be updated from metrics
    cpuUsage: metrics?.cpuPercent || 0,
    profileImageUrl: process.profile_image_url || undefined,
  };
}

interface InstanceSidebarProps {
  selectedInstanceId?: string;
  onSelectInstance?: (id: string) => void;
}

export function InstanceSidebar({
  selectedInstanceId,
  onSelectInstance,
}: InstanceSidebarProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Get processes from store
  const { processes, stoppedProcesses, processEndTimes, metrics, fetchProcesses, stopProcess, isLoading } = useProcessStore();

  // Get launch state store for launch feedback
  const { getProfileState, initiateButtonLaunch, finalizeButtonLaunch, setButtonStatusMessage } = useLaunchStateStore();

  // Get launcher log functions
  const { addLauncherLog, clearLauncherLogs, clearLogs } = useProcessStore();

  // Fetch processes on mount
  useEffect(() => {
    fetchProcesses();

    // Refresh processes periodically
    const interval = setInterval(() => {
      fetchProcesses();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchProcesses]);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for launch status events to update button UI (launcher logs are handled in useProcessEvents)
  const eventListenerRef = useRef<UnlistenFn | null>(null);
  useEffect(() => {
    let isSubscribed = true;

    const setupListener = async () => {
      eventListenerRef.current = await listen<{
        event_type: string;
        target_id: string | null;
        message: string;
      }>("state_event", (event) => {
        if (!isSubscribed) return;

        const payload = event.payload;
        const profileId = payload.target_id;

        if (!profileId) return;

        // Handle launch status events for button UI only
        if (payload.event_type === EventType.LaunchSuccessful) {
          finalizeButtonLaunch(profileId);
        } else if (payload.event_type === EventType.Error) {
          finalizeButtonLaunch(profileId, payload.message || "Error");
        } else if (payload.message && getProfileState(profileId).isButtonLaunching) {
          // Update button status message during launch
          setButtonStatusMessage(profileId, payload.message);
        }
      });
    };

    setupListener();

    return () => {
      isSubscribed = false;
      if (eventListenerRef.current) {
        eventListenerRef.current();
      }
    };
  }, [finalizeButtonLaunch, setButtonStatusMessage, getProfileState]);

  // Convert processes to instance data (merge running + stopped)
  const instances = useMemo(() => {
    // Running processes from backend
    const runningInstances = processes
      .filter((p) => {
        const status = getProcessStatus(p.state);
        return status === "running" || status === "starting" || status === "stopping";
      })
      .map((p) => processToInstance(p, metrics.get(p.id)));

    // Stopped processes (frontend-only retention) - include endTime for timer
    const stoppedInstances = Array.from(stoppedProcesses.values())
      .filter((p) => !processes.find((running) => running.id === p.id)) // Don't duplicate
      .map((p) => processToInstance(p, undefined, processEndTimes.get(p.id)));

    return [...runningInstances, ...stoppedInstances];
  }, [processes, stoppedProcesses, processEndTimes, metrics]);

  // Auto-select first instance if none selected
  useEffect(() => {
    if (!selectedInstanceId && instances.length > 0) {
      onSelectInstance?.(instances[0].id);
    }
  }, [instances, selectedInstanceId, onSelectInstance]);

  // Get selected instance
  const selectedInstance = instances.find((i) => i.id === selectedInstanceId);

  const getStatusColor = (status: InstanceStatus) => {
    switch (status) {
      case "running":
        return "#22c55e";
      case "starting":
        return "#eab308";
      case "crashed":
        return "#ef4444";
      case "stopping":
        return "#f97316";
      case "idle":
      default:
        return "#6b7280";
    }
  };

  const getLoaderIcon = (loader: string) => {
    switch (loader) {
      case "fabric":
        return "/icons/fabric.png";
      case "forge":
        return "/icons/forge.png";
      case "quilt":
        return "/icons/quilt.png";
      case "neoforge":
        return "/icons/neoforge.png";
      default:
        return "/icons/minecraft.png";
    }
  };

  const handleStopProcess = async (processId: string) => {
    try {
      await stopProcess(processId);
    } catch (error) {
      console.error("Failed to stop process:", error);
    }
  };

  const handleOpenFolder = async (profileId: string) => {
    try {
      await invoke("open_profile_folder", { profileId });
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const handleLaunchProfile = async (profileId: string) => {
    // Check if already launching
    const profileState = getProfileState(profileId);
    if (profileState.isButtonLaunching) {
      return;
    }

    // Check if profile already has a running process
    const existingProcess = processes.find(p => p.profile_id === profileId);
    if (existingProcess) {
      console.warn("Profile already has a running process:", existingProcess.id);
      return;
    }

    // Clear old logs before starting new launch
    clearLauncherLogs(profileId);
    // Also clear old MC logs from stopped processes with same profile
    for (const [processId, stoppedProcess] of stoppedProcesses) {
      if (stoppedProcess.profile_id === profileId) {
        clearLogs(processId);
      }
    }

    // Start launch with visual feedback
    initiateButtonLaunch(profileId);

    try {
      await ProcessService.launch(profileId);
      // Launch initiated successfully - status updates will come from events
    } catch (error) {
      console.error("Failed to launch profile:", error);
      const errorMsg = typeof error === "string" ? error : (error as Error).message || "Launch failed";
      finalizeButtonLaunch(profileId, errorMsg);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3">
        <h2
          className="font-minecraft-ten text-sm tracking-wider flex items-center gap-2"
          style={{ color: accentColor.value }}
        >
          <Icon icon="solar:monitor-bold" className="w-4 h-4" />
          Instances
        </h2>
      </div>

      {/* Instance List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {isLoading && instances.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-white/50 text-sm font-minecraft-ten">
            <Icon icon="svg-spinners:pulse-3" className="w-6 h-6 mr-2" />
            Loading...
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-white/50 text-sm font-minecraft-ten text-center">
            <Icon icon="solar:gamepad-no-charge-bold" className="w-8 h-8 mb-2 opacity-50" />
            No active instances
          </div>
        ) : (
          instances.map((instance) => {
            const isSelected = selectedInstanceId === instance.id;
            const isHovered = hoveredId === instance.id;
            const statusColor = getStatusColor(instance.status);

            return (
              <div
                key={instance.id}
                className="relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 bg-black/20 border border-white/10 hover:border-white/20"
                style={{
                  borderColor: isSelected ? `${accentColor.value}60` : undefined,
                  backgroundColor: isSelected ? `${accentColor.value}10` : undefined,
                }}
                onClick={() => onSelectInstance?.(instance.id)}
                onMouseEnter={() => setHoveredId(instance.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Settings Icon - top right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log("Open profile:", instance.profileId);
                  }}
                  className="absolute top-2 right-2 p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                  title="Open Profile"
                >
                  <Icon icon="solar:settings-bold" className="w-3.5 h-3.5" />
                </button>

                {/* Profile Icon */}
                <div
                  className="relative w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border-2 transition-all duration-200"
                  style={{
                    backgroundColor: isHovered || isSelected ? `${accentColor.value}20` : "transparent",
                    borderColor: isHovered || isSelected ? `${accentColor.value}60` : "transparent",
                  }}
                >
                  {instance.profileImageUrl ? (
                    <img
                      src={instance.profileImageUrl}
                      alt={instance.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon
                      icon="mdi:minecraft"
                      className="w-7 h-7"
                      style={{ color: accentColor.value }}
                    />
                  )}
                </div>

                {/* Instance Info */}
                <div className="flex-1 min-w-0">
                  {/* Name + Status inline */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3
                      className="font-minecraft-ten text-white text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ textShadow: "0 2px 4px rgba(0,0,0,0.7)" }}
                      title={instance.name}
                    >
                      {instance.name}
                    </h3>

                    {/* Timer */}
                    <div
                      className="flex items-center gap-1 text-xs font-minecraft-ten px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${statusColor}20`,
                        color: statusColor,
                      }}
                    >
                      {instance.status === "running" && (
                        <div
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ backgroundColor: statusColor }}
                        />
                      )}
                      {instance.status === "starting" && (
                        <Icon icon="svg-spinners:pulse-3" className="w-3 h-3" />
                      )}
                      {instance.status === "crashed" && (
                        <Icon icon="solar:danger-triangle-bold" className="w-3 h-3" />
                      )}
                      <Icon icon="solar:clock-circle-bold" className="w-3 h-3" />
                      {formatElapsedTime(instance.startTime, instance.endTime || currentTime)}
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div
                    className="flex items-center gap-2 text-xs font-minecraft-ten"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                  >
                    {/* MC Version */}
                    <div className="text-white/70 flex items-center gap-0.5">
                      <img
                        src="/icons/minecraft.png"
                        alt="MC"
                        className="w-2.5 h-2.5 object-contain"
                      />
                      <span>{instance.version}</span>
                    </div>

                    {/* Loader */}
                    <div className="text-white/60 flex items-center gap-0.5">
                      <img
                        src={getLoaderIcon(instance.loader)}
                        alt={instance.loader}
                        className="w-2.5 h-2.5 object-contain"
                      />
                      <span className="capitalize">{instance.loader}</span>
                    </div>

                    {/* Mod Count */}
                    {instance.modCount > 0 && (
                      <div className="text-white/50">
                        {instance.modCount} mods
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Actions Footer - for selected instance */}
      {selectedInstance && (
        <div className="px-3 py-3 bg-black/30 rounded-lg mx-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-minecraft-ten text-white/50 truncate">
              {selectedInstance.name}
            </span>
            <span
              className="text-xs font-minecraft-ten"
              style={{ color: getStatusColor(selectedInstance.status) }}
            >
              {formatElapsedTime(selectedInstance.startTime, selectedInstance.endTime || currentTime)}
            </span>
          </div>

          {/* Resource Bars - only for running instances with metrics */}
          {selectedInstance.status === "running" && selectedInstance.memoryUsage > 0 && (
            <div className="flex gap-4 mb-3 mt-1">
              {/* RAM */}
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs font-minecraft-ten text-white/40 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:sd-card-bold" className="w-3 h-3" />
                    RAM
                  </span>
                  <span className="text-white/60">{formatMemory(selectedInstance.memoryUsage)}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((selectedInstance.memoryUsage / selectedInstance.memoryMax) * 100, 100)}%`,
                      backgroundColor: selectedInstance.memoryUsage / selectedInstance.memoryMax > 0.8
                        ? "rgba(248, 113, 113, 0.7)"
                        : `${accentColor.value}90`,
                    }}
                  />
                </div>
              </div>

              {/* CPU */}
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs font-minecraft-ten text-white/40 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:cpu-bolt-bold" className="w-3 h-3" />
                    CPU
                  </span>
                  <span className="text-white/60">{Math.round(selectedInstance.cpuUsage)}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(selectedInstance.cpuUsage, 100)}%`,
                      backgroundColor: selectedInstance.cpuUsage > 80
                        ? "rgba(248, 113, 113, 0.7)"
                        : `${accentColor.value}90`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {/* Stop/Restart Toggle */}
            {selectedInstance.status === "running" || selectedInstance.status === "starting" ? (
              <button
                onClick={() => handleStopProcess(selectedInstance.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-minecraft-ten bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <Icon icon="solar:stop-bold" className="w-3.5 h-3.5" />
                STOP
              </button>
            ) : (selectedInstance.status === "crashed" || selectedInstance.status === "idle") && (() => {
              const launchState = getProfileState(selectedInstance.profileId);
              const isLaunching = launchState.isButtonLaunching;

              return isLaunching ? (
                <button
                  onClick={async () => {
                    try {
                      await ProcessService.abort(selectedInstance.profileId);
                      finalizeButtonLaunch(selectedInstance.profileId, "Aborted");
                      addLauncherLog(selectedInstance.profileId, "✗ Launch aborted by user");
                    } catch (error) {
                      console.error("Failed to abort launch:", error);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-minecraft-ten bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  <Icon icon="solar:stop-bold" className="w-3.5 h-3.5" />
                  STOP
                </button>
              ) : (
                <button
                  onClick={() => handleLaunchProfile(selectedInstance.profileId)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-minecraft-ten bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                >
                  <Icon icon="solar:play-bold" className="w-3.5 h-3.5" />
                  START
                </button>
              );
            })()}

            {/* Open Folder Button */}
            <button
              onClick={() => handleOpenFolder(selectedInstance.profileId)}
              className="px-2 py-1.5 rounded text-xs font-minecraft-ten bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
              title="Open Folder"
            >
              <Icon icon="solar:folder-bold" className="w-3.5 h-3.5" />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Popout Log Window Button */}
            <button
              onClick={() => {
                invoke("open_single_log_window", {
                  instanceId: selectedInstance.id,
                  instanceName: selectedInstance.name
                });
              }}
              className="px-2 py-1.5 rounded text-xs font-minecraft-ten bg-white/10 hover:bg-white/20 transition-colors"
              title="Pop Out Logs"
              style={{ color: accentColor.value }}
            >
              <Icon icon="solar:square-arrow-right-up-bold" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Status Footer */}
      <div className="px-4 py-2 text-xs font-minecraft-ten text-white/50">
        {instances.filter((i) => i.status === "running").length} RUNNING
      </div>
    </div>
  );
}
