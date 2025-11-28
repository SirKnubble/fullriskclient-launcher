import { useGLTF } from "@react-three/drei";
import { AdventCalendarHeader } from "./components/AdventCalendarHeader";
import { AdventCalendarGrid } from "./components/AdventCalendarGrid";
import { RedeemModal } from "./components/RedeemModal";
import { useAdventCalendar } from "./hooks/useAdventCalendar";
import { ADVENT_REWARDS } from "./mockRewards";

// Preload 3D assets for smoother experience
ADVENT_REWARDS.forEach((reward) => {
  if ((reward.type === "cosmetic" || reward.type === "emote") && reward.assetId) {
    useGLTF.preload(`/${reward.assetId}`);
  }
});

export function AdventCalendarTab() {
  const {
    doors,
    currentDay,
    currentDate,
    totalDoors,
    openedCount,
    feedback,
    openDoor,
    dismissFeedback,
  } = useAdventCalendar();

  const availableDoor = doors.find((door) => door.status === "available");

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden px-5 pb-12 pt-6 sm:px-8 custom-scrollbar">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-8">
        <AdventCalendarHeader
          currentDay={currentDay}
          currentDate={currentDate}
          openedCount={openedCount}
          totalDoors={totalDoors}
          availableDoor={availableDoor}
        />

        <section aria-label="Adventskalender Türchen">
          <AdventCalendarGrid doors={doors} onOpenDoor={openDoor} />
        </section>
      </div>

      <RedeemModal feedback={feedback} onDismiss={dismissFeedback} />
    </div>
  );
}
