import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "../components/ui/GlobalToaster";

interface WebSocketEnvelope {
  channel: string;
  data: any;
}

function extractFriendName(data: any): string | null {
  if (data?.username) return data.username;
  if (data?.friend_name) return data.friend_name;
  if (data?.name) return data.name;
  if (data?.ign) return data.ign;
  if (data?.user?.username) return data.user.username;
  if (data?.user?.ign) return data.user.ign;
  if (data?.friend?.username) return data.friend.username;
  if (data?.friend?.ign) return data.friend.ign;
  if (data?.users?.[0]?.ign) return data.users[0].ign;
  return null;
}

const globalEventDeduplication = new Map<string, number>();
const DEDUPLICATION_WINDOW = 2000;

function isGlobalDuplicate(channel: string, data: any): boolean {
  const friendName = extractFriendName(data);
  const timestamp = data?.timestamp || Date.now();
  const eventKey = `${channel}:${friendName || "unknown"}:${Math.floor(timestamp / 5000)}`;
  const now = Date.now();

  if (globalEventDeduplication.size > 20) {
    for (const [key, time] of globalEventDeduplication.entries()) {
      if (now - time > DEDUPLICATION_WINDOW) {
        globalEventDeduplication.delete(key);
      }
    }
  }

  if (globalEventDeduplication.has(eventKey)) {
    return true;
  }

  globalEventDeduplication.set(eventKey, now);
  return false;
}

export function useFriendsEvents() {
  useEffect(() => {
    let unsubscribeMessage: (() => void) | undefined;
    let unsubscribeConnected: (() => void) | undefined;
    let unsubscribeDisconnected: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unsubscribeMessage = await listen<WebSocketEnvelope>(
          "friends-ws-message",
          (event) => {
            const envelope = event.payload;

            if (isGlobalDuplicate(envelope.channel, envelope.data)) {
              return;
            }

            const friendName = extractFriendName(envelope.data);

            switch (envelope.channel) {
              case "nrc_friends:friend_online":
                if (friendName) {
                  toast.info(`${friendName} is now online`);
                } else {
                  toast.info("A friend came online");
                }
                break;

              case "nrc_friends:friend_offline":
                if (friendName) {
                  toast.info(`${friendName} went offline`);
                } else {
                  toast.info("A friend went offline");
                }
                break;

              case "nrc_friends:friend_request":
                if (friendName) {
                  toast.info(`Friend request from ${friendName}`);
                } else {
                  toast.info("New friend request received");
                }
                break;

              case "nrc_friends:ping_add":
                if (friendName) {
                  toast.info(`${friendName} sent you a ping!`);
                } else {
                  toast.info("A friend sent you a ping!");
                }
                break;

              case "nrc_friends:host_invite":
                if (friendName) {
                  toast.info(`Host invite from ${friendName}`);
                } else {
                  toast.info("Host invite received!");
                }
                break;

              case "nrc_friends:public_server_invite":
                if (friendName) {
                  toast.info(`Server invite from ${friendName}`);
                } else {
                  toast.info("Server invite received!");
                }
                break;

              case "nrc_notifications:notifications":
                if (
                  envelope.data?.type ===
                  "gg.norisk.networking.model.notifications.notification.FriendRequestReceivedNotifications"
                ) {
                  const friendName = envelope.data?.friend?.name;
                  if (friendName) {
                    toast.info(`Friend request from ${friendName}`);
                  } else {
                    toast.info("New friend request received");
                  }
                }
                break;
            }
          }
        );

        unsubscribeConnected = await listen("friends-ws-connected", () => {});
        unsubscribeDisconnected = await listen(
          "friends-ws-disconnected",
          () => {}
        );
        unsubscribeError = await listen<string>("friends-ws-error", () => {});
      } catch (error) {}
    };

    setupListeners();

    return () => {
      unsubscribeMessage?.();
      unsubscribeConnected?.();
      unsubscribeDisconnected?.();
      unsubscribeError?.();
    };
  }, []);
}
