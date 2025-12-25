import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import { useThemeStore } from "../../store/useThemeStore";
import { useLogSettingsStore } from "../../store/useLogSettingsStore";
import { LogWindowTitlebar } from "./LogWindowTitlebar";
import { InstanceSidebar } from "./InstanceSidebar";
import { useProcessEvents, useProcessLogs } from "../../hooks/useProcessEvents";
import { LogEntry, LogLevel, useProcessStore } from "../../store/useProcessStore";
import { openExternalUrl } from "../../services/tauri-service";

interface DisplayLogLine {
  id: string;
  timestamp: string | null; // null for continuation lines
  level: LogLevel;
  thread: string | null;
  message: string;
  processId: string;
}

// Hex colors for filter buttons (style attribute)
const LEVEL_COLORS: Record<LogLevel, string> = {
  ERROR: "#f87171",  // red-400
  WARN: "#fbbf24",   // yellow-400
  INFO: "#60a5fa",   // blue-400
  DEBUG: "#22d3ee",  // cyan-400
  TRACE: "#a78bfa",  // purple-400
  UNKNOWN: "#9ca3af", // gray-400
};

// Get Tailwind color class for log level (matching old LogViewerDisplay)
function getLevelColorClass(level: LogLevel | undefined): string {
  switch (level) {
    case "ERROR":
      return "text-red-400";
    case "WARN":
      return "text-yellow-400";
    case "INFO":
      return "text-blue-400";
    case "DEBUG":
      return "text-cyan-400";
    case "TRACE":
      return "text-purple-400";
    default:
      return "text-white/70";
  }
}

// Convert LogEntry to DisplayLogLine
function logEntryToDisplayLine(entry: LogEntry): DisplayLogLine {
  const timestamp = entry.timestamp
    ? entry.timestamp.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return {
    id: entry.id,
    timestamp,
    level: entry.level,
    thread: entry.thread,
    message: entry.message,
    processId: entry.processId,
  };
}

export function MinecraftLogWindow() {
  const accentColor = useThemeStore((state) => state.accentColor);
  const { showThreadPrefix, toggleShowThreadPrefix } = useLogSettingsStore();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilters, setLevelFilters] = useState<Record<LogLevel, boolean>>({
    ERROR: true,
    WARN: true,
    INFO: true,
    DEBUG: true,
    TRACE: false,
    UNKNOWN: true,
  });
  const [isAutoscrollEnabled, setIsAutoscrollEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPopupRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // Subscribe to process events
  const { processes } = useProcessEvents({ autoFetch: true });

  // Get logs for selected process
  const { logs: rawLogs } = useProcessLogs(selectedInstanceId);

  // Get stopped processes, launcher logs, and selectedProcessId from store for sync
  const { stoppedProcesses, launcherLogs: launcherLogsMap, selectedProcessId, selectProcess, clearLogs, clearLauncherLogs } = useProcessStore();

  // State for delayed "NO LOGS YET" display
  const [showNoLogs, setShowNoLogs] = useState(false);

  // Find the profile ID for the selected instance (could be running or stopped)
  const selectedProfileId = useMemo(() => {
    if (!selectedInstanceId) return null;
    // Check running processes first
    const runningProcess = processes.find(p => p.id === selectedInstanceId);
    if (runningProcess) return runningProcess.profile_id;
    // Check stopped processes
    const stoppedProcess = stoppedProcesses.get(selectedInstanceId);
    if (stoppedProcess) return stoppedProcess.profile_id;
    return null;
  }, [selectedInstanceId, processes, stoppedProcesses]);

  // Get launcher logs for the selected profile - must depend on launcherLogsMap for reactivity
  const launcherLogs = useMemo(() => {
    console.log("[MinecraftLogWindow] selectedProfileId:", selectedProfileId, "launcherLogsMap size:", launcherLogsMap.size, "keys:", Array.from(launcherLogsMap.keys()));
    if (!selectedProfileId) return [];
    const logs = launcherLogsMap.get(selectedProfileId) || [];
    console.log("[MinecraftLogWindow] Found launcher logs:", logs.length);
    return logs;
  }, [selectedProfileId, launcherLogsMap]);

  // Apply theme on mount
  useEffect(() => {
    const themeStore = useThemeStore.getState();
    themeStore.applyAccentColorToDOM();
    themeStore.applyBorderRadiusToDOM();
  }, []);

  // Sync with store selection (e.g., when selection transfers from stopped to new process)
  useEffect(() => {
    if (selectedProcessId && selectedProcessId !== selectedInstanceId) {
      setSelectedInstanceId(selectedProcessId);
    }
  }, [selectedProcessId, selectedInstanceId]);

  // Auto-select first process if none selected
  useEffect(() => {
    if (!selectedInstanceId && processes.length > 0) {
      const runningProcess = processes.find(p => p.state === "Running");
      if (runningProcess) {
        setSelectedInstanceId(runningProcess.id);
      } else {
        setSelectedInstanceId(processes[0].id);
      }
    }
  }, [processes, selectedInstanceId]);

  // Convert log entries to display format - show launcher logs if no MC logs yet
  const displayLogs = useMemo(() => {
    console.log("[MinecraftLogWindow] displayLogs calc - rawLogs:", rawLogs.length, "launcherLogs:", launcherLogs.length);
    // If we have MC logs, show those
    if (rawLogs.length > 0) {
      return rawLogs.map(logEntryToDisplayLine);
    }
    // Otherwise show launcher logs (during launch process)
    if (launcherLogs.length > 0) {
      console.log("[MinecraftLogWindow] Returning launcher logs for display:", launcherLogs);
      return launcherLogs.map(logEntryToDisplayLine);
    }
    return [];
  }, [rawLogs, launcherLogs]);

  // Filter logs based on search and level filters
  const filteredLogs = useMemo(() => {
    return displayLogs.filter((log) => {
      // Filter by level
      if (!levelFilters[log.level]) return false;

      // Filter by search
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          log.message.toLowerCase().includes(searchLower) ||
          log.thread?.toLowerCase().includes(searchLower) ||
          log.level.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [displayLogs, levelFilters, searchTerm]);

  // Delay showing "NO LOGS YET" by 1 second to avoid flicker
  useEffect(() => {
    setShowNoLogs(false);
    if (filteredLogs.length === 0) {
      const timer = setTimeout(() => setShowNoLogs(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [filteredLogs.length]);

  // Close settings popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSettingsOpen &&
        settingsPopupRef.current &&
        settingsButtonRef.current &&
        !settingsPopupRef.current.contains(event.target as Node) &&
        !settingsButtonRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSettingsOpen]);

  // Check if scrolled to bottom
  const isAtBottom = useCallback(() => {
    if (!logContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    // Allow 20px tolerance
    return scrollHeight - scrollTop - clientHeight < 20;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return;

    if (isAtBottom()) {
      // User scrolled to bottom - re-enable autoscroll
      if (!isAutoscrollEnabled) {
        setIsAutoscrollEnabled(true);
      }
    } else {
      // User scrolled up - disable autoscroll
      if (isAutoscrollEnabled && !isUserScrollingRef.current) {
        setIsAutoscrollEnabled(false);
      }
    }
  }, [isAtBottom, isAutoscrollEnabled]);

  // Auto-scroll effect
  useEffect(() => {
    if (isAutoscrollEnabled && logContainerRef.current) {
      isUserScrollingRef.current = true;
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      // Reset flag after scroll completes
      setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 50);
    }
  }, [filteredLogs, isAutoscrollEnabled]);

  const toggleLevelFilter = (level: LogLevel) => {
    setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const handleClear = () => {
    if (!selectedInstanceId) return;

    // Clear MC logs for selected process
    clearLogs(selectedInstanceId);

    // Also clear launcher logs for the profile
    if (selectedProfileId) {
      clearLauncherLogs(selectedProfileId);
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (filteredLogs.length === 0) {
      toast.error("No logs to upload");
      return;
    }

    setIsUploading(true);
    try {
      const logText = filteredLogs
        .map((log) => `[${log.timestamp || ""}] [${log.thread || "main"}/${log.level}] ${log.message}`)
        .join("\n");

      const response = await fetch("https://api.mclo.gs/1/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `content=${encodeURIComponent(logText)}`,
      });

      const data = await response.json();

      if (data.success) {
        await navigator.clipboard.writeText(data.url);
        toast.success("Uploaded! URL copied to clipboard");
        // Open in browser
        await openExternalUrl(data.url);
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Failed to upload logs:", error);
      toast.error("Failed to upload logs");
    } finally {
      setIsUploading(false);
    }
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setIsAutoscrollEnabled(true);
    }
  };

  // Handle instance selection - update both local state and store
  const handleSelectInstance = useCallback((id: string) => {
    setSelectedInstanceId(id);
    selectProcess(id);
  }, [selectProcess]);

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        background: `linear-gradient(135deg, ${accentColor.value}20 0%, ${accentColor.value}10 50%, ${accentColor.value}18 100%)`,
      }}
    >
      {/* Custom Titlebar */}
      <LogWindowTitlebar />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 p-3 gap-3">
        {/* Log Viewer (Left - 70%) */}
        <div className="flex-[7] flex flex-col min-w-0 gap-2">
          {/* Log Header with Search & Filters */}
          <div
            className="px-4 py-3 flex items-center gap-4 rounded-lg bg-black/60 backdrop-blur-sm"
            style={{ boxShadow: `0 4px 20px ${accentColor.value}15` }}
          >
            {/* Search Input */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded flex-1 min-w-[200px] max-w-[300px]"
              style={{
                backgroundColor: `${accentColor.value}15`,
                border: `1px solid ${accentColor.value}30`,
              }}
            >
              <Icon icon="solar:magnifer-bold" className="w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-sm font-minecraft-ten text-white/90 placeholder:text-white/40 outline-none flex-1"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-white/40 hover:text-white/70"
                >
                  <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Level Filter Buttons */}
            <div className="flex items-center gap-1.5">
              {(["ERROR", "WARN", "INFO", "DEBUG", "TRACE"] as LogLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => toggleLevelFilter(level)}
                  className="px-2.5 py-1 text-xs font-minecraft-ten rounded transition-all"
                  style={{
                    backgroundColor: levelFilters[level]
                      ? `${LEVEL_COLORS[level]}25`
                      : "rgba(255,255,255,0.05)",
                    color: levelFilters[level] ? LEVEL_COLORS[level] : "rgba(255,255,255,0.3)",
                    border: `1px solid ${levelFilters[level] ? `${LEVEL_COLORS[level]}50` : "transparent"}`,
                  }}
                >
                  {level}
                </button>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Settings Button - Far Right */}
            <div className="relative">
              <button
                ref={settingsButtonRef}
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-1.5 rounded transition-all hover:bg-white/10"
                style={{
                  backgroundColor: isSettingsOpen ? `${accentColor.value}20` : undefined,
                  color: isSettingsOpen ? accentColor.value : "rgba(255,255,255,0.5)",
                }}
              >
                <Icon icon="solar:settings-bold" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Log Content */}
          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm custom-scrollbar rounded-lg bg-black/60 backdrop-blur-sm"
            style={{ boxShadow: `0 4px 20px ${accentColor.value}15` }}
          >
            {!selectedInstanceId ? (
              <div className="flex items-center justify-center h-full text-white/30">
                <div className="text-center">
                  <Icon icon="solar:gamepad-bold" className="w-12 h-12 mx-auto mb-2" />
                  <p className="font-minecraft-ten">SELECT AN INSTANCE</p>
                  <p className="text-xs mt-1">Choose an instance from the sidebar to view logs</p>
                </div>
              </div>
            ) : filteredLogs.length === 0 ? (
              showNoLogs && (
                <div className="flex items-center justify-center h-full text-white/30">
                  <div className="text-center">
                    <Icon icon="solar:document-text-bold" className="w-12 h-12 mx-auto mb-2" />
                    <p className="font-minecraft-ten">NO LOGS YET</p>
                    <p className="text-xs mt-1">Waiting for log output...</p>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-0.5">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-nowrap items-start py-0.5 hover:bg-white/5 px-2 -mx-2 rounded"
                  >
                    {log.timestamp ? (
                      // Structured log line with timestamp
                      <>
                        <span className={`pr-2 select-none ${getLevelColorClass(log.level)}`}>
                          <span className="opacity-80">[{log.timestamp}]</span>
                          {showThreadPrefix && (
                            <span className="opacity-80 ml-1">
                              [{log.thread}/{log.level}]
                            </span>
                          )}
                        </span>
                        <span
                          className={`flex-1 min-w-0 break-words whitespace-pre-wrap ${
                            log.level === "ERROR" || log.level === "WARN"
                              ? getLevelColorClass(log.level)
                              : "text-white/90"
                          }`}
                        >
                          {log.message}
                        </span>
                      </>
                    ) : (
                      // Continuation line (no timestamp) - preserve whitespace
                      <span
                        className={`flex-1 min-w-0 break-words whitespace-pre-wrap ${
                          log.level === "ERROR" || log.level === "WARN"
                            ? getLevelColorClass(log.level)
                            : "text-white/90"
                        }`}
                      >
                        {log.message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div
            className="px-4 py-2 flex items-center justify-between rounded-lg bg-black/60 backdrop-blur-sm"
            style={{ boxShadow: `0 4px 20px ${accentColor.value}15` }}
          >
            <div className="flex items-center gap-4 text-white/50 font-minecraft-ten text-xs">
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:document-text-bold" className="w-4 h-4" />
                {filteredLogs.length} LINES
              </span>
              <button
                onClick={() => setIsAutoscrollEnabled(!isAutoscrollEnabled)}
                className="flex items-center gap-1.5 hover:text-white/70 transition-colors"
                style={{ color: isAutoscrollEnabled ? accentColor.value : undefined }}
              >
                <Icon
                  icon={isAutoscrollEnabled ? "solar:arrow-down-bold" : "solar:pause-bold"}
                  className="w-4 h-4"
                />
                {isAutoscrollEnabled ? "FOLLOWING" : "PAUSED"}
              </button>
              {!isAutoscrollEnabled && (
                <button
                  onClick={scrollToBottom}
                  className="flex items-center gap-1.5 hover:text-white/70 transition-colors px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${accentColor.value}20`,
                    color: accentColor.value
                  }}
                >
                  <Icon icon="solar:arrow-down-bold" className="w-4 h-4" />
                  SCROLL TO BOTTOM
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white/90 font-minecraft-ten text-xs"
              >
                <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                CLEAR
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors font-minecraft-ten text-xs ${
                  isUploading
                    ? "bg-white/5 text-white/40 cursor-wait"
                    : "hover:bg-white/10 text-white/60 hover:text-white/90"
                }`}
              >
                {isUploading ? (
                  <Icon icon="svg-spinners:pulse-3" className="w-4 h-4" />
                ) : (
                  <Icon icon="solar:upload-bold" className="w-4 h-4" />
                )}
                {isUploading ? "UPLOADING..." : "UPLOAD"}
              </button>
            </div>
          </div>
        </div>

        {/* Instance Sidebar (Right - 30%) */}
        <div className="flex-[3] min-w-[280px] max-w-[350px]">
          <InstanceSidebar
            selectedInstanceId={selectedInstanceId || undefined}
            onSelectInstance={handleSelectInstance}
          />
        </div>
      </div>

      {/* Settings Popup - Rendered via Portal to avoid blur issues */}
      {isSettingsOpen && settingsButtonRef.current && createPortal(
        <div
          ref={settingsPopupRef}
          className="fixed min-w-[240px] p-3 rounded-lg border"
          style={{
            top: settingsButtonRef.current.getBoundingClientRect().bottom + 8,
            right: window.innerWidth - settingsButtonRef.current.getBoundingClientRect().right,
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            borderColor: `${accentColor.value}40`,
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px ${accentColor.value}20`,
            zIndex: 9999,
          }}
        >
          <div className="text-xs font-minecraft-ten text-white/70 mb-3 pb-2 border-b border-white/10">
            LOG SETTINGS
          </div>

          {/* Thread Prefix Toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className="relative w-9 h-5 rounded-full transition-all cursor-pointer"
              style={{
                backgroundColor: showThreadPrefix
                  ? `${accentColor.value}80`
                  : "rgba(255,255,255,0.15)",
              }}
              onClick={toggleShowThreadPrefix}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all"
                style={{
                  left: showThreadPrefix ? "calc(100% - 18px)" : "2px",
                }}
              />
            </div>
            <div className="flex-1">
              <div className="text-sm text-white/90 font-minecraft-ten">
                Thread Prefix
              </div>
              <div className="text-xs text-white/50 font-sans">
                Show [Thread/LEVEL] prefix
              </div>
            </div>
          </label>
        </div>,
        document.body
      )}
    </div>
  );
}
