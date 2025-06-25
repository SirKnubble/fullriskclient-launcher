import { invoke } from "@tauri-apps/api/core";
import type {
  FriendsUser,
  FriendsFriendsInformationDto,
  FriendsFriendRequestResponse,
  FriendsFriendUser,
  FriendsUserOnlineState,
} from "../types/friends";

async function invokeWithErrorHandling<T>(
  command: string,
  args?: Record<string, any>
): Promise<T> {
  try {
    const result = await invoke<T>(command, args);
    return result;
  } catch (error) {
    if (typeof error === "string") {
      throw new Error(error);
    } else if (error && typeof error === "object" && "message" in error) {
      throw new Error(error.message as string);
    } else {
      throw new Error(`Unknown error in ${command}: ${JSON.stringify(error)}`);
    }
  }
}

export const getFriendsInformation =
  (): Promise<FriendsFriendsInformationDto> => {
    return invokeWithErrorHandling("get_friends_information_command");
  };

export const getOwnUser = (): Promise<FriendsUser> => {
  return invokeWithErrorHandling("get_user_command");
};

export const removeFriend = async (
  targetUuid: string
): Promise<FriendsFriendRequestResponse> => {
  try {
    const result = await invoke<FriendsFriendRequestResponse>(
      "remove_friend_command",
      { targetUuid }
    );
    return result;
  } catch (error) {
    throw error;
  }
};

export const acceptFriendRequest = async (
  senderUuid: string
): Promise<FriendsFriendRequestResponse> => {
  try {
    const result = await invokeWithErrorHandling<FriendsFriendRequestResponse>(
      "accept_friend_request_command",
      { senderUuid }
    );
    return result;
  } catch (error) {
    throw error;
  }
};

export const declineFriendRequest = async (
  senderUuid: string
): Promise<FriendsFriendRequestResponse> => {
  try {
    const result = await invokeWithErrorHandling<FriendsFriendRequestResponse>(
      "decline_friend_request_command",
      { senderUuid }
    );
    return result;
  } catch (error) {
    throw error;
  }
};

export const cancelFriendRequest = (
  receiverUuid: string
): Promise<FriendsFriendRequestResponse> => {
  return invoke("decline_friend_request_command", { senderUuid: receiverUuid });
};

export const setShowServer = async (
  showServer: boolean
): Promise<FriendsUser> => {
  try {
    const result = await invokeWithErrorHandling<FriendsUser>(
      "set_show_server_command",
      { showServer }
    );
    return result;
  } catch (error) {
    throw error;
  }
};

export const setAllowFriendRequests = async (
  allowRequests: boolean
): Promise<FriendsUser> => {
  try {
    const result = await invokeWithErrorHandling<FriendsUser>(
      "set_allow_friend_requests_command",
      {
        allowRequests,
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
};

export const setAllowServerInvites = async (
  allowServerInvites: boolean
): Promise<FriendsUser> => {
  try {
    const result = await invokeWithErrorHandling<FriendsUser>(
      "set_allow_server_invites_command",
      {
        allowServerInvites,
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
};

export const toggleAfk = (nowAfk: boolean): Promise<FriendsUserOnlineState> => {
  return invoke("toggle_afk_command", { nowAfk });
};

export const setServer = (server: string): Promise<FriendsUser> => {
  return invoke("set_server_command", { server });
};

export const removeServer = (): Promise<FriendsUser> => {
  return invoke("remove_server_command");
};

export const inviteToServer = (
  friendUuid: string,
  domain: string
): Promise<void> => {
  return invoke("invite_to_server_command", { friendUuid, domain });
};

export const requestInviteToServer = (friendUuid: string): Promise<void> => {
  return invoke("request_invite_to_server_command", { friendUuid });
};

export const respondToFriendRequest = async (
  requestId: string,
  accept: boolean
): Promise<FriendsFriendRequestResponse> => {
  if (accept) {
    return await acceptFriendRequest(requestId);
  } else {
    return await declineFriendRequest(requestId);
  }
};

export async function getIncomingFriendRequests(): Promise<
  FriendsFriendRequestResponse[]
> {
  try {
    const result = await invoke<FriendsFriendRequestResponse[]>(
      "get_incoming_friend_requests_command"
    );
    return result;
  } catch (error) {
    throw error;
  }
}

export async function getOutgoingFriendRequests(): Promise<
  FriendsFriendRequestResponse[]
> {
  try {
    const result = await invoke<FriendsFriendRequestResponse[]>(
      "get_outgoing_friend_requests_command"
    );
    return result;
  } catch (error) {
    throw error;
  }
}

export async function startFriendsWebSocket(): Promise<void> {
  try {
    await invoke("start_friends_websocket_command");
  } catch (error) {
    throw error;
  }
}
