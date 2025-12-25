import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "@iconify/react";
import { useThemeStore } from "../../store/useThemeStore";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

interface MockLogLine {
  timestamp: string;
  level: LogLevel;
  thread?: string;
  message: string;
}

// Mock log data - in real implementation this would come from the backend
const MOCK_LOGS: MockLogLine[] = [
  { timestamp: "12:34:50", level: "INFO", thread: "main", message: "Starting Minecraft 1.21.1..." },
  { timestamp: "12:34:51", level: "INFO", thread: "main", message: "Java Version: 21.0.1" },
  { timestamp: "12:34:52", level: "INFO", thread: "main", message: "OS: Windows 11 (amd64)" },
  { timestamp: "12:34:53", level: "INFO", thread: "main", message: "Loading Fabric Loader 0.15.6" },
  { timestamp: "12:34:54", level: "INFO", thread: "FabricLoader", message: "Found 42 mods to load" },
  { timestamp: "12:34:55", level: "DEBUG", thread: "ModLoader", message: "Loading mod: sodium-fabric-0.5.8.jar" },
  { timestamp: "12:34:56", level: "INFO", thread: "main", message: "Loading Minecraft 1.21.1..." },
  { timestamp: "12:34:58", level: "WARN", thread: "ModLoader", message: "Deprecated API usage in mod 'ExampleMod'" },
  { timestamp: "12:35:00", level: "ERROR", thread: "Render", message: "Failed to load texture: missing.png" },
  { timestamp: "12:35:02", level: "INFO", thread: "main", message: "Loading world: New World" },
  { timestamp: "12:35:05", level: "INFO", thread: "main", message: "World loaded successfully" },
  { timestamp: "12:35:06", level: "INFO", thread: "main", message: "Player joined the game" },
  { timestamp: "12:35:08", level: "ERROR", thread: "Audio", message: "Failed to play sound: buffer overflow" },
  { timestamp: "12:35:10", level: "INFO", thread: "main", message: "Auto-save in progress..." },
  { timestamp: "12:35:11", level: "INFO", thread: "main", message: "Auto-save complete (1.2s)" },
  { timestamp: "12:35:13", level: "WARN", thread: "Shader", message: "Shader warning: unused variable" },
  { timestamp: "12:35:15", level: "INFO", thread: "Chat", message: "<Steve> Hello World!" },
  { timestamp: "12:35:17", level: "WARN", thread: "Memory", message: "High memory usage: 78%" },
  { timestamp: "12:35:19", level: "INFO", thread: "main", message: "Memory normalized: 52%" },
];

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  ERROR: "#f87171",
  WARN: "#fbbf24",
  INFO: "#60a5fa",
  DEBUG: "#22d3ee",
  TRACE: "#a78bfa",
};

interface SingleLogViewerProps {
  instanceId?: string;
  instanceName?: string;
}

export function SingleLogViewer({ instanceId, instanceName }: SingleLogViewerProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilters, setLevelFilters] = useState<Record<LogLevel, boolean>>({
    ERROR: true,
    WARN: true,
    INFO: true,
    DEBUG: true,
    TRACE: false,
  });
  const [isAutoscrollEnabled, setIsAutoscrollEnabled] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // Apply theme on mount
  useEffect(() => {
    const themeStore = useThemeStore.getState();
    themeStore.applyAccentColorToDOM();
    themeStore.applyBorderRadiusToDOM();
  }, []);

  // Filter logs
  const filteredLogs = MOCK_LOGS.filter((log) => {
    if (!levelFilters[log.level]) return false;
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

  const isAtBottom = useCallback(() => {
    if (!logContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 20;
  }, []);

  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    if (isAtBottom()) {
      if (!isAutoscrollEnabled) setIsAutoscrollEnabled(true);
    } else {
      if (isAutoscrollEnabled && !isUserScrollingRef.current) setIsAutoscrollEnabled(false);
    }
  }, [isAtBottom, isAutoscrollEnabled]);

  useEffect(() => {
    if (isAutoscrollEnabled && logContainerRef.current) {
      isUserScrollingRef.current = true;
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setTimeout(() => { isUserScrollingRef.current = false; }, 50);
    }
  }, [filteredLogs, isAutoscrollEnabled]);

  const toggleLevelFilter = (level: LogLevel) => {
    setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const handleCopy = async () => {
    const logText = filteredLogs
      .map((log) => `[${log.timestamp}] [${log.thread || "main"}/${log.level}] ${log.message}`)
      .join("\n");
    await navigator.clipboard.writeText(logText);
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setIsAutoscrollEnabled(true);
    }
  };

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        background: `linear-gradient(135deg, ${accentColor.value}20 0%, ${accentColor.value}10 50%, ${accentColor.value}18 100%)`,
      }}
    >
      {/* Titlebar */}
      <div
        className="flex items-center justify-between h-10 px-3 select-none"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2 flex-1 h-full pointer-events-none">
          <Icon icon="mdi:console" className="w-5 h-5" style={{ color: accentColor.value }} />
          <span className="font-minecraft-ten text-sm tracking-wider" style={{ color: accentColor.value }}>
            {instanceName?.toUpperCase() || "LOGS"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => appWindow.minimize()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          >
            <Icon icon="mdi:minus" className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          >
            <Icon icon="mdi:checkbox-blank-outline" className="w-3.5 h-3.5 text-white/70" />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/80 transition-colors"
          >
            <Icon icon="mdi:close" className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-4 flex-wrap rounded-lg bg-black/60 backdrop-blur-sm">
          {/* Search */}
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
              <button onClick={() => setSearchTerm("")} className="text-white/40 hover:text-white/70">
                <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Level Filters */}
          <div className="flex items-center gap-1.5">
            {(Object.keys(levelFilters) as LogLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => toggleLevelFilter(level)}
                className="px-2.5 py-1 text-xs font-minecraft-ten rounded transition-all"
                style={{
                  backgroundColor: levelFilters[level] ? `${LOG_LEVEL_COLORS[level]}25` : "rgba(255,255,255,0.05)",
                  color: levelFilters[level] ? LOG_LEVEL_COLORS[level] : "rgba(255,255,255,0.3)",
                  border: `1px solid ${levelFilters[level] ? `${LOG_LEVEL_COLORS[level]}50` : "transparent"}`,
                }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Log Content */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm custom-scrollbar rounded-lg bg-black/60 backdrop-blur-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/30">
              <div className="text-center">
                <Icon icon="solar:document-text-bold" className="w-12 h-12 mx-auto mb-2" />
                <p className="font-minecraft-ten">NO LOGS FOUND</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-2 py-0.5 hover:bg-white/5 px-2 -mx-2 rounded">
                  <span className="text-white/40 shrink-0">[{log.timestamp}]</span>
                  {log.thread && <span className="text-white/50 shrink-0">[{log.thread}/</span>}
                  <span className="shrink-0 font-semibold" style={{ color: LOG_LEVEL_COLORS[log.level] }}>
                    {log.level}{log.thread ? "]" : ""}
                  </span>
                  <span className="text-white/80 break-all">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="px-4 py-2 flex items-center justify-between rounded-lg bg-black/60 backdrop-blur-sm">
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
              <Icon icon={isAutoscrollEnabled ? "solar:arrow-down-bold" : "solar:pause-bold"} className="w-4 h-4" />
              {isAutoscrollEnabled ? "FOLLOWING" : "PAUSED"}
            </button>
            {!isAutoscrollEnabled && (
              <button
                onClick={scrollToBottom}
                className="flex items-center gap-1.5 hover:text-white/70 transition-colors px-2 py-0.5 rounded"
                style={{ backgroundColor: `${accentColor.value}20`, color: accentColor.value }}
              >
                <Icon icon="solar:arrow-down-bold" className="w-4 h-4" />
                SCROLL TO BOTTOM
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white/90 font-minecraft-ten text-xs"
            >
              <Icon icon="solar:copy-bold" className="w-4 h-4" />
              COPY
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white/90 font-minecraft-ten text-xs">
              <Icon icon="solar:upload-bold" className="w-4 h-4" />
              UPLOAD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
