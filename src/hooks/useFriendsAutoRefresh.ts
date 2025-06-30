import { useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useFriendsStore } from "../store/useFriendsStore";

interface WebSocketEnvelope {
  channel: string;
  data: any;
}

let globalWebSocketStarted = false;
let websocketPromise: Promise<void> | null = null;

const REFRESH_INTERVAL = 4000;
const REFRESH_DEBOUNCE = 500;
const MIN_REFRESH_INTERVAL = 1000;

export function useFriendsAutoRefresh() {
  const refreshDebounceRef = useRef<NodeJS.Timeout>();
  const pollIntervalRef = useRef<NodeJS.Timeout>();
  const websocketStartedRef = useRef(false);

  const {
    autoRefreshEnabled,
    refreshFriendsData,
    lastRefresh,
    isSidebarOpen,
    hasInitiallyLoaded,
  } = useFriendsStore();

  const debouncedRefresh = useCallback(() => {
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }

    refreshDebounceRef.current = setTimeout(() => {
      const store = useFriendsStore.getState();
      const now = Date.now();
      if (
        store.autoRefreshEnabled &&
        now - store.lastRefresh >= MIN_REFRESH_INTERVAL
      ) {
        refreshFriendsData();
      }
    }, REFRESH_DEBOUNCE);
  }, [refreshFriendsData]);

  useEffect(() => {
    if (!autoRefreshEnabled || !isSidebarOpen) return;

    let unsubscribeMessage: (() => void) | undefined;

    const setupWebSocketListener = async () => {
      try {
        if (!globalWebSocketStarted && !websocketPromise) {
          websocketPromise = (async () => {
            try {
              const { startFriendsWebSocket } = await import(
                "../services/friends-service"
              );
              await startFriendsWebSocket();
              globalWebSocketStarted = true;
              websocketStartedRef.current = true;
            } catch (error) {
              websocketPromise = null;
            }
          })();
          await websocketPromise;
        } else if (globalWebSocketStarted) {
          websocketStartedRef.current = true;
        } else if (websocketPromise) {
          await websocketPromise;
          websocketStartedRef.current = true;
        }

        unsubscribeMessage = await listen<WebSocketEnvelope>(
          "friends-ws-message",
          (event) => {
            const envelope = event.payload;

            const refreshEvents = [
              "nrc_friends:friend_online",
              "nrc_friends:friend_offline",
              "nrc_friends:friend_request",
              "nrc_friends:friend_accepted",
              "nrc_friends:friend_removed",
              "nrc_friends:status_update",
              "nrc_friends:server_update",
            ];

            if (refreshEvents.includes(envelope.channel)) {
              debouncedRefresh();
            }
          }
        );
      } catch (error) {}
    };

    setupWebSocketListener();

    return () => {
      unsubscribeMessage?.();
    };
  }, [autoRefreshEnabled, isSidebarOpen, debouncedRefresh]);

  useEffect(() => {
    if (!autoRefreshEnabled || !isSidebarOpen || !hasInitiallyLoaded) return;

    const startPolling = () => {
      pollIntervalRef.current = setInterval(() => {
        const store = useFriendsStore.getState();
        const now = Date.now();
        const timeSinceLastRefresh = now - store.lastRefresh;

        if (timeSinceLastRefresh >= REFRESH_INTERVAL) {
          refreshFriendsData();
        }
      }, REFRESH_INTERVAL);
    };

    startPolling();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [
    autoRefreshEnabled,
    isSidebarOpen,
    hasInitiallyLoaded,
    refreshFriendsData,
  ]);

  useEffect(() => {
    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);
  return {
    isAutoRefreshEnabled: autoRefreshEnabled,
  };
}
