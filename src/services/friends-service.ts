import { invokeCommand, createServiceFunction, createServiceFunctionWithArgs } from "./base-service";
import type {
  FriendsUser,
  FriendsFriendsInformationDto,
  FriendsFriendRequestResponse,
  FriendsUserOnlineState,
} from "../types/friends";

export const getFriendsInformation = createServiceFunction<FriendsFriendsInformationDto>("get_friends_information_command");
export const getOwnUser = createServiceFunction<FriendsUser>("get_user_command");
export const getIncomingFriendRequests = createServiceFunction<FriendsFriendRequestResponse[]>("get_incoming_friend_requests_command");
export const getOutgoingFriendRequests = createServiceFunction<FriendsFriendRequestResponse[]>("get_outgoing_friend_requests_command");
export const removeFriend = createServiceFunctionWithArgs<FriendsFriendRequestResponse, string>(
  "remove_friend_command",
  (targetUuid) => ({ targetUuid })
);

export const acceptFriendRequest = createServiceFunctionWithArgs<FriendsFriendRequestResponse, string>(
  "accept_friend_request_command",
  (senderUuid) => ({ senderUuid })
);

export const declineFriendRequest = createServiceFunctionWithArgs<FriendsFriendRequestResponse, string>(
  "decline_friend_request_command",
  (senderUuid) => ({ senderUuid })
);

export const cancelFriendRequest = createServiceFunctionWithArgs<FriendsFriendRequestResponse, string>(
  "decline_friend_request_command",
  (receiverUuid) => ({ senderUuid: receiverUuid })
);

export const setShowServer = createServiceFunctionWithArgs<FriendsUser, boolean>(
  "set_show_server_command",
  (showServer) => ({ showServer })
);

export const setAllowFriendRequests = createServiceFunctionWithArgs<FriendsUser, boolean>(
  "set_allow_friend_requests_command",
  (allowRequests) => ({ allowRequests })
);

export const setAllowServerInvites = createServiceFunctionWithArgs<FriendsUser, boolean>(
  "set_allow_server_invites_command",
  (allowServerInvites) => ({ allowServerInvites })
);

export const toggleAfk = createServiceFunctionWithArgs<FriendsUserOnlineState, boolean>(
  "toggle_afk_command",
  (nowAfk) => ({ nowAfk })
);

export const setServer = createServiceFunctionWithArgs<FriendsUser, string>(
  "set_server_command",
  (server) => ({ server })
);

export const removeServer = createServiceFunction<FriendsUser>("remove_server_command");

export const inviteToServer = createServiceFunctionWithArgs<void, { friendUuid: string; domain: string }>(
  "invite_to_server_command",
  ({ friendUuid, domain }) => ({ friendUuid, domain })
);

export const requestInviteToServer = createServiceFunctionWithArgs<void, string>(
  "request_invite_to_server_command",
  (friendUuid) => ({ friendUuid })
);

export const startFriendsWebSocket = createServiceFunction<void>("start_friends_websocket_command");

export const respondToFriendRequest = async (
  requestId: string,
  accept: boolean
): Promise<FriendsFriendRequestResponse> => {
  return accept ? acceptFriendRequest(requestId) : declineFriendRequest(requestId);
};
