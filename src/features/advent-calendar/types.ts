export type AdventDoorStatus = "locked" | "available" | "opened";

export type RewardType = "coins" | "cosmetic" | "emote" | "discount" | "nrc_plus" | "icon";

export interface AdventReward {
  day: number;
  type: RewardType;
  value: string | number;
  label: string;
  description?: string;
  assetId?: string; // For cosmetics/emotes/icons
}

export interface AdventDoor {
  day: number;
  reward: AdventReward; // Changed from string to AdventReward
  status: AdventDoorStatus;
  availableOn: Date;
  availableOnLabel: string;
  isToday: boolean;
  isRecentlyOpened: boolean;
}

export interface RedeemFeedback {
  day: number;
  reward: AdventReward;
}
