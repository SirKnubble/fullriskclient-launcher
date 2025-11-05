export type AdventDoorStatus = "locked" | "available" | "opened";

export interface AdventDoor {
  day: number;
  reward: string;
  status: AdventDoorStatus;
  availableOn: Date;
  availableOnLabel: string;
  isToday: boolean;
  isRecentlyOpened: boolean;
}

export interface RedeemFeedback {
  day: number;
  reward: string;
}
