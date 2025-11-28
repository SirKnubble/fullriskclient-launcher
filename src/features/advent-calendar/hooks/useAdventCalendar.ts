import { useCallback, useEffect, useMemo, useState } from "react";
import { ADVENT_REWARDS } from "../mockRewards";
import type { AdventDoor, RedeemFeedback } from "../types";
import { useLauncherThemeStore } from "../../../store/launcher-theme-store";

const TOTAL_DOORS = ADVENT_REWARDS.length;

const clampDay = (value: number): number => {
  if (Number.isNaN(value)) {
    return 1;
  }
  if (value < 1) {
    return 1;
  }
  if (value > TOTAL_DOORS) {
    return TOTAL_DOORS;
  }
  return value;
};

const createAvailableDate = (year: number, day: number): Date => {
  return new Date(year, 11, day);
};

const formatAvailableDate = (date: Date): string => {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "numeric",
      month: "long",
    }).format(date);
  } catch (error) {
    return date.toLocaleDateString();
  }
};

export interface AdventCalendarState {
  doors: AdventDoor[];
  currentDay: number;
  currentDate: Date;
  totalDoors: number;
  openedCount: number;
  feedback: RedeemFeedback | null;
  openDoor: (day: number) => void;
  dismissFeedback: () => void;
}

export function useAdventCalendar(): AdventCalendarState {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // For development/testing: Use day 1 if not December, otherwise use actual day
  const currentDay = currentDate.getMonth() === 11 ? clampDay(currentDate.getDate()) : 1;

  const { openedAdventDoors, markAdventDoorOpened } = useLauncherThemeStore();
  const openedDays = openedAdventDoors;

  const [recentlyOpenedDay, setRecentlyOpenedDay] = useState<number | null>(
    null,
  );
  const [feedback, setFeedback] = useState<RedeemFeedback | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentDate(new Date());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  // Removed auto-opening of past doors for testing

  useEffect(() => {
    if (recentlyOpenedDay === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRecentlyOpenedDay(null);
    }, 1_500);

    return () => window.clearTimeout(timeout);
  }, [recentlyOpenedDay]);



  const shuffledOrder = useMemo(() => {
    const days = ADVENT_REWARDS.map((reward) => reward.day);
    for (let index = days.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = days[index];
      days[index] = days[swapIndex];
      days[swapIndex] = temp;
    }
    return days;
  }, []); // Empty dependency array so it only shuffles once

  const doors = useMemo<AdventDoor[]>(() => {
    const rewardMap = new Map(ADVENT_REWARDS.map((reward) => [reward.day, reward]));
    const year = currentDate.getFullYear();

    return shuffledOrder.map((day) => {
      const reward = rewardMap.get(day);
      if (!reward) throw new Error(`No reward found for day ${day}`);
      
      const availableOn = createAvailableDate(year, day);
      const availableOnLabel = formatAvailableDate(availableOn);

      let status: AdventDoor["status"];
      if (openedDays.includes(day)) {
        status = "opened";
      } else {
        // FOR TESTING: Make all unopened doors available
        status = "available";
      }
      /* Original logic:
      } else if (day === currentDay) {
        status = "available";
      } else if (day < currentDay) {
        status = "opened";
      } else {
        status = "locked";
      }
      */

      return {
        day,
        reward,
        status,
        availableOn,
        availableOnLabel,
        isToday: day === currentDay,
        isRecentlyOpened: recentlyOpenedDay === day,
      } satisfies AdventDoor;
    });
  }, [currentDate, currentDay, openedDays, recentlyOpenedDay, shuffledOrder]);

  const openedCount = useMemo(() => new Set(openedDays).size, [openedDays]);

  const openDoor = useCallback(
    (day: number) => {
      // FOR TESTING: Allow opening any door
      /*
      if (day !== currentDay) {
        return;
      }
      */

      if (openedDays.includes(day)) {
        return;
      }

      const reward = ADVENT_REWARDS.find((entry) => entry.day === day);
      if (!reward) return;

      markAdventDoorOpened(day);
      setRecentlyOpenedDay(day);
      setFeedback({ day, reward });
    },
    [currentDay, openedDays, markAdventDoorOpened],
  );

  const dismissFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return {
    doors,
    currentDay,
    currentDate,
    totalDoors: TOTAL_DOORS,
    openedCount,
    feedback,
    openDoor,
    dismissFeedback,
  };
}
