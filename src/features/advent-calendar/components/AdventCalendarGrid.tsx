import type { AdventDoor } from "../types";
import { AdventDoorCard } from "./AdventDoorCard";

interface AdventCalendarGridProps {
  doors: AdventDoor[];
  onOpenDoor: (day: number) => void;
}

export function AdventCalendarGrid({ doors, onOpenDoor }: AdventCalendarGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 pb-20">
      {doors.map((door) => (
        <AdventDoorCard key={door.day} door={door} onOpen={onOpenDoor} />
      ))}
    </div>
  );
}
