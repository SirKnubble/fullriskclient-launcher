"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import { Button } from "../ui/buttons/Button";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { ConfirmDeleteDialog } from "../modals/ConfirmDeleteDialog";
import { Select } from "../ui/Select";
import {
  SettingsContextMenu,
  type ContextMenuItem,
} from "../ui/SettingsContextMenu";
import { cn } from "../../lib/utils";
import type { VersionManifest } from "../../types/minecraft";
import UnifiedService from "../../services/unified-service";
import { getAllProfilesAndLastPlayed } from "../../services/profile-service";
import {
  getWorldsForProfile,
  importWorld as importWorldToProfile,
} from "../../services/world-service";
import type { Profile } from "../../types/profile";
import type { WorldInfo } from "../../types/minecraft";
import { openExternalUrl } from "../../services/tauri-service";
import {
  ModPlatform,
  UnifiedProjectType,
  UnifiedSortType,
  type UnifiedModSearchResult,
  type UnifiedVersion,
} from "../../types/unified";

type ServerType =
  | "VANILLA"
  | "FORGE"
  | "FABRIC"
  | "NEO_FORGE"
  | "QUILT"
  | "PAPER"
  | "SPIGOT"
  | "BUKKIT"
  | "FOLIA"
  | "PURPUR";

interface CustomServer {
  _id: string;
  name: string;
  owner: string;
  mcVersion: string;
  loaderVersion?: string | null;
  type: ServerType;
  domain: string;
  subdomain: string;
  hostIp?: string | null;
  port?: number | null;
  forwarding?: ForwardingInfo | null;
  lastOnline: number;
  createdAt: number;
  deletedAt?: number | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
  originalName?: string | null;
}

interface ForwardingInfo {
  id?: string | null;
  mode?: string | null;
  address?: string | null;
  host?: string | null;
  port?: number | null;
  publicPort?: number | null;
  localPort?: number | null;
}

interface CustomServersResponse {
  limit: number;
  baseUrl: string;
  servers: CustomServer[];
}

interface CustomServerBlacklistEntry {
  uuid: string;
  reason: string;
  blockedAt: number;
  blockedBy: string;
}

interface AdminCustomServersResponse extends CustomServersResponse {
  blacklist: CustomServerBlacklistEntry[];
}

interface CustomServerEventPayload {
  server_id: string;
  data: string;
}

interface CustomServerStats {
  running: boolean;
  uptimeSeconds: number;
  sizeBytes: number;
  modCount: number;
}

type DetailTab = "logs" | "overview" | "settings" | "addons" | "world";
type ServerLogLevel = "all" | "info" | "warn" | "error" | "debug" | "console";
type ContentProvider = "modrinth" | "curseforge";
type ServerRuntimeStatus = "offline" | "starting" | "stopping" | "online";

interface InstalledServerAddon {
  fileName: string;
  sizeBytes: number;
}

interface ServerFileTreeEntry {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  sizeBytes: number;
  children: ServerFileTreeEntry[];
}

interface CustomServerWorldInfo {
  folderName: string;
  displayName: string;
  path: string;
  sizeBytes: number;
  gameDay?: number | null;
  lastPlayed?: number | null;
  versionName?: string | null;
}

interface CustomServerProperties {
  motd: string;
  maxPlayers: number;
  difficulty: string;
  gamemode: string;
  onlineMode: boolean;
  pvp: boolean;
  allowFlight: boolean;
  viewDistance: number;
  simulationDistance: number;
  spawnProtection: number;
}

const SERVER_TYPES: Array<{ value: ServerType; label: string; icon: string }> =
  [
    { value: "VANILLA", label: "Vanilla", icon: "simple-icons:minecraft" },
    { value: "FABRIC", label: "Fabric", icon: "simple-icons:fabric" },
    { value: "FORGE", label: "Forge", icon: "simple-icons:curseforge" },
    { value: "NEO_FORGE", label: "NeoForge", icon: "solar:fire-bold" },
    { value: "QUILT", label: "Quilt", icon: "solar:layers-bold" },
    { value: "PAPER", label: "Paper", icon: "solar:documents-bold" },
    { value: "SPIGOT", label: "Spigot", icon: "solar:server-square-bold" },
    { value: "BUKKIT", label: "Bukkit", icon: "solar:box-bold" },
    { value: "FOLIA", label: "Folia", icon: "solar:leaf-bold" },
    { value: "PURPUR", label: "Purpur", icon: "solar:magic-stick-bold" },
  ];

const needsLoaderVersion = new Set<ServerType>([
  "FABRIC",
  "FORGE",
  "NEO_FORGE",
  "QUILT",
]);
const SAFETY_INFO_KEY = "fullrisk-custom-server-safety-info-v2";
const TUNNEL_ENABLED_KEY = "fullrisk-custom-server-tunnel-enabled";
const SUPPORT_SERVER_URL = "https://fullrisk.net/support";

function formatServerError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const candidates = [
      record.message,
      record.error,
      record.reason,
      record.details,
      record.statusText,
    ];
    const found = candidates.find(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
    if (typeof found === "string") {
      return found;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unexpected connection error";
    }
  }
  return "Unexpected connection error";
}

function serverErrorMessage(action: string, error: unknown): string {
  const detail = formatServerError(error);
  return `${action}: ${detail}`;
}

function isBlockedServerError(error: unknown): boolean {
  return formatServerError(error)
    .toLowerCase()
    .includes("blocked from fullrisk custom servers");
}

function normalizeUuidForCompare(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

function pickRandomLocalServerPort() {
  return Math.floor(20000 + Math.random() * 5000);
}

export function ServersTab() {
  const [servers, setServers] = useState<CustomServer[]>([]);
  const [limit, setLimit] = useState(0);
  const [baseUrl, setBaseUrl] = useState("fullrisk.net");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [minecraftVersions, setMinecraftVersions] = useState<string[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [serverLogs, setServerLogs] = useState<Record<string, string[]>>({});
  const [serverStats, setServerStats] = useState<
    Record<string, CustomServerStats>
  >({});
  const [busyServerId, setBusyServerId] = useState<string | null>(null);
  const [safetyInfoOpen, setSafetyInfoOpen] = useState(false);
  const [hasAcceptedSafetyInfo, setHasAcceptedSafetyInfo] = useState(true);
  const [tunnelEnabledByServer, setTunnelEnabledByServer] = useState<
    Record<string, boolean>
  >({});
  const [serverToEdit, setServerToEdit] = useState<CustomServer | null>(null);
  const [serverToDelete, setServerToDelete] = useState<CustomServer | null>(
    null,
  );
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminServers, setAdminServers] = useState<CustomServer[]>([]);
  const [adminBlacklist, setAdminBlacklist] = useState<
    CustomServerBlacklistEntry[]
  >([]);
  const [canUseAdminMode, setCanUseAdminMode] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const selectedServer = selectedServerId
    ? (servers.find((server) => server._id === selectedServerId) ?? null)
    : null;

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<CustomServersResponse>("get_custom_servers");
      setBlockedReason(null);
      setServers(result.servers ?? []);
      setLimit(result.limit ?? 0);
      setBaseUrl(result.baseUrl || "fullrisk.net");
    } catch (error) {
      console.error(error);
      if (isBlockedServerError(error)) {
        setBlockedReason(formatServerError(error));
        setServers([]);
        return;
      }
      toast.error(serverErrorMessage("Connection error", error));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminServers = useCallback(async () => {
    setAdminLoading(true);
    try {
      const result = await invoke<AdminCustomServersResponse>(
        "get_admin_custom_servers",
      );
      setAdminServers(result.servers ?? []);
      setAdminBlacklist(result.blacklist ?? []);
      setBaseUrl(result.baseUrl || "fullrisk.net");
    } catch (error) {
      console.error(error);
      setAdminMode(false);
      toast.error(serverErrorMessage("Admin access denied", error));
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    invoke<AdminCustomServersResponse>("get_admin_custom_servers")
      .then((result) => {
        if (!active) return;
        setCanUseAdminMode(true);
        setAdminServers(result.servers ?? []);
        setAdminBlacklist(result.blacklist ?? []);
      })
      .catch(() => {
        if (!active) return;
        setCanUseAdminMode(false);
        setAdminMode(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    const accepted =
      window.localStorage.getItem(SAFETY_INFO_KEY) === "accepted";
    setHasAcceptedSafetyInfo(accepted);
    setSafetyInfoOpen(!accepted);
  }, []);

  const acceptSafetyInfo = () => {
    window.localStorage.setItem(SAFETY_INFO_KEY, "accepted");
    setHasAcceptedSafetyInfo(true);
    setSafetyInfoOpen(false);
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TUNNEL_ENABLED_KEY);
      const parsed = saved
        ? (JSON.parse(saved) as Record<string, boolean>)
        : {};
      setTunnelEnabledByServer(parsed);
    } catch {
      setTunnelEnabledByServer({});
    }
  }, []);

  const isTunnelEnabled = useCallback(
    (serverId: string) => tunnelEnabledByServer[serverId] ?? true,
    [tunnelEnabledByServer],
  );

  const setTunnelEnabled = useCallback((serverId: string, enabled: boolean) => {
    setTunnelEnabledByServer((current) => {
      const next = { ...current, [serverId]: enabled };
      window.localStorage.setItem(TUNNEL_ENABLED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (servers.length === 0) {
      setServerStats({});
      return;
    }

    let active = true;
    const refresh = () => {
      servers.forEach((server) => {
        invoke<CustomServerStats>("get_custom_server_stats", {
          serverId: server._id,
        })
          .then((stats) => {
            if (!active) return;
            setServerStats((current) => ({
              ...current,
              [server._id]: stats,
            }));
          })
          .catch(() => undefined);
      });
    };

    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [servers]);

  useEffect(() => {
    invoke<VersionManifest>("get_minecraft_versions")
      .then((manifest) => {
        const releases = manifest.versions
          .filter((version) => version.type === "release")
          .map((version) => version.id)
          .slice(0, 30);
        setMinecraftVersions(releases);
      })
      .catch(() =>
        setMinecraftVersions([
          "1.21.5",
          "1.21.4",
          "1.21.1",
          "1.20.6",
          "1.20.4",
        ]),
      );
  }, []);

  useEffect(() => {
    const unlisten = listen<CustomServerEventPayload>(
      "custom-server-process-output",
      (event) => {
        setServerLogs((current) => {
          const logs = current[event.payload.server_id] ?? [];
          return {
            ...current,
            [event.payload.server_id]: [...logs, event.payload.data].slice(
              -1000,
            ),
          };
        });
      },
    );

    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const handleLoadedLogs = (event: Event) => {
      const detail = (
        event as CustomEvent<{ serverId: string; logs: string[] }>
      ).detail;
      if (!detail?.serverId) return;
      setServerLogs((current) => ({
        ...current,
        [detail.serverId]: detail.logs,
      }));
    };

    window.addEventListener(
      "fullrisk-custom-server-logs-loaded",
      handleLoadedLogs,
    );
    return () =>
      window.removeEventListener(
        "fullrisk-custom-server-logs-loaded",
        handleLoadedLogs,
      );
  }, []);

  const canCreate =
    !blockedReason &&
    (canUseAdminMode ||
      limit <= 0 ||
      servers.filter((server) => !server.deletedAt).length < limit);

  const toggleAdminMode = async () => {
    const next = !adminMode;
    setAdminMode(next);
    if (next) {
      await loadAdminServers();
    }
  };

  const handleCreate = async (payload: {
    name: string;
    mcVersion: string;
    loaderVersion?: string;
    type: ServerType;
    subdomain: string;
    importSourcePath?: string;
  }) => {
    setCreating(true);
    try {
      const available = await invoke<boolean>("check_custom_server_subdomain", {
        subdomain: payload.subdomain,
      });

      if (!available) {
        toast.error("subdomain is already taken");
        return;
      }

      const created = await invoke<CustomServer>("create_custom_server", {
        name: payload.name,
        mcVersion: payload.mcVersion,
        loaderVersion: payload.loaderVersion || null,
        type: payload.type,
        subdomain: payload.subdomain,
        port: pickRandomLocalServerPort(),
      });

      if (payload.importSourcePath) {
        await invoke("import_custom_server_files", {
          customServer: created,
          sourcePath: payload.importSourcePath,
        });
      }

      setServers((current) => [created, ...current]);
      setCreateOpen(false);
      toast.success(
        payload.importSourcePath
          ? "custom server imported"
          : "custom server created",
      );
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to create custom server", error));
    } finally {
      setCreating(false);
    }
  };

  const handleExport = async (server: CustomServer) => {
    try {
      const target = await saveDialog({
        defaultPath: `${server.subdomain || server.name}-fullrisk-server.zip`,
        filters: [{ name: "FullRisk Server Archive", extensions: ["zip"] }],
      });
      if (!target) return;
      await invoke<string>("export_custom_server", {
        customServer: server,
        targetPath: target,
      });
      toast.success("server exported");
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to export server", error));
    }
  };

  const handleDelete = async (server: CustomServer) => {
    setDeletingServerId(server._id);
    try {
      await invoke("delete_custom_server", { id: server._id });
      setServers((current) =>
        current.filter((item) => item._id !== server._id),
      );
      setSelectedServerId((current) =>
        current === server._id ? null : current,
      );
      toast.success("custom server deleted");
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to delete custom server", error));
    } finally {
      setDeletingServerId(null);
      setServerToDelete(null);
    }
  };

  const handleAdminDelete = async (server: CustomServer) => {
    setDeletingServerId(server._id);
    try {
      const deleted = await invoke<CustomServer>("admin_delete_custom_server", {
        id: server._id,
      });
      setAdminServers((current) =>
        current.map((item) => (item._id === deleted._id ? deleted : item)),
      );
      setServers((current) =>
        current.map((item) => (item._id === deleted._id ? deleted : item)),
      );
      toast.success("server marked as deleted");
    } catch (error) {
      console.error(error);
      toast.error(
        serverErrorMessage("Failed to delete server as admin", error),
      );
    } finally {
      setDeletingServerId(null);
    }
  };

  const handleAdminRestore = async (server: CustomServer) => {
    setDeletingServerId(server._id);
    try {
      const restored = await invoke<CustomServer>(
        "admin_restore_custom_server",
        { id: server._id },
      );
      setAdminServers((current) =>
        current.map((item) => (item._id === restored._id ? restored : item)),
      );
      setServers((current) =>
        current.map((item) => (item._id === restored._id ? restored : item)),
      );
      toast.success("server restored");
    } catch (error) {
      console.error(error);
      toast.error(
        serverErrorMessage("Failed to restore server as admin", error),
      );
    } finally {
      setDeletingServerId(null);
    }
  };

  const handleAdminBlockOwner = async (server: CustomServer) => {
    try {
      await invoke("admin_block_custom_server_owner", {
        id: server._id,
        reason: `Blocked because of custom server ${server.subdomain}.${server.domain}`,
      });
      await loadAdminServers();
      toast.success("owner blocked");
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to block owner", error));
    }
  };

  const handleAdminUnblockOwner = async (owner: string) => {
    try {
      await invoke("admin_unblock_custom_server_owner", { owner });
      await loadAdminServers();
      toast.success("owner unblocked");
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to unblock owner", error));
    }
  };

  const handleUpdate = async (
    server: CustomServer,
    payload: {
      name: string;
      mcVersion: string;
      loaderVersion?: string | null;
      type: ServerType;
      subdomain: string;
      port: number;
    },
  ) => {
    try {
      const updated = await invoke<CustomServer>("update_custom_server", {
        id: server._id,
        name: payload.name,
        mcVersion: payload.mcVersion,
        loaderVersion: payload.loaderVersion || null,
        type: payload.type,
        subdomain: payload.subdomain,
        port: payload.port,
      });
      setServers((current) =>
        current.map((item) => (item._id === updated._id ? updated : item)),
      );
      toast.success("custom server updated");
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to update custom server", error));
    }
  };

  const handleStart = async (server: CustomServer) => {
    const tunnelEnabled = isTunnelEnabled(server._id);
    setBusyServerId(server._id);
    setServerLogs((current) => ({
      ...current,
      [server._id]: [
        ...(current[server._id] ?? []),
        `[${new Date().toLocaleTimeString()}] [INFO]: Starting server (${tunnelEnabled ? "tunnel on" : "tunnel off"})`,
      ],
    }));

    try {
      await invoke("run_custom_server", {
        customServer: server,
        forwardingEnabled: tunnelEnabled,
      });
      await loadServers();
    } catch (error) {
      console.error(error);
      const message = serverErrorMessage("Failed to start server", error);
      toast.error(message);
      setServerLogs((current) => ({
        ...current,
        [server._id]: [
          ...(current[server._id] ?? []),
          `[${new Date().toLocaleTimeString()}] [ERROR]: ${message}`,
        ],
      }));
    } finally {
      setBusyServerId(null);
    }
  };

  const handleStop = async (server: CustomServer) => {
    setBusyServerId(server._id);
    setServerLogs((current) => ({
      ...current,
      [server._id]: [
        ...(current[server._id] ?? []),
        `[${new Date().toLocaleTimeString()}] [INFO]: Stopping server`,
      ],
    }));

    try {
      await invoke("terminate_custom_server", {
        serverId: server._id,
        launcherWasClosed: false,
      });
      await loadServers();
    } catch (error) {
      console.error(error);
      const message = serverErrorMessage("Failed to stop server", error);
      toast.error(message);
      setServerLogs((current) => ({
        ...current,
        [server._id]: [
          ...(current[server._id] ?? []),
          `[${new Date().toLocaleTimeString()}] [ERROR]: ${message}`,
        ],
      }));
    } finally {
      setBusyServerId(null);
    }
  };

  return (
    <div className="h-full w-full overflow-hidden">
      {selectedServer ? (
        <>
          <CustomServerDetails
            server={selectedServer}
            logs={serverLogs[selectedServer._id] ?? []}
            busy={busyServerId === selectedServer._id}
            onBack={() => setSelectedServerId(null)}
            onDelete={() => setServerToDelete(selectedServer)}
            onExport={() => handleExport(selectedServer)}
            onStart={() => handleStart(selectedServer)}
            onStop={() => handleStop(selectedServer)}
            onUpdate={(payload) => handleUpdate(selectedServer, payload)}
            versions={minecraftVersions}
            tunnelEnabled={isTunnelEnabled(selectedServer._id)}
            onTunnelChange={(enabled) =>
              setTunnelEnabled(selectedServer._id, enabled)
            }
          />
          <ServerDeleteDialog
            server={serverToDelete}
            deletingServerId={deletingServerId}
            onClose={() => setServerToDelete(null)}
            onConfirm={(server) => handleDelete(server)}
          />
        </>
      ) : (
        <div className="flex h-full min-w-0 flex-col gap-4 p-3 sm:gap-5 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h1 className="fullrisk-title truncate font-minecraft text-4xl lowercase sm:text-5xl">
                servers
              </h1>
              <p className="truncate font-minecraft-ten text-base text-white/55 sm:text-lg">
                Custom servers use our {baseUrl} domain.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canUseAdminMode && (
                <Button
                  variant={adminMode ? "3d" : "flat-secondary"}
                  size="sm"
                  icon={
                    <Icon icon="solar:shield-user-bold" className="h-5 w-5" />
                  }
                  onClick={toggleAdminMode}
                >
                  admin
                </Button>
              )}
              <Button
                variant="3d"
                size="sm"
                disabled={!canCreate || adminMode}
                icon={<Icon icon="solar:add-square-bold" className="h-5 w-5" />}
                onClick={() => setCreateOpen(true)}
              >
                create
              </Button>
              <Button
                variant="flat-secondary"
                size="sm"
                icon={
                  <Icon icon="solar:info-circle-bold" className="h-5 w-5" />
                }
                onClick={() => setSafetyInfoOpen(true)}
              >
                info
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {adminMode ? (
              <AdminCustomServerModeration
                servers={adminServers}
                blacklist={adminBlacklist}
                loading={adminLoading}
                deletingServerId={deletingServerId}
                onRefresh={loadAdminServers}
                onDelete={handleAdminDelete}
                onRestore={handleAdminRestore}
                onBlockOwner={handleAdminBlockOwner}
                onUnblockOwner={handleAdminUnblockOwner}
              />
            ) : loading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="fullrisk-panel h-36 animate-pulse"
                  />
                ))}
              </div>
            ) : blockedReason ? (
              <BlockedCustomServerState reason={blockedReason} />
            ) : servers.length === 0 ? (
              <EmptyState
                icon="solar:server-square-cloud-bold"
                message="servers"
                description="create your first server"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {servers.map((server) => (
                  <CustomServerCard
                    key={server._id}
                    server={server}
                    status={getRuntimeStatus(
                      serverStats[server._id],
                      serverLogs[server._id] ?? [],
                      busyServerId === server._id,
                    )}
                    onDelete={() => setServerToDelete(server)}
                    onEdit={() => setServerToEdit(server)}
                    onExport={() => handleExport(server)}
                    onOpen={() => setSelectedServerId(server._id)}
                    onStart={() => handleStart(server)}
                    onStop={() => handleStop(server)}
                    tunnelEnabled={isTunnelEnabled(server._id)}
                    onTunnelChange={(enabled) =>
                      setTunnelEnabled(server._id, enabled)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <CreateCustomServerModal
            open={createOpen}
            loading={creating}
            versions={minecraftVersions}
            baseUrl={baseUrl}
            onClose={() => setCreateOpen(false)}
            onCreate={handleCreate}
          />
          {serverToEdit && (
            <EditCustomServerModal
              open={Boolean(serverToEdit)}
              server={serverToEdit}
              baseUrl={baseUrl}
              versions={minecraftVersions}
              onClose={() => setServerToEdit(null)}
              onSave={(payload) => {
                handleUpdate(serverToEdit, payload);
                setServerToEdit(null);
              }}
            />
          )}
          <ServerDeleteDialog
            server={serverToDelete}
            deletingServerId={deletingServerId}
            onClose={() => setServerToDelete(null)}
            onConfirm={(server) => handleDelete(server)}
          />
          <ServerSafetyInfoModalV2
            open={safetyInfoOpen}
            forced={!hasAcceptedSafetyInfo}
            onClose={() => {
              if (hasAcceptedSafetyInfo) {
                setSafetyInfoOpen(false);
              }
            }}
            onAccept={acceptSafetyInfo}
          />
        </div>
      )}
    </div>
  );
}

function BlockedCustomServerState({ reason }: { reason: string }) {
  return (
    <div className="fullrisk-panel flex min-h-[260px] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center border border-red-400/30 bg-red-500/15 text-red-200">
        <Icon icon="solar:shield-cross-bold" className="h-9 w-9" />
      </div>
      <div className="max-w-xl">
        <h2 className="font-minecraft text-4xl lowercase text-white">
          your account has been blocked
        </h2>
        <p className="mt-2 font-minecraft-ten text-lg text-white/65">
          {reason || "You have been blocked from FullRisk custom servers."}
        </p>
      </div>
      <Button
        variant="3d"
        size="sm"
        icon={<Icon icon="ic:baseline-discord" className="h-5 w-5" />}
        onClick={() => openExternalUrl(SUPPORT_SERVER_URL)}
      >
        contact support
      </Button>
    </div>
  );
}

function AdminCustomServerModeration({
  servers,
  blacklist,
  loading,
  deletingServerId,
  onRefresh,
  onDelete,
  onRestore,
  onBlockOwner,
  onUnblockOwner,
}: {
  servers: CustomServer[];
  blacklist: CustomServerBlacklistEntry[];
  loading: boolean;
  deletingServerId: string | null;
  onRefresh: () => void;
  onDelete: (server: CustomServer) => void;
  onRestore: (server: CustomServer) => void;
  onBlockOwner: (server: CustomServer) => void;
  onUnblockOwner: (owner: string) => void;
}) {
  const blockedOwners = new Set(
    blacklist.map((entry) => normalizeUuidForCompare(entry.uuid)),
  );

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="fullrisk-panel h-36 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="fullrisk-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-minecraft text-3xl lowercase text-white">
            moderation
          </h2>
          <p className="font-minecraft-ten text-base text-white/55">
            {servers.length} server · {blacklist.length} blocked users
          </p>
        </div>
        <Button
          variant="flat-secondary"
          size="sm"
          icon={<Icon icon="solar:refresh-bold" className="h-5 w-5" />}
          onClick={onRefresh}
        >
          refresh
        </Button>
      </div>

      {servers.length === 0 ? (
        <EmptyState
          icon="solar:server-square-cloud-bold"
          message="moderation"
          description="no servers found"
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {servers.map((server) => {
            const ownerBlocked = blockedOwners.has(
              normalizeUuidForCompare(server.owner),
            );
            const deleted = Boolean(server.deletedAt);
            return (
              <article
                key={server._id}
                className={cn(
                  "fullrisk-panel flex min-w-0 flex-col gap-4 p-4",
                  deleted && "opacity-70",
                )}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-minecraft text-3xl lowercase text-white">
                      {deleted ? "deleted" : server.name}
                    </h2>
                    <p className="truncate font-minecraft-ten text-base text-white/60">
                      {server.subdomain}.{server.domain}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2 font-minecraft-ten text-base">
                    {deleted && (
                      <span className="border border-red-400/30 bg-red-500/15 px-2 py-1 text-red-200">
                        deleted
                      </span>
                    )}
                    {ownerBlocked && (
                      <span className="border border-amber-300/30 bg-amber-400/15 px-2 py-1 text-amber-100">
                        blocked
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 font-minecraft-ten text-base text-white/65 sm:grid-cols-2">
                  <span className="min-w-0 truncate border border-white/10 bg-black/30 px-2 py-1">
                    owner: {server.owner}
                  </span>
                  <span className="border border-white/10 bg-black/30 px-2 py-1">
                    {server.type} · {server.mcVersion}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="flat-secondary"
                    size="sm"
                    disabled={deletingServerId === server._id}
                    icon={
                      <Icon
                        icon={
                          deleted
                            ? "solar:restart-bold"
                            : "solar:trash-bin-trash-bold"
                        }
                        className="h-5 w-5"
                      />
                    }
                    onClick={() =>
                      deleted ? onRestore(server) : onDelete(server)
                    }
                  >
                    {deleted ? "restore" : "delete"}
                  </Button>
                  <Button
                    variant="flat-secondary"
                    size="sm"
                    icon={
                      <Icon
                        icon={
                          ownerBlocked
                            ? "solar:shield-check-bold"
                            : "solar:shield-cross-bold"
                        }
                        className="h-5 w-5"
                      />
                    }
                    onClick={() =>
                      ownerBlocked
                        ? onUnblockOwner(server.owner)
                        : onBlockOwner(server)
                    }
                  >
                    {ownerBlocked ? "unblock" : "block owner"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ServerDeleteDialog({
  server,
  deletingServerId,
  onClose,
  onConfirm,
}: {
  server: CustomServer | null;
  deletingServerId: string | null;
  onClose: () => void;
  onConfirm: (server: CustomServer) => void;
}) {
  return (
    <ConfirmDeleteDialog
      isOpen={Boolean(server)}
      itemName={server?.name ?? "server"}
      title="Delete Server"
      message={
        <div className="space-y-3 font-minecraft-ten text-white/80">
          <p>Do you really want to delete:</p>
          <p className="border border-white/10 bg-black/30 px-3 py-2 text-white">
            - {server?.name ?? "Server"}
          </p>
          <p className="text-white/55">
            This removes the FullRisk server entry and DNS records.
          </p>
        </div>
      }
      isDeleting={deletingServerId === server?._id}
      onClose={onClose}
      onConfirm={() => {
        if (server) {
          onConfirm(server);
        }
      }}
    />
  );
}

function CustomServerCard({
  server,
  status,
  onDelete,
  onEdit,
  onExport,
  onOpen,
  onStart,
  onStop,
  tunnelEnabled,
  onTunnelChange,
}: {
  server: CustomServer;
  status: ServerRuntimeStatus;
  onDelete: () => void;
  onEdit: () => void;
  onExport: () => void;
  onOpen: () => void;
  onStart: () => void;
  onStop: () => void;
  tunnelEnabled: boolean;
  onTunnelChange: (enabled: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const type =
    SERVER_TYPES.find((item) => item.value === server.type) ?? SERVER_TYPES[0];
  const address = getServerDisplayAddress(server, [], tunnelEnabled);
  const isDeleted = Boolean(server.deletedAt);
  const isOnlineish = status === "online" || status === "starting";
  const isRunningish = isOnlineish || status === "stopping";
  const contextMenuItems: ContextMenuItem[] = [
    {
      id: "open",
      label: "Open",
      icon: "solar:server-square-cloud-bold",
      disabled: isDeleted,
      onClick: onOpen,
    },
    {
      id: "edit",
      label: "Edit",
      icon: "solar:pen-new-square-bold",
      disabled: isDeleted || isOnlineish,
      onClick: onEdit,
    },
    {
      id: "copy-address",
      label: "Copy Address",
      icon: "solar:copy-bold",
      onClick: async () => {
        await writeText(address);
        toast.success("address copied");
      },
    },
    {
      id: "export",
      label: "Export",
      icon: "solar:archive-up-bold",
      onClick: onExport,
    },
    {
      id: "tunnel",
      label: tunnelEnabled ? "Disable Tunnel" : "Enable Tunnel",
      icon: tunnelEnabled
        ? "solar:shield-check-bold"
        : "solar:shield-cross-bold",
      disabled: isDeleted || isOnlineish,
      onClick: () => onTunnelChange(!tunnelEnabled),
    },
    {
      id: isRunningish ? "stop" : "start",
      label: isRunningish ? "Stop" : "Start",
      icon: isRunningish ? "solar:stop-circle-bold" : "solar:play-circle-bold",
      disabled: isDeleted || status === "stopping",
      onClick: isRunningish ? onStop : onStart,
    },
    {
      id: "delete",
      label: "Delete",
      icon: "solar:trash-bin-trash-bold",
      destructive: true,
      separator: true,
      onClick: onDelete,
    },
  ];

  const openContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 280),
    });
    setMenuOpen(true);
  };

  return (
    <article
      className="fullrisk-panel flex min-h-36 min-w-0 cursor-pointer flex-col justify-between gap-4 p-4 transition hover:border-white/25"
      onClick={isDeleted ? undefined : onOpen}
      onContextMenu={openContextMenu}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/15 bg-black/35">
          <Icon
            icon={type.icon}
            className="h-6 w-6 text-[var(--panel-highlight)]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-minecraft text-3xl lowercase text-white">
            {isDeleted ? "deleted" : server.name}
          </h2>
          <p className="truncate font-minecraft-ten text-base text-white/60">
            {address}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 font-minecraft-ten text-base text-white/70">
        <span className="border border-white/10 bg-black/30 px-2 py-1">
          {type.label}
        </span>
        <span className="border border-white/10 bg-black/30 px-2 py-1">
          {server.mcVersion}
        </span>
        {server.loaderVersion && (
          <span className="border border-white/10 bg-black/30 px-2 py-1">
            {server.loaderVersion}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ServerStatusBadge status={status} />
          {isDeleted ? (
            <span className="border border-red-400/30 bg-red-500/15 px-2 py-1 font-minecraft-ten text-base text-red-200">
              deleted
            </span>
          ) : (
            <TunnelBadge enabled={tunnelEnabled} compact />
          )}
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-white/55 transition hover:text-white"
          onClick={(event) => openContextMenu(event)}
          aria-label="server actions"
        >
          <Icon icon="solar:menu-dots-bold" className="h-5 w-5" />
        </button>
      </div>
      <SettingsContextMenu
        profile={server as unknown as Profile}
        isOpen={menuOpen}
        position={menuPosition}
        items={contextMenuItems}
        onClose={() => setMenuOpen(false)}
        triggerButtonRef={menuButtonRef}
        positionMode="fixed"
      />
    </article>
  );
}

function CustomServerDetails({
  server,
  logs,
  busy,
  onBack,
  onDelete,
  onExport,
  onStart,
  onStop,
  onUpdate,
  versions,
  tunnelEnabled,
  onTunnelChange,
}: {
  server: CustomServer;
  logs: string[];
  busy: boolean;
  onBack: () => void;
  onDelete: () => void;
  onExport: () => void;
  onStart: () => void;
  onStop: () => void;
  onUpdate: (payload: {
    name: string;
    mcVersion: string;
    loaderVersion?: string | null;
    type: ServerType;
    subdomain: string;
    port: number;
  }) => void;
  versions: string[];
  tunnelEnabled: boolean;
  onTunnelChange: (enabled: boolean) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("logs");
  const [editOpen, setEditOpen] = useState(false);
  const [consoleCommand, setConsoleCommand] = useState("");
  const [logLevel, setLogLevel] = useState<ServerLogLevel>("all");
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<CustomServerStats>({
    running: false,
    uptimeSeconds: 0,
    sizeBytes: 0,
    modCount: 0,
  });
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isStopping = logs.slice(-10).join(" ").includes("Stopping server");
  const isRunning = stats.running;
  const isStarting =
    !isRunning &&
    logs.length > 0 &&
    !isStopping &&
    !logs.slice(-5).join(" ").includes("exited");
  const status: ServerRuntimeStatus = isRunning
    ? "online"
    : isStopping
      ? "stopping"
      : isStarting
        ? "starting"
        : "offline";
  const displayAddress = getServerDisplayAddress(server, logs, tunnelEnabled);
  const fallbackAddress = getServerFallbackAddress(server, logs, tunnelEnabled);
  const filteredLogs = logs.filter(
    (line) => logLevel === "all" || getServerLogLevel(line) === logLevel,
  );

  const scrollLogsToBottom = useCallback(() => {
    const container = logContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      invoke<CustomServerStats>("get_custom_server_details_stats", {
        customServer: server,
      })
        .then((nextStats) => {
          if (active) setStats(nextStats);
        })
        .catch(() => undefined);
    };

    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [server._id]);

  useEffect(() => {
    invoke<string[]>("get_custom_server_logs", { serverId: server._id })
      .then((storedLogs) => {
        if (storedLogs.length > 0 && logs.length === 0) {
          window.dispatchEvent(
            new CustomEvent("fullrisk-custom-server-logs-loaded", {
              detail: { serverId: server._id, logs: storedLogs },
            }),
          );
        }
      })
      .catch(() => undefined);
  }, [server._id]);

  useEffect(() => {
    if (tab === "logs" && autoScrollLogs) {
      scrollLogsToBottom();
    }
  }, [autoScrollLogs, filteredLogs.length, scrollLogsToBottom, tab]);

  const copyAddress = async () => {
    await writeText(displayAddress);
    setCopied(true);
    toast.success("Copied to Clipboard");
    window.setTimeout(() => setCopied(false), 1200);
  };

  const sendCommand = async (event: React.FormEvent) => {
    event.preventDefault();
    const command = consoleCommand.trim().replace(/^\//, "");
    if (!command) return;
    setConsoleCommand("");

    try {
      await invoke("execute_rcon_command", {
        serverId: server._id,
        timestamp: `[${new Date().toLocaleTimeString()}]`,
        logType: "CONSOLE",
        command,
      });
    } catch (error) {
      toast.error(serverErrorMessage("Failed to send command", error));
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
      <div className="grid gap-3 border-b border-white/10 pb-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-white/60 transition hover:-translate-x-0.5 hover:text-white"
            onClick={onBack}
            aria-label="back to servers"
          >
            <Icon icon="solar:arrow-left-bold" className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="fullrisk-title min-w-0 flex-1 truncate font-minecraft text-3xl lowercase sm:text-4xl">
                {server.name}
              </h1>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(
                  "group flex min-w-0 max-w-full origin-left cursor-pointer items-center gap-1.5 font-minecraft-ten text-base text-white/55 transition",
                  "hover:scale-[1.03] hover:text-sky-300",
                  copied && "text-sky-300",
                )}
                onClick={copyAddress}
              >
                <span className="min-w-0 truncate">
                  {copied ? "Copied to Clipboard" : displayAddress}
                </span>
                <Icon
                  icon={copied ? "solar:check-circle-bold" : "solar:copy-bold"}
                  className="h-4 w-4 shrink-0 transition group-hover:text-sky-300"
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <div className="flex flex-wrap gap-2 xl:order-first">
            {(["logs", "addons", "world", "overview", "settings"] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "min-w-0 overflow-hidden border border-white/10 bg-black/25 px-3 py-2 font-minecraft text-xl lowercase text-white/55 transition sm:px-4 sm:text-2xl",
                    tab === item &&
                      "border-[var(--panel-highlight)] text-white",
                  )}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isRunning || isStarting ? (
              <Button
                variant="flat-secondary"
                size="sm"
                disabled={busy}
                icon={
                  <Icon icon="solar:stop-circle-bold" className="h-5 w-5" />
                }
                onClick={onStop}
              >
                stop
              </Button>
            ) : (
              <Button
                variant="3d"
                size="sm"
                disabled={busy}
                icon={
                  <Icon icon="solar:play-circle-bold" className="h-5 w-5" />
                }
                onClick={onStart}
              >
                start
              </Button>
            )}
            <ServerStatusBadge status={status} />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "logs" && (
          <div className="flex h-full flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {(["all", "info", "warn", "error", "debug"] as const).map(
                  (level) => (
                    <button
                      key={level}
                      type="button"
                      className={cn(
                        "border border-white/10 bg-black/25 px-3 py-1.5 font-minecraft-ten text-base lowercase text-white/55 transition",
                        logLevel === level &&
                          "border-[var(--panel-highlight)] text-white",
                      )}
                      onClick={() => setLogLevel(level)}
                    >
                      {level}
                    </button>
                  ),
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2 border px-3 py-1.5 font-minecraft-ten text-base lowercase transition",
                    autoScrollLogs
                      ? "border-[var(--panel-highlight)] bg-white/10 text-white"
                      : "border-white/10 bg-black/25 text-white/55 hover:text-white",
                  )}
                  onClick={() => {
                    setAutoScrollLogs(true);
                    window.requestAnimationFrame(scrollLogsToBottom);
                  }}
                >
                  <Icon
                    icon="solar:double-alt-arrow-down-bold"
                    className="h-4 w-4"
                  />
                  autoscroll
                </button>
                <p className="font-minecraft-ten text-base text-white/45">
                  {filteredLogs.length}/{logs.length} lines
                </p>
              </div>
            </div>
            <div
              ref={logContainerRef}
              className="min-h-0 flex-1 overflow-y-auto border border-white/10 bg-black/40 p-3 text-left font-mono text-xs leading-5 text-white/75 custom-scrollbar"
              onScroll={(event) => {
                const target = event.currentTarget;
                const distanceFromBottom =
                  target.scrollHeight - target.scrollTop - target.clientHeight;
                if (distanceFromBottom > 48) {
                  setAutoScrollLogs(false);
                }
              }}
            >
              {filteredLogs.length > 0 ? (
                filteredLogs.map((line, index) => (
                  <p
                    key={`${line}-${index}`}
                    className={cn(
                      "mb-1 break-words leading-5",
                      getServerLogColor(line),
                    )}
                  >
                    {line}
                  </p>
                ))
              ) : (
                <div className="py-2 font-minecraft-ten text-base text-white/45">
                  no logs yet
                </div>
              )}
            </div>
            <form onSubmit={sendCommand}>
              <Input
                value={consoleCommand}
                disabled={!isRunning}
                onChange={(event) => setConsoleCommand(event.target.value)}
                placeholder={
                  isRunning
                    ? "console command"
                    : "start the server to use console"
                }
                icon={<Icon icon="solar:terminal-bold" className="h-5 w-5" />}
              />
            </form>
          </div>
        )}

        {tab === "overview" && (
          <div className="grid max-h-full gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 custom-scrollbar">
            <InfoTile label="name" value={server.name} />
            <InfoTile label="address" value={displayAddress} />
            <InfoTile label="fallback address" value={fallbackAddress} />
            <InfoTile label="minecraft" value={server.mcVersion} />
            <InfoTile label="type" value={server.type} />
            <InfoTile label="loader" value={server.loaderVersion || "none"} />
            <InfoTile label="local port" value={String(server.port || 25565)} />
            <InfoTile
              label="runtime"
              value={formatUptime(stats.uptimeSeconds)}
            />
            <InfoTile label="size" value={formatBytes(stats.sizeBytes)} />
            <InfoTile label="addons" value={String(stats.modCount)} />
            <InfoTile
              label="created"
              value={new Date(server.createdAt * 1000).toLocaleDateString()}
            />
            <InfoTile label="status" value={status} />
          </div>
        )}

        {tab === "settings" && (
          <ServerSettingsPanel
            server={server}
            tunnelEnabled={tunnelEnabled}
            tunnelLocked={isRunning || isStarting || busy}
            onTunnelChange={onTunnelChange}
            onEdit={() => setEditOpen(true)}
            onExport={onExport}
            onDelete={onDelete}
          />
        )}

        {tab === "addons" && (
          <ServerAddonsPanel
            server={server}
            onChanged={() => {
              invoke<CustomServerStats>("get_custom_server_details_stats", {
                customServer: server,
              })
                .then(setStats)
                .catch(() => undefined);
            }}
          />
        )}

        {tab === "world" && <ServerWorldPanel server={server} />}
      </div>
      <EditCustomServerModal
        open={editOpen}
        server={server}
        baseUrl={server.domain}
        versions={versions}
        onClose={() => setEditOpen(false)}
        onSave={(payload) => {
          onUpdate(payload);
          setEditOpen(false);
        }}
      />
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function getServerDisplayAddress(
  server: CustomServer,
  _logs: string[],
  _tunnelEnabled: boolean,
) {
  return `${server.subdomain}.${server.domain}`;
}

function getServerFallbackAddress(
  server: CustomServer,
  logs: string[],
  tunnelEnabled: boolean,
) {
  const host = `${server.subdomain}.${server.domain}`;
  const forwardingPort =
    server.forwarding?.publicPort ?? server.forwarding?.port ?? null;
  if (tunnelEnabled && forwardingPort) {
    return `${host}:${forwardingPort}`;
  }

  const latestForwardingLog = [...logs]
    .reverse()
    .find((line) => line.includes("Forwarding online at "));
  const loggedAddress = latestForwardingLog
    ?.match(/Forwarding online at\s+(.+)$/)?.[1]
    ?.trim();
  if (tunnelEnabled && loggedAddress) {
    return loggedAddress;
  }

  return `${host}:${server.port || 25565}`;
}

function getServerLogLevel(line: string): Exclude<ServerLogLevel, "all"> {
  const upper = line.toUpperCase();
  if (
    upper.includes("[ERROR]") ||
    upper.includes("/ERROR]") ||
    upper.includes("FATAL") ||
    upper.includes("SEVERE")
  ) {
    return "error";
  }
  if (
    upper.includes("[WARN]") ||
    upper.includes("/WARN]") ||
    upper.includes("WARNING")
  ) {
    return "warn";
  }
  if (
    upper.includes("[DEBUG]") ||
    upper.includes("/DEBUG]") ||
    upper.includes("TRACE")
  ) {
    return "debug";
  }
  if (
    upper.includes("[CONSOLE]") ||
    upper.includes("CONSOLE:") ||
    upper.trim().startsWith(">")
  ) {
    return "console";
  }
  return "info";
}

function getServerLogColor(line: string) {
  switch (getServerLogLevel(line)) {
    case "error":
      return "text-red-300";
    case "warn":
      return "text-amber-200";
    case "debug":
      return "text-sky-200/80";
    case "console":
      return "text-emerald-200";
    default:
      return "text-white/75";
  }
}

function formatUptime(seconds: number) {
  if (seconds <= 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : "", `${rest}s`]
    .filter(Boolean)
    .join(" ");
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-white/10 bg-black/30 p-3 sm:p-4">
      <p className="truncate font-minecraft text-xl lowercase text-white/45 sm:text-2xl">
        {label}
      </p>
      <p className="mt-2 break-words font-minecraft-ten text-lg text-white">
        {value}
      </p>
    </div>
  );
}

function getRuntimeStatus(
  stats: CustomServerStats | undefined,
  logs: string[],
  busy: boolean,
): ServerRuntimeStatus {
  if (stats?.running) {
    return "online";
  }

  const recentLogs = logs.slice(-10).join(" ").toLowerCase();
  if (recentLogs.includes("stopping server")) {
    return "stopping";
  }

  if (
    busy ||
    (logs.length > 0 &&
      !recentLogs.includes("exited") &&
      !recentLogs.includes("[error]"))
  ) {
    return "starting";
  }

  return "offline";
}

function ServerStatusBadge({ status }: { status: ServerRuntimeStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 border px-2 py-1 font-minecraft-ten text-base lowercase",
        status === "online" &&
          "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
        status === "starting" &&
          "border-amber-400/50 bg-amber-500/15 text-amber-200",
        status === "stopping" &&
          "border-orange-400/50 bg-orange-500/15 text-orange-200",
        status === "offline" && "border-red-400/50 bg-red-500/15 text-red-200",
      )}
    >
      {status}
    </span>
  );
}

function TunnelBadge({
  enabled,
  compact = false,
}: {
  enabled: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "shrink-0 border font-minecraft-ten lowercase",
        compact ? "px-2 py-1 text-base" : "px-2 py-1 text-base",
        enabled
          ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
          : "border-white/15 bg-black/25 text-white/55",
      )}
    >
      tunnel {enabled ? "on" : "off"}
    </span>
  );
}

function ServerSafetyInfoModalV2({
  open,
  forced,
  onClose,
  onAccept,
}: {
  open: boolean;
  forced: boolean;
  onClose: () => void;
  onAccept: () => void;
}) {
  if (!open) return null;

  const authItems = [
    "Custom-Server requests use a short-lived FullRisk session token. Your Minecraft access token is sent only to Mojang's Sessionserver.",
    "FullRisk verifies that the Minecraft account matches the requested UUID",
  ];
  const storedItems = [
    "Minecraft UUID and username",
    "server details (name, version, type, subdomain, port)",
    "ONLY when Direct mode is used: current public IP",
    "temporary tunnel/session metadata while forwarding is active",
    "request logs for debugging, abuse prevention and failed starts",
  ];
  const notStoredItems = [
    "NoRisk token",
    "Minecraft access token",
    "world files or local server files",
    "Minecraft chat contents",
    "RCON command database",
  ];

  return (
    <Modal
      onClose={forced ? () => undefined : onClose}
      title="server info"
      width="lg"
      contentClassName="space-y-5 px-7 py-6"
    >
      <div className="space-y-4 font-minecraft-ten text-lg leading-relaxed text-white/75">
        <div className="border border-amber-400/45 bg-amber-500/15 px-4 py-3">
          <h2 className="font-minecraft text-5xl lowercase text-amber-100">
            attention
          </h2>
          <p className="mt-2 text-amber-50/85">
            Forwarding sends Minecraft connections through FullRisk
            infrastructure. In tunnel mode other players do not see your home
            IP, but our backend must handle the connection while your server is
            online.
          </p>
        </div>

        <div className="grid gap-3 text-base leading-relaxed md:grid-cols-2">
          <InfoBox title="auth">
            <ul className="space-y-1">
              {authItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </InfoBox>

          <InfoBox title="ip privacy">
            (Default) Tunnel on: <br />
            players connect to the FullRisk address and do not see your IP
            address.
            <br /> Tunnel off: <br />
            DNS points to your IP address, and is re-detected on every server
            start.
          </InfoBox>

          <InfoBox title="stored data">
            <ul className="space-y-1">
              {storedItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </InfoBox>

          <InfoBox title="not stored">
            <ul className="space-y-1">
              {notStoredItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </InfoBox>

          <InfoBox title="when active">
            The tunnel is active only while your server is running. If tunnel
            mode is enabled and forwarding cannot be created, the start fails
            instead of silently falling back to Direct mode.
          </InfoBox>

          <InfoBox title="operator access">
            Backend access is limited to the service operator (SirKnubble). Data
            is used for operating the service, support and abuse prevention; it
            is not sold, published or used to access your Minecraft account.
          </InfoBox>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {!forced && (
          <Button variant="flat-secondary" size="sm" onClick={onClose}>
            close
          </Button>
        )}
        <Button variant="3d" size="sm" onClick={onAccept}>
          understood
        </Button>
      </div>
    </Modal>
  );
}

function InfoBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-black/25 p-3">
      <h3 className="font-minecraft text-2xl lowercase text-white">{title}</h3>
      <div className="mt-2 font-minecraft-ten text-base leading-relaxed text-white/65">
        {children}
      </div>
    </div>
  );
}

function ServerSettingsPanel({
  server,
  tunnelEnabled,
  tunnelLocked,
  onTunnelChange,
  onEdit,
  onExport,
  onDelete,
}: {
  server: CustomServer;
  tunnelEnabled: boolean;
  tunnelLocked: boolean;
  onTunnelChange: (enabled: boolean) => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsActionBox
          icon={
            tunnelEnabled
              ? "solar:shield-check-bold"
              : "solar:shield-cross-bold"
          }
          buttonText={tunnelEnabled ? "Tunnel On" : "Tunnel Off"}
          description={
            tunnelLocked
              ? "Stop the server before changing public forwarding."
              : "Controls whether friends connect through the FullRisk tunnel."
          }
          disabled={tunnelLocked}
          active={tunnelEnabled}
          tone="tunnel"
          onClick={() => onTunnelChange(!tunnelEnabled)}
        />
        <SettingsActionBox
          icon="solar:pen-new-square-bold"
          buttonText="Edit Server"
          description="Change name, subdomain, Minecraft version, type and local port."
          onClick={onEdit}
        />
        <SettingsActionBox
          icon="solar:archive-up-bold"
          buttonText="Export Server"
          description="Create a portable archive of this server folder and its files."
          onClick={onExport}
        />
        <SettingsActionBox
          icon="solar:trash-bin-trash-bold"
          buttonText="Delete Server"
          description="Remove this server entry and its FullRisk DNS records."
          destructive
          onClick={onDelete}
        />
      </div>

      <div className="border border-white/10 bg-black/25 p-4">
        <div className="mb-4 text-center">
          <h3 className="font-minecraft text-3xl lowercase text-white">
            server config
          </h3>
          <p className="font-minecraft-ten text-base text-white/45">
            Writes common values to server.properties.
          </p>
        </div>
        <ServerConfigPanel server={server} embedded />
      </div>
    </div>
  );
}

function SettingsActionBox({
  icon,
  buttonText,
  description,
  active,
  destructive,
  tone,
  disabled,
  onClick,
}: {
  icon: string;
  buttonText: string;
  description: string;
  active?: boolean;
  destructive?: boolean;
  tone?: "tunnel";
  disabled?: boolean;
  onClick: () => void;
}) {
  const actionStyle =
    tone === "tunnel"
      ? active
        ? {
            backgroundColor: "rgba(16, 185, 129, 0.35)",
            borderColor: "rgba(110, 231, 183, 0.75)",
            borderBottomColor: "rgb(6, 95, 70)",
          }
        : {
            backgroundColor: "rgba(244, 63, 94, 0.22)",
            borderColor: "rgba(251, 113, 133, 0.55)",
            borderBottomColor: "rgb(159, 18, 57)",
          }
      : destructive
        ? {
            backgroundColor: "rgba(190, 18, 60, 0.45)",
            borderColor: "rgba(248, 113, 113, 0.75)",
            borderBottomColor: "rgb(127, 29, 29)",
          }
        : undefined;

  return (
    <div className="flex min-h-36 flex-col items-center gap-3 border border-white/10 bg-black/25 p-3 text-center">
      <Button
        variant={active ? "3d" : "flat-secondary"}
        size="xs"
        disabled={disabled}
        className={cn((destructive || tone === "tunnel") && "!text-white")}
        icon={<Icon icon={icon} className="h-4 w-4" />}
        style={actionStyle}
        onClick={onClick}
      >
        {buttonText}
      </Button>
      <p className="font-minecraft-ten text-base leading-relaxed text-white/55">
        {description}
      </p>
    </div>
  );
}

function ServerConfigPanel({
  server,
  embedded = false,
}: {
  server: CustomServer;
  embedded?: boolean;
}) {
  const [properties, setProperties] = useState<CustomServerProperties | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<CustomServerProperties>("get_custom_server_properties", {
      customServer: server,
    })
      .then(setProperties)
      .catch((error) =>
        toast.error(serverErrorMessage("Failed to load server config", error)),
      );
  }, [server]);

  const update = <K extends keyof CustomServerProperties>(
    key: K,
    value: CustomServerProperties[K],
  ) => {
    setProperties((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const save = async () => {
    if (!properties) return;
    setSaving(true);
    try {
      await invoke("update_custom_server_properties", {
        customServer: server,
        properties,
      });
      toast.success("server config saved");
    } catch (error) {
      toast.error(serverErrorMessage("Failed to save server config", error));
    } finally {
      setSaving(false);
    }
  };

  if (!properties) {
    return (
      <div className="flex h-full items-center justify-center font-minecraft-ten text-lg text-white/45">
        loading config...
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-4",
        !embedded && "h-full overflow-y-auto pr-1 custom-scrollbar",
      )}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="motd">
          <Input
            value={properties.motd}
            onChange={(event) => update("motd", event.target.value)}
            icon={<Icon icon="solar:chat-round-bold" className="h-5 w-5" />}
          />
        </Field>
        <NumberField
          label="max players"
          value={properties.maxPlayers}
          min={1}
          max={500}
          onChange={(value) => update("maxPlayers", value)}
        />
        <Field label="difficulty">
          <Select
            value={properties.difficulty}
            onChange={(value) => update("difficulty", value)}
            variant="3d"
            options={["peaceful", "easy", "normal", "hard"].map((value) => ({
              value,
              label: value,
            }))}
          />
        </Field>
        <Field label="gamemode">
          <Select
            value={properties.gamemode}
            onChange={(value) => update("gamemode", value)}
            variant="3d"
            options={["survival", "creative", "adventure", "spectator"].map(
              (value) => ({ value, label: value }),
            )}
          />
        </Field>
        <NumberField
          label="view distance"
          value={properties.viewDistance}
          min={2}
          max={32}
          onChange={(value) => update("viewDistance", value)}
        />
        <NumberField
          label="simulation distance"
          value={properties.simulationDistance}
          min={2}
          max={32}
          onChange={(value) => update("simulationDistance", value)}
        />
        <NumberField
          label="spawn protection"
          value={properties.spawnProtection}
          min={0}
          max={64}
          onChange={(value) => update("spawnProtection", value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ToggleField
          label="online mode"
          checked={properties.onlineMode}
          onChange={(checked) => update("onlineMode", checked)}
        />
        <ToggleField
          label="pvp"
          checked={properties.pvp}
          onChange={(checked) => update("pvp", checked)}
        />
        <ToggleField
          label="allow flight"
          checked={properties.allowFlight}
          onChange={(checked) => update("allowFlight", checked)}
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="3d"
          size="sm"
          disabled={saving}
          icon={<Icon icon="solar:diskette-bold" className="h-5 w-5" />}
          onClick={save}
        >
          {saving ? "saving" : "save config"}
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        value={String(value)}
        inputMode="numeric"
        onChange={(event) => {
          const next = Number(event.target.value.replace(/[^0-9]/g, ""));
          onChange(
            Math.min(max, Math.max(min, Number.isFinite(next) ? next : min)),
          );
        }}
        icon={<Icon icon="solar:hashtag-bold" className="h-5 w-5" />}
      />
    </Field>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-between border px-4 py-3 font-minecraft-ten text-base transition",
        checked
          ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
          : "border-white/10 bg-black/30 text-white/55",
      )}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <Icon
        icon={checked ? "solar:check-circle-bold" : "solar:close-circle-bold"}
        className="h-5 w-5"
      />
    </button>
  );
}

function ServerWorldPanel({ server }: { server: CustomServer }) {
  const [folder, setFolder] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<ServerFileTreeEntry[]>([]);
  const [worlds, setWorlds] = useState<CustomServerWorldInfo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileWorlds, setProfileWorlds] = useState<WorldInfo[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedWorldFolder, setSelectedWorldFolder] = useState("");
  const [selectedExportProfileId, setSelectedExportProfileId] = useState("");
  const [worldAction, setWorldAction] = useState<string | null>(null);

  const loadFiles = useCallback(() => {
    invoke<ServerFileTreeEntry[]>("list_custom_server_files", {
      customServer: server,
    })
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [server]);

  const loadWorlds = useCallback(() => {
    invoke<CustomServerWorldInfo[]>("list_custom_server_worlds", {
      customServer: server,
    })
      .then(setWorlds)
      .catch(() => setWorlds([]));
  }, [server]);

  useEffect(() => {
    invoke<string>("get_custom_server_folder", { customServer: server })
      .then(setFolder)
      .catch(() => setFolder(""));
    loadFiles();
    loadWorlds();
  }, [server, loadFiles, loadWorlds]);

  useEffect(() => {
    getAllProfilesAndLastPlayed()
      .then((result) => {
        setProfiles(result.all_profiles ?? []);
        const firstProfile =
          result.last_played_profile_id || result.all_profiles?.[0]?.id || "";
        setSelectedProfileId(firstProfile);
        setSelectedExportProfileId(firstProfile);
      })
      .catch(() => setProfiles([]));
  }, []);

  useEffect(() => {
    if (!selectedProfileId) {
      setProfileWorlds([]);
      setSelectedWorldFolder("");
      return;
    }
    getWorldsForProfile(selectedProfileId)
      .then((nextWorlds) => {
        setProfileWorlds(nextWorlds);
        setSelectedWorldFolder(nextWorlds[0]?.folder_name ?? "");
      })
      .catch(() => {
        setProfileWorlds([]);
        setSelectedWorldFolder("");
      });
  }, [selectedProfileId]);

  const refreshWorldView = () => {
    loadFiles();
    loadWorlds();
  };

  const openServerPath = async (path: string) => {
    try {
      await invoke("open_custom_server_path", { customServer: server, path });
    } catch (error) {
      toast.error(serverErrorMessage("Failed to open path", error));
    }
  };

  const openFolder = async () => {
    try {
      await invoke("open_custom_server_folder", { customServer: server });
    } catch (error) {
      toast.error(serverErrorMessage("Failed to open server folder", error));
    }
  };

  const importWorld = async (sourcePath: string) => {
    if (!sourcePath) return;
    setImporting(true);
    try {
      await invoke("import_custom_server_world", {
        customServer: server,
        sourcePath,
      });
      toast.success("world imported");
      refreshWorldView();
    } catch (error) {
      toast.error(serverErrorMessage("Failed to import world", error));
    } finally {
      setImporting(false);
    }
  };

  const pickWorldFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "select world folder",
      });
      const sourcePath = Array.isArray(selected) ? selected[0] : selected;
      if (typeof sourcePath === "string") {
        await importWorld(sourcePath);
      }
    } catch (error) {
      toast.error(serverErrorMessage("Failed to select world", error));
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0] as File & { path?: string };
    if (!file?.path) {
      toast.error("drop a world folder from your file manager");
      return;
    }
    await importWorld(file.path);
  };

  const importFromProfile = async () => {
    if (!selectedProfileId || !selectedWorldFolder) return;
    setWorldAction("import-profile");
    try {
      await invoke("import_custom_server_world_from_profile", {
        customServer: server,
        profileId: selectedProfileId,
        worldFolder: selectedWorldFolder,
      });
      toast.success("world imported from profile");
      refreshWorldView();
    } catch (error) {
      toast.error(serverErrorMessage("Failed to import from profile", error));
    } finally {
      setWorldAction(null);
    }
  };

  const backupWorld = async (world: CustomServerWorldInfo) => {
    setWorldAction(`backup-${world.folderName}`);
    try {
      await invoke<string>("backup_custom_server_world", {
        customServer: server,
        worldFolder: world.folderName,
      });
      toast.success("world backup created");
      refreshWorldView();
    } catch (error) {
      toast.error(serverErrorMessage("Failed to backup world", error));
    } finally {
      setWorldAction(null);
    }
  };

  const exportToProfile = async (world: CustomServerWorldInfo) => {
    if (!selectedExportProfileId) return;
    setWorldAction(`export-${world.folderName}`);
    try {
      await importWorldToProfile(
        selectedExportProfileId,
        world.path,
        world.displayName || world.folderName,
      );
      toast.success("world exported to profile");
    } catch (error) {
      toast.error(serverErrorMessage("Failed to export world", error));
    } finally {
      setWorldAction(null);
    }
  };

  return (
    <div className="grid h-full gap-3 overflow-y-auto pr-1 custom-scrollbar xl:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
      <div
        className={cn(
          "border border-white/10 bg-black/30 p-4 transition",
          dragActive && "border-[var(--panel-highlight)] bg-white/10",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <h2 className="font-minecraft text-3xl lowercase text-white">world</h2>
        <p className="mt-2 font-minecraft-ten text-lg text-white/60">
          Drop a world folder here or import one with the picker. Existing
          server world data is backed up before replacing it.
        </p>
        <div className="mt-4 break-all border border-white/10 bg-black/35 p-3 font-mono text-xs text-white/70">
          {folder || "loading folder..."}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="3d"
            size="sm"
            icon={<Icon icon="solar:folder-open-bold" className="h-5 w-5" />}
            onClick={openFolder}
          >
            open folder
          </Button>
          <Button
            variant="flat-secondary"
            size="sm"
            disabled={importing}
            icon={<Icon icon="solar:upload-bold" className="h-5 w-5" />}
            onClick={pickWorldFolder}
          >
            {importing ? "importing" : "import world"}
          </Button>
        </div>
        <div className="mt-4 flex min-h-24 items-center justify-center border border-dashed border-white/15 bg-black/20 px-4 text-center font-minecraft-ten text-base text-white/45">
          drag and drop a world folder
        </div>

        <div className="mt-4 space-y-3">
          <h3 className="font-minecraft text-2xl lowercase text-white/80">
            worlds
          </h3>
          {worlds.length > 0 ? (
            worlds.map((world) => (
              <div
                key={world.path}
                className="border border-white/10 bg-black/25 p-3"
              >
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center gap-2 text-left"
                  onClick={() => openServerPath(world.path)}
                >
                  <Icon
                    icon="solar:map-point-wave-bold"
                    className="h-5 w-5 shrink-0 text-[var(--panel-highlight)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-minecraft-ten text-base text-white">
                      {world.displayName}
                    </p>
                    <p className="truncate font-minecraft-ten text-sm text-white/45">
                      {formatBytes(world.sizeBytes)}
                      {world.gameDay != null ? ` · day ${world.gameDay}` : ""}
                      {world.versionName ? ` · ${world.versionName}` : ""}
                    </p>
                  </div>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="flat-secondary"
                    size="xs"
                    disabled={worldAction === `backup-${world.folderName}`}
                    onClick={() => backupWorld(world)}
                  >
                    backup
                  </Button>
                  <Button
                    variant="flat-secondary"
                    size="xs"
                    disabled={
                      !selectedExportProfileId ||
                      worldAction === `export-${world.folderName}`
                    }
                    onClick={() => exportToProfile(world)}
                  >
                    export to profile
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="font-minecraft-ten text-base text-white/45">
              no imported world yet
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-3 border border-white/10 bg-black/25 p-3 md:grid-cols-2">
          <Field label="profile">
            <Select
              value={selectedProfileId}
              onChange={setSelectedProfileId}
              variant="3d"
              options={profiles.map((profile) => ({
                value: profile.id,
                label: profile.name,
              }))}
            />
          </Field>
          <Field label="profile world">
            <Select
              value={selectedWorldFolder}
              onChange={setSelectedWorldFolder}
              variant="3d"
              options={profileWorlds.map((world) => ({
                value: world.folder_name,
                label: world.display_name || world.folder_name,
              }))}
            />
          </Field>
          <div className="md:col-span-2">
            <Button
              variant="3d"
              size="sm"
              disabled={
                !selectedProfileId ||
                !selectedWorldFolder ||
                worldAction === "import-profile"
              }
              icon={<Icon icon="solar:download-bold" className="h-5 w-5" />}
              onClick={importFromProfile}
            >
              import from profile
            </Button>
          </div>
        </div>

        <div className="mt-4 border border-white/10 bg-black/25 p-3">
          <Field label="export target">
            <Select
              value={selectedExportProfileId}
              onChange={setSelectedExportProfileId}
              variant="3d"
              options={profiles.map((profile) => ({
                value: profile.id,
                label: profile.name,
              }))}
            />
          </Field>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto border border-white/10 bg-black/30 p-4 custom-scrollbar">
        <h3 className="font-minecraft text-2xl lowercase text-white/80">
          files
        </h3>
        <div className="mt-3 font-minecraft-ten text-base text-white/65">
          {files.length > 0 ? (
            files.map((entry) => (
              <FileTreeEntry
                key={entry.path}
                entry={entry}
                onOpen={openServerPath}
              />
            ))
          ) : (
            <p className="text-white/45">folder is empty</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FileTreeEntry({
  entry,
  depth = 0,
  onOpen,
}: {
  entry: ServerFileTreeEntry;
  depth?: number;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 py-1 text-left transition hover:text-white"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => {
          if (entry.isDir) {
            setOpen((current) => !current);
          }
          onOpen(entry.path);
        }}
      >
        <Icon
          icon={
            entry.isDir
              ? open
                ? "solar:folder-open-bold"
                : "solar:folder-bold"
              : "solar:file-bold"
          }
          className="h-4 w-4 shrink-0 text-white/45"
        />
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        <span className="shrink-0 text-sm text-white/35">
          {formatBytes(entry.sizeBytes)}
        </span>
      </button>
      {entry.isDir && open && entry.children.length > 0 && (
        <div>
          {entry.children.map((child) => (
            <FileTreeEntry
              key={child.path}
              entry={child}
              depth={depth + 1}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServerAddonsPanel({
  server,
  onChanged,
}: {
  server: CustomServer;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ContentProvider>("modrinth");
  const [results, setResults] = useState<UnifiedModSearchResult[]>([]);
  const [versions, setVersions] = useState<Record<string, UnifiedVersion[]>>(
    {},
  );
  const [installed, setInstalled] = useState<InstalledServerAddon[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const loader = getModrinthLoader(server.type);
  const supportsMods = Boolean(loader);
  const providerLabel = getProviderMeta(provider).label;

  const loadInstalled = useCallback(() => {
    invoke<InstalledServerAddon[]>("list_installed_server_addons", {
      customServer: server,
    })
      .then(setInstalled)
      .catch(() => setInstalled([]));
  }, [server]);

  useEffect(() => {
    loadInstalled();
  }, [loadInstalled]);

  const search = useCallback(async () => {
    if (!supportsMods) return;
    setLoading(true);
    try {
      const response = await UnifiedService.searchMods({
        query,
        source: getProviderMeta(provider).platform,
        project_type: UnifiedProjectType.Mod,
        game_version: server.mcVersion,
        mod_loaders: loader ? [loader] : undefined,
        limit: 20,
        offset: 0,
        sort: UnifiedSortType.Relevance,
        server_side_filter: "required",
      });
      setResults(
        response.results.filter((hit) => hit.server_side !== "unsupported"),
      );
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to search server addons", error));
    } finally {
      setLoading(false);
    }
  }, [loader, provider, query, server.mcVersion, supportsMods]);

  useEffect(() => {
    search();
  }, [search]);

  const loadVersions = async (hit: UnifiedModSearchResult) => {
    if (versions[hit.project_id]) return;
    try {
      const response = await UnifiedService.getModVersions({
        source: hit.source,
        project_id: hit.project_id,
        loaders: loader ? [loader] : undefined,
        game_versions: [server.mcVersion],
      });
      setVersions((current) => ({
        ...current,
        [hit.project_id]: response.versions,
      }));
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to load versions", error));
    }
  };

  const install = async (
    hit: UnifiedModSearchResult,
    version: UnifiedVersion,
  ) => {
    const file = version.files.find((item) => item.primary) ?? version.files[0];
    if (!file) {
      toast.error("no downloadable file found");
      return;
    }

    setInstalling(version.id);
    try {
      await invoke("install_modrinth_server_addon", {
        customServer: server,
        fileName: file.filename,
        downloadUrl: file.url,
      });
      toast.success(`${hit.title} installed`);
      loadInstalled();
      onChanged();
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to install addon", error));
    } finally {
      setInstalling(null);
    }
  };

  if (!supportsMods) {
    return (
      <div className="flex h-full items-center justify-center text-center font-minecraft-ten text-lg text-white/55">
        server-side addons need a modded/plugin server type like fabric, forge,
        neoforge, quilt, paper, spigot, bukkit, folia or purpur
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Server-Side Mods on ${providerLabel}`}
            size="sm"
            icon={<Icon icon="solar:magnifer-bold" className="h-5 w-5" />}
            onKeyDown={(event) => {
              if (event.key === "Enter") search();
            }}
          />
          <Button
            variant="flat-secondary"
            size="sm"
            className="shrink-0"
            disabled={loading}
            onClick={search}
          >
            {loading ? "Searching" : "Search"}
          </Button>
          <ProviderSwitch
            provider={provider}
            onChange={(nextProvider) => {
              setProvider(nextProvider);
              setVersions({});
            }}
          />
        </div>
        <div className="border border-white/10 bg-black/30 px-3 py-2 font-minecraft-ten text-base text-white/65">
          {installed.length} installed
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
        <div className="min-h-0 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="font-minecraft-ten text-lg text-white/50">
              loading...
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((hit) => {
                const loadedVersions = versions[hit.project_id] ?? [];
                return (
                  <div
                    key={hit.project_id}
                    className="border border-white/10 bg-black/30 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      {hit.icon_url ? (
                        <img
                          src={hit.icon_url}
                          alt=""
                          className="h-12 w-12 border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-black/40">
                          <Icon
                            icon="solar:box-bold"
                            className="h-6 w-6 text-white/60"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-minecraft text-2xl lowercase text-white">
                          {hit.title}
                        </h3>
                        <p className="line-clamp-2 font-minecraft-ten text-base text-white/55">
                          {hit.description}
                        </p>
                      </div>
                      <Button
                        variant="flat-secondary"
                        size="xs"
                        className="shrink-0"
                        onClick={() => loadVersions(hit)}
                      >
                        versions
                      </Button>
                    </div>
                    {loadedVersions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {loadedVersions.slice(0, 5).map((version) => (
                          <div
                            key={version.id}
                            className="flex flex-col gap-3 border border-white/10 bg-black/25 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-minecraft-ten text-base text-white">
                                {version.name}
                              </p>
                              <p className="font-minecraft-ten text-sm text-white/45">
                                {version.version_number}
                              </p>
                            </div>
                            <Button
                              variant="3d"
                              size="xs"
                              disabled={installing === version.id}
                              onClick={() => install(hit, version)}
                            >
                              {installing === version.id
                                ? "installing"
                                : "install"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {results.length === 0 && (
                <div className="font-minecraft-ten text-lg text-white/45">
                  no server-side mods found
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto border border-white/10 bg-black/30 p-3 custom-scrollbar">
          <h3 className="font-minecraft text-2xl lowercase text-white">
            installed
          </h3>
          <div className="mt-3 space-y-2">
            {installed.map((addon) => (
              <div
                key={addon.fileName}
                className="border border-white/10 bg-black/25 p-2"
              >
                <p className="break-words font-minecraft-ten text-base text-white">
                  {addon.fileName}
                </p>
                <p className="font-minecraft-ten text-sm text-white/45">
                  {formatBytes(addon.sizeBytes)}
                </p>
              </div>
            ))}
            {installed.length === 0 && (
              <p className="font-minecraft-ten text-base text-white/45">
                no addons installed
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getModrinthLoader(type: ServerType) {
  switch (type) {
    case "FABRIC":
      return "fabric";
    case "FORGE":
      return "forge";
    case "NEO_FORGE":
      return "neoforge";
    case "QUILT":
      return "quilt";
    case "PAPER":
      return "paper";
    case "SPIGOT":
      return "spigot";
    case "BUKKIT":
      return "bukkit";
    case "FOLIA":
      return "folia";
    case "PURPUR":
      return "purpur";
    default:
      return "";
  }
}

function getProviderMeta(provider: ContentProvider) {
  return provider === "modrinth"
    ? {
        label: "Modrinth",
        icon: "simple-icons:modrinth",
        platform: ModPlatform.Modrinth,
      }
    : {
        label: "CurseForge",
        icon: "simple-icons:curseforge",
        platform: ModPlatform.CurseForge,
      };
}

function ProviderSwitch({
  provider,
  onChange,
}: {
  provider: ContentProvider;
  onChange: (provider: ContentProvider) => void;
}) {
  const meta = getProviderMeta(provider);
  const isCurseForge = provider === "curseforge";
  const inactiveMeta = getProviderMeta(
    isCurseForge ? "modrinth" : "curseforge",
  );

  return (
    <button
      type="button"
      className={cn(
        "relative h-9 w-16 shrink-0 overflow-hidden border border-white/10 bg-[var(--accent-color)]/20 p-0.5 transition hover:border-white/20",
        "rounded-[var(--border-radius)]",
      )}
      onClick={() => onChange(isCurseForge ? "modrinth" : "curseforge")}
      title={meta.label}
      aria-label={`Switch content source. Current source: ${meta.label}`}
    >
      <span
        className={cn(
          "absolute inset-y-0 flex w-1/2 items-center justify-center text-white/25 transition-colors",
          isCurseForge ? "left-0" : "right-0",
        )}
      >
        <Icon icon={inactiveMeta.icon} className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "absolute inset-y-0.5 left-0.5 flex w-8 items-center justify-center border transition-transform duration-200",
          "rounded-[calc(var(--border-radius)-2px)]",
          isCurseForge
            ? "translate-x-7 border-orange-200/70 bg-orange-500 text-white"
            : "translate-x-0 border-emerald-200/70 bg-emerald-500 text-white",
        )}
      >
        <Icon icon={meta.icon} className="h-5 w-5" />
      </span>
      <span className="sr-only">{meta.label}</span>
    </button>
  );
}

function serverTypeFromModrinthLoader(loader: string): ServerType {
  switch (loader.toLowerCase()) {
    case "fabric":
      return "FABRIC";
    case "forge":
      return "FORGE";
    case "neoforge":
      return "NEO_FORGE";
    case "quilt":
      return "QUILT";
    case "paper":
      return "PAPER";
    case "spigot":
      return "SPIGOT";
    case "bukkit":
      return "BUKKIT";
    case "folia":
      return "FOLIA";
    case "purpur":
      return "PURPUR";
    default:
      return "VANILLA";
  }
}

function pickUnifiedServerVersion(versions: UnifiedVersion[]) {
  const supportedLoaders = [
    "fabric",
    "forge",
    "neoforge",
    "quilt",
    "paper",
    "spigot",
    "bukkit",
    "folia",
    "purpur",
  ];
  return (
    versions.find((version) =>
      version.loaders.some((loader) =>
        supportedLoaders.includes(loader.toLowerCase()),
      ),
    ) ??
    versions.find((version) => version.game_versions.length > 0) ??
    null
  );
}

function EditCustomServerModal({
  open,
  server,
  baseUrl,
  versions,
  onClose,
  onSave,
}: {
  open: boolean;
  server: CustomServer;
  baseUrl: string;
  versions: string[];
  onClose: () => void;
  onSave: (payload: {
    name: string;
    mcVersion: string;
    loaderVersion?: string | null;
    type: ServerType;
    subdomain: string;
    port: number;
  }) => void;
}) {
  const [name, setName] = useState(server.name);
  const [mcVersion, setMcVersion] = useState(server.mcVersion);
  const [type, setType] = useState<ServerType>(server.type);
  const [loaderVersion, setLoaderVersion] = useState(
    server.loaderVersion || "",
  );
  const [subdomain, setSubdomain] = useState(server.subdomain);
  const [port, setPort] = useState(String(server.port || 25565));

  useEffect(() => {
    if (!open) return;
    setName(server.name);
    setMcVersion(server.mcVersion);
    setType(server.type);
    setLoaderVersion(server.loaderVersion || "");
    setSubdomain(server.subdomain);
    setPort(String(server.port || 25565));
  }, [open, server]);

  const normalizedSubdomain = subdomain
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
  const parsedPort = Number(port);
  const valid =
    name.trim().length >= 3 &&
    normalizedSubdomain.length >= 3 &&
    mcVersion &&
    Number.isInteger(parsedPort) &&
    parsedPort >= 1 &&
    parsedPort <= 65535;
  const showLoader = needsLoaderVersion.has(type);

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      title="edit custom server"
      width="lg"
      contentClassName="space-y-5 px-7 py-6"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            icon={<Icon icon="solar:server-bold" className="h-5 w-5" />}
          />
        </Field>
        <Field label="subdomain">
          <div className="space-y-2">
            <Input
              value={subdomain}
              onChange={(event) => setSubdomain(event.target.value)}
              icon={<Icon icon="solar:link-bold" className="h-5 w-5" />}
            />
            <p className="truncate font-minecraft-ten text-base text-white/50">
              {normalizedSubdomain || "subdomain"}.{baseUrl}
            </p>
          </div>
        </Field>
        <Field label="type">
          <Select
            value={type}
            onChange={(value) => setType(value as ServerType)}
            variant="3d"
            options={SERVER_TYPES.map((item) => ({
              value: item.value,
              label: item.label,
              icon: <Icon icon={item.icon} className="h-4 w-4" />,
            }))}
          />
        </Field>
        <Field label="minecraft">
          <Select
            value={mcVersion}
            onChange={setMcVersion}
            variant="3d"
            options={(versions.length
              ? versions
              : [server.mcVersion, "1.21.5", "1.21.4", "1.21.1"]
            )
              .filter((version, index, all) => all.indexOf(version) === index)
              .map((version) => ({ value: version, label: version }))}
          />
        </Field>
        <Field label="local port">
          <div className="flex gap-2">
            <Input
              value={port}
              onChange={(event) =>
                setPort(event.target.value.replace(/[^0-9]/g, ""))
              }
              inputMode="numeric"
              icon={<Icon icon="solar:plug-circle-bold" className="h-5 w-5" />}
            />
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/10 bg-black/30 text-white/60 transition hover:text-white"
              onClick={() => setPort(String(pickRandomLocalServerPort()))}
              aria-label="random local port"
            >
              <Icon icon="solar:shuffle-bold" className="h-5 w-5" />
            </button>
          </div>
        </Field>
        <div className={cn(!showLoader && "opacity-50")}>
          <Field label="loader version">
            <Input
              value={loaderVersion}
              disabled={!showLoader}
              onChange={(event) => setLoaderVersion(event.target.value)}
              placeholder={
                showLoader
                  ? "optional loader version"
                  : "not needed for this type"
              }
              icon={<Icon icon="solar:settings-bold" className="h-5 w-5" />}
            />
          </Field>
        </div>
      </div>
      <div className="border border-white/10 bg-black/25 px-3 py-2 font-minecraft-ten text-base text-white/50">
        Changing Minecraft version or server type affects the next server start.
        Existing files are kept.
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="flat-secondary" size="sm" onClick={onClose}>
          cancel
        </Button>
        <Button
          variant="3d"
          size="sm"
          disabled={!valid}
          onClick={() =>
            onSave({
              name: name.trim(),
              mcVersion,
              loaderVersion: showLoader ? loaderVersion.trim() || null : null,
              type,
              subdomain: normalizedSubdomain,
              port: parsedPort,
            })
          }
        >
          save
        </Button>
      </div>
    </Modal>
  );
}

function CreateCustomServerModal({
  open,
  loading,
  versions,
  baseUrl,
  onClose,
  onCreate,
}: {
  open: boolean;
  loading: boolean;
  versions: string[];
  baseUrl: string;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    mcVersion: string;
    loaderVersion?: string;
    type: ServerType;
    subdomain: string;
    importSourcePath?: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [type, setType] = useState<ServerType>("VANILLA");
  const [mcVersion, setMcVersion] = useState("");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [createMode, setCreateMode] = useState<"manual" | "modpack" | "import">(
    "manual",
  );
  const [modpackProvider, setModpackProvider] =
    useState<ContentProvider>("modrinth");
  const [modpackQuery, setModpackQuery] = useState("");
  const [modpackResults, setModpackResults] = useState<
    UnifiedModSearchResult[]
  >([]);
  const [modpackLoading, setModpackLoading] = useState(false);
  const [selectedModpack, setSelectedModpack] =
    useState<UnifiedModSearchResult | null>(null);
  const [selectedModpackVersion, setSelectedModpackVersion] =
    useState<UnifiedVersion | null>(null);
  const [modpackVersionLoading, setModpackVersionLoading] = useState<
    string | null
  >(null);
  const [importSourcePath, setImportSourcePath] = useState("");
  const wasOpenRef = useRef(false);
  const modpackProviderLabel = getProviderMeta(modpackProvider).label;

  useEffect(() => {
    if (!mcVersion && versions.length > 0) {
      setMcVersion(versions[0]);
    }
  }, [mcVersion, versions]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setName("");
      setSubdomain("");
      setType("VANILLA");
      setLoaderVersion("");
      setMcVersion(versions[0] ?? "");
      setCreateMode("manual");
      setModpackProvider("modrinth");
      setModpackQuery("");
      setModpackResults([]);
      setSelectedModpack(null);
      setSelectedModpackVersion(null);
      setModpackVersionLoading(null);
      setImportSourcePath("");
    }
    wasOpenRef.current = open;
  }, [open, versions]);

  const searchModpacks = async () => {
    setModpackLoading(true);
    try {
      const response = await UnifiedService.searchMods({
        query: modpackQuery,
        source: getProviderMeta(modpackProvider).platform,
        project_type: UnifiedProjectType.Modpack,
        limit: 12,
        offset: 0,
        sort: UnifiedSortType.Relevance,
        server_side_filter: "required",
      });
      setModpackResults(
        response.results.filter((hit) => hit.server_side !== "unsupported"),
      );
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to search modpacks", error));
    } finally {
      setModpackLoading(false);
    }
  };

  useEffect(() => {
    if (!open || createMode !== "modpack") return;
    searchModpacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, createMode, modpackProvider]);

  const selectModpack = async (hit: UnifiedModSearchResult) => {
    setSelectedModpack(hit);
    setSelectedModpackVersion(null);
    setModpackVersionLoading(hit.project_id);

    try {
      const response = await UnifiedService.getModVersions({
        source: hit.source,
        project_id: hit.project_id,
      });
      const selectedVersion = pickUnifiedServerVersion(response.versions);
      const loader = selectedVersion?.loaders.find(
        (item) => serverTypeFromModrinthLoader(item) !== "VANILLA",
      );
      const nextType = loader ? serverTypeFromModrinthLoader(loader) : type;
      const nextMcVersion =
        selectedVersion?.game_versions[0] ?? hit.versions?.[0] ?? mcVersion;

      setSelectedModpackVersion(selectedVersion);
      setName((current) => current || hit.title);
      setSubdomain(
        (current) =>
          current ||
          hit.slug
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "")
            .replace(/^-+|-+$/g, ""),
      );
      setType(nextType);
      setMcVersion(nextMcVersion);
      setLoaderVersion("");
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to load modpack versions", error));
    } finally {
      setModpackVersionLoading(null);
    }
  };

  const pickServerImport = async () => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: "Server Archive", extensions: ["zip"] }],
      });
      const selectedPath = Array.isArray(selected) ? selected[0] : selected;
      if (typeof selectedPath === "string") {
        setImportSourcePath(selectedPath);
      }
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to pick server archive", error));
    }
  };

  const pickServerImportFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });
      const selectedPath = Array.isArray(selected) ? selected[0] : selected;
      if (typeof selectedPath === "string") {
        setImportSourcePath(selectedPath);
      }
    } catch (error) {
      console.error(error);
      toast.error(serverErrorMessage("Failed to pick server folder", error));
    }
  };

  const normalizedSubdomain = subdomain
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");

  const valid =
    name.trim().length >= 3 && normalizedSubdomain.length >= 3 && mcVersion;
  const showLoader = needsLoaderVersion.has(type);

  if (!open) {
    return null;
  }

  const submit = () => {
    if (!valid) return;
    onCreate({
      name: name.trim(),
      mcVersion,
      loaderVersion: showLoader ? loaderVersion.trim() : undefined,
      type,
      subdomain: normalizedSubdomain,
      importSourcePath: importSourcePath || undefined,
    });
  };

  return (
    <Modal
      onClose={onClose}
      title="create custom server"
      width="lg"
      contentClassName="space-y-6 px-7 py-6"
    >
      <div className="grid grid-cols-3 border border-white/10 bg-black/25 p-1">
        {(["manual", "modpack", "import"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn(
              "h-8 border font-minecraft-ten text-base transition",
              createMode === mode
                ? "border-white/20 bg-white/15 text-white"
                : "border-transparent text-white/50 hover:bg-white/10 hover:text-white",
            )}
            onClick={() => setCreateMode(mode)}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {createMode === "modpack" && (
        <div className="space-y-3 border border-white/10 bg-black/25 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={modpackQuery}
              onChange={(event) => setModpackQuery(event.target.value)}
              placeholder={`Search ${modpackProviderLabel} Modpacks`}
              size="sm"
              icon={<Icon icon="solar:magnifer-bold" className="h-5 w-5" />}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  searchModpacks();
                }
              }}
            />
            <Button
              variant="flat-secondary"
              size="sm"
              className="shrink-0"
              disabled={modpackLoading}
              onClick={searchModpacks}
            >
              {modpackLoading ? "Searching" : "Search"}
            </Button>
            <ProviderSwitch
              provider={modpackProvider}
              onChange={(nextProvider) => {
                setModpackProvider(nextProvider);
                setModpackResults([]);
                setSelectedModpack(null);
                setSelectedModpackVersion(null);
              }}
            />
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {modpackResults.map((hit) => {
              const selected = selectedModpack?.project_id === hit.project_id;
              return (
                <button
                  key={hit.project_id}
                  type="button"
                  className={cn(
                    "flex w-full gap-3 border p-2 text-left transition",
                    selected
                      ? "border-white/25 bg-white/10"
                      : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-white/10",
                  )}
                  onClick={() => selectModpack(hit)}
                >
                  {hit.icon_url ? (
                    <img
                      src={hit.icon_url}
                      alt=""
                      className="h-11 w-11 border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center border border-white/10 bg-black/40">
                      <Icon icon="solar:box-bold" className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-minecraft-ten text-lg text-white">
                      {hit.title}
                    </p>
                    <p className="line-clamp-2 font-minecraft-ten text-base text-white/50">
                      {hit.description}
                    </p>
                  </div>
                  {modpackVersionLoading === hit.project_id && (
                    <Icon
                      icon="solar:refresh-bold"
                      className="h-5 w-5 shrink-0 animate-spin text-white/60"
                    />
                  )}
                </button>
              );
            })}
            {!modpackLoading && modpackResults.length === 0 && (
              <p className="font-minecraft-ten text-base text-white/45">
                choose a server-side Modrinth modpack
              </p>
            )}
          </div>

          {selectedModpack && (
            <div className="border border-white/10 bg-black/30 px-3 py-2 font-minecraft-ten text-base text-white/55">
              selected {selectedModpack.title}
              {selectedModpackVersion
                ? ` - ${selectedModpackVersion.version_number}`
                : ""}
              . Minecraft and loader are filled from the modpack.
            </div>
          )}
        </div>
      )}

      {createMode === "import" && (
        <div className="space-y-3 border border-white/10 bg-black/25 p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="3d"
              size="sm"
              icon={<Icon icon="solar:archive-down-bold" className="h-4 w-4" />}
              onClick={pickServerImport}
            >
              import zip
            </Button>
            <Button
              variant="flat-secondary"
              size="sm"
              icon={<Icon icon="solar:folder-open-bold" className="h-4 w-4" />}
              onClick={pickServerImportFolder}
            >
              import folder
            </Button>
          </div>

          {importSourcePath && (
            <div className="space-y-2">
              <p className="truncate border border-white/10 bg-black/30 px-3 py-2 font-minecraft-ten text-base text-white/65">
                {importSourcePath}
              </p>
              <p className="font-minecraft-ten text-base text-white/45">
                Choose Minecraft version, type and loader manually. The selected
                files are copied after the server is created.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="server name"
            icon={<Icon icon="solar:server-bold" className="h-5 w-5" />}
          />
        </Field>

        <Field label="subdomain">
          <div className="space-y-2">
            <Input
              value={subdomain}
              onChange={(event) => setSubdomain(event.target.value)}
              placeholder="my-server"
              icon={<Icon icon="solar:link-bold" className="h-5 w-5" />}
            />
            <p className="truncate font-minecraft-ten text-base text-white/50">
              {normalizedSubdomain || "subdomain"}.{baseUrl}
            </p>
          </div>
        </Field>

        <Field label="type">
          <Select
            value={type}
            onChange={(value) => setType(value as ServerType)}
            variant="3d"
            options={SERVER_TYPES.map((item) => ({
              value: item.value,
              label: item.label,
              icon: <Icon icon={item.icon} className="h-4 w-4" />,
            }))}
          />
        </Field>

        <Field label="minecraft">
          <Select
            value={mcVersion}
            onChange={setMcVersion}
            variant="3d"
            options={(versions.length
              ? versions
              : ["1.21.5", "1.21.4", "1.21.1"]
            ).map((version) => ({ value: version, label: version }))}
          />
        </Field>
      </div>

      <div className={cn(!showLoader && "opacity-50")}>
        <Field label="loader version">
          <Input
            value={loaderVersion}
            disabled={!showLoader}
            onChange={(event) => setLoaderVersion(event.target.value)}
            placeholder={
              showLoader
                ? "optional loader version"
                : "not needed for this type"
            }
            icon={<Icon icon="solar:settings-bold" className="h-5 w-5" />}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="flat-secondary" size="sm" onClick={onClose}>
          cancel
        </Button>
        <Button
          variant="3d"
          size="sm"
          disabled={!valid || loading}
          onClick={submit}
        >
          {loading ? "creating" : "create"}
        </Button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="font-minecraft text-2xl lowercase text-white/75">
        {label}
      </span>
      {children}
    </label>
  );
}
