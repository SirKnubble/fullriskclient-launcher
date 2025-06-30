export interface NoRiskUserMinimal {
  uuid: string;
  ign: string;
  displayName?: string;
  lastSeen?: string;
  discordId?: string;
  rank?: string;
  noRiskPlusExpirationDate?: number;
  nameTag?: any;
  loginStreak?: any;
  customIconInfo?: any;
  additionalNameTag?: any;
  supportACreatorCode?: any;
}

export interface NoRiskUserFull {
  uuid: string;
  ign: string;
  displayName: string;
  premium: boolean;
  noriskPlus: boolean;
  createdAt: number;
  lastSeen: number;
  mcUuid?: string;
  mcName?: string;
}

export interface OtherNoRiskUser {
  userId: string;
  requests: string[];
  otherUsers: Record<string, OtherNoRiskUser>;
  state: string;
  lastActiveState: string;
  server?: string;
  privacy: FriendsUserPrivacy;
  createdAt?: number;
  lastUpdated?: number;
}

export enum FriendsUserOnlineState {
  ONLINE = "ONLINE",
  AWAY = "AWAY",
  BUSY = "BUSY",
  AFK = "AFK",
  INVISIBLE = "INVISIBLE",
  OFFLINE = "OFFLINE",
}

export interface FriendsUserPrivacy {
  showServer: boolean;
  allowRequests: boolean;
  allowServerInvites: boolean;
}

export interface FriendsUser {
  userId: string;
  requests: string[];
  otherUsers: Record<string, OtherNoRiskUser>;
  state: string;
  lastActiveState: string;
  server?: string;
  privacy: FriendsUserPrivacy;
  createdAt?: number;
  lastUpdated?: number;
}

export interface FriendsFriendRequestState {
  id: string;
  oldState: string;
  newState: string;
  updatedAt: number;
}

export interface FriendsFriendRequest {
  id: string;
  sender: string;
  receiver: string;
  currentState: FriendsFriendRequestState;
  createdAt: number;
}

export interface FriendsFriendRequestResponse {
  friendRequest: FriendsFriendRequest;
  users: NoRiskUserMinimal[];
}

export interface FriendsFriendUser {
  noriskUser: NoRiskUserMinimal;
  otherUser: OtherNoRiskUser;
  onlineState: string;
  server?: string;
  timestamp?: number;
}

export interface FriendsFriendsInformationDto {
  friends: FriendsFriendUser[];
  pending: FriendsFriendRequestResponse[];
  user: FriendsUser;
}

export interface FriendsOnlineStateChangeDto {
  uuid: string;
  oldState: FriendsUserOnlineState;
  newState: FriendsUserOnlineState;
}

export interface FriendsRequestServerInviteDto {
  user: NoRiskUserMinimal;
}

export interface FriendsHostInvite {
  user: NoRiskUserMinimal;
  domain: string;
  isHostedWorld: boolean;
}

export interface FriendsChatMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export const FriendsUserStateHelpers = {
  parseState: (stateString: string): FriendsUserOnlineState => {
    switch (stateString?.toUpperCase()) {
      case "ONLINE":
        return FriendsUserOnlineState.ONLINE;
      case "AWAY":
        return FriendsUserOnlineState.AWAY;
      case "BUSY":
        return FriendsUserOnlineState.BUSY;
      case "AFK":
        return FriendsUserOnlineState.AFK;
      case "INVISIBLE":
        return FriendsUserOnlineState.INVISIBLE;
      case "OFFLINE":
      default:
        return FriendsUserOnlineState.OFFLINE;
    }
  },

  isOnline: (state: FriendsUserOnlineState | string): boolean => {
    const enumState =
      typeof state === "string"
        ? FriendsUserStateHelpers.parseState(state)
        : state;
    return [
      FriendsUserOnlineState.ONLINE,
      FriendsUserOnlineState.AWAY,
      FriendsUserOnlineState.BUSY,
      FriendsUserOnlineState.AFK,
    ].includes(enumState);
  },

  isActive: (state: FriendsUserOnlineState | string): boolean => {
    const enumState =
      typeof state === "string"
        ? FriendsUserStateHelpers.parseState(state)
        : state;
    return [
      FriendsUserOnlineState.ONLINE,
      FriendsUserOnlineState.AWAY,
      FriendsUserOnlineState.BUSY,
    ].includes(enumState);
  },
};
