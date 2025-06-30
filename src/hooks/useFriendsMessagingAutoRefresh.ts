import { useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useFriendsStore } from "../store/useFriendsStore";
import { useMessagingStore } from "../store/useMessagingStore";

interface WebSocketEnvelope {
  channel: string;
  data: any;
}

let globalWebSocketStarted = false;
let websocketPromise: Promise<void> | null = null;

const REFRESH_INTERVAL = 3000;
const REFRESH_DEBOUNCE = 500;
const MIN_REFRESH_INTERVAL = 1000;

export function useFriendsMessagingAutoRefresh() {
  const refreshDebounceRef = useRef<NodeJS.Timeout>();
  const pollIntervalRef = useRef<NodeJS.Timeout>();
  const websocketStartedRef = useRef(false);

  const {
    autoRefreshEnabled,
    refreshFriendsData,
    isSidebarOpen,
    hasInitiallyLoaded,
  } = useFriendsStore();

  const { refreshMessagingData } = useMessagingStore();

  const debouncedRefresh = useCallback(async () => {
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }

    refreshDebounceRef.current = setTimeout(async () => {
      const store = useFriendsStore.getState();
      const now = Date.now();
      if (
        store.autoRefreshEnabled &&
        now - store.lastRefresh >= MIN_REFRESH_INTERVAL
      ) {
        try {
          await Promise.all([
            refreshFriendsData(),
            refreshMessagingData(false)
          ]);
        } catch (error) {
        }
      }
    }, REFRESH_DEBOUNCE);
  }, [refreshFriendsData, refreshMessagingData]);

  useEffect(() => {
    const isFriendsWindowOpen = typeof document !== 'undefined' && 
      document.querySelector('[data-friends-window]') !== null;
    
    if (!autoRefreshEnabled || (!isSidebarOpen && !isFriendsWindowOpen)) {
      return;
    }

    let unsubscribeMessage: (() => void) | undefined;
    let unsubscribeStateChange: (() => void) | undefined;

    const initializeWebSocket = async () => {
      if (globalWebSocketStarted || websocketStartedRef.current) return;

      try {
        websocketStartedRef.current = true;
        globalWebSocketStarted = true;

        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("start_websocket_connection");

        unsubscribeMessage = await listen(
          "friends-websocket-message",
          (event) => {
            const envelope = event.payload as WebSocketEnvelope;
            
            if (envelope.channel === "friend-message" || 
                envelope.channel === "friend-state-change" ||
                envelope.channel === "chat-message") {
              debouncedRefresh();
            }
          }
        );

        unsubscribeStateChange = await listen(
          "friends-websocket-state-change", 
          () => {
            debouncedRefresh();
          }
        );
      } catch (error) {
        websocketStartedRef.current = false;
        globalWebSocketStarted = false;
      }
    };

    if (hasInitiallyLoaded) {
      if (!websocketPromise) {
        websocketPromise = initializeWebSocket();
      }

      pollIntervalRef.current = setInterval(() => {
        const isFriendsWindowOpen = typeof document !== 'undefined' && 
          document.querySelector('[data-friends-window]') !== null;
        
        if (autoRefreshEnabled && (isSidebarOpen || isFriendsWindowOpen)) {
          debouncedRefresh();
        }
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
      if (unsubscribeMessage) {
        unsubscribeMessage();
      }
      if (unsubscribeStateChange) {
        unsubscribeStateChange();
      }
    };
  }, [
    autoRefreshEnabled,
    isSidebarOpen,
    hasInitiallyLoaded,
    debouncedRefresh,
    refreshMessagingData,
  ]);

  const manualRefresh = useCallback(async () => {
    try {
      await Promise.all([
        refreshFriendsData(),
        refreshMessagingData(true)
      ]);
    } catch (error) {
      throw error;
    }
  }, [refreshFriendsData, refreshMessagingData]);

  return { manualRefresh };
}
