export interface AdventReward {
  day: number;
  reward: string;
}

export const ADVENT_REWARDS: AdventReward[] = Array.from({ length: 24 }, (_, index) => {
  const day = index + 1;
  return {
    day,
    reward: `Belohnung ${day}`,
  };
});
