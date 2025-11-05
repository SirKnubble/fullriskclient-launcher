import { useMemo } from "react";
import { Card } from "../../../components/ui/Card";
import { TagBadge } from "../../../components/ui/TagBadge";
import { useThemeStore } from "../../../store/useThemeStore";
import { cn } from "../../../lib/utils";
import type { AdventDoor } from "../types";

interface AdventCalendarHeaderProps {
  currentDay: number;
  openedCount: number;
  totalDoors: number;
  currentDate: Date;
  availableDoor?: AdventDoor;
}

export function AdventCalendarHeader({
  currentDay,
  openedCount,
  totalDoors,
  currentDate,
  availableDoor,
}: AdventCalendarHeaderProps) {
  const accentColor = useThemeStore((state) => state.accentColor);

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("de-DE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(currentDate);
    } catch (error) {
      return currentDate.toLocaleDateString();
    }
  }, [currentDate]);

  const infoText = "Öffne jeden Tag ein Türchen für tolle Belohnungen!";

  return (
    <Card
      variant="flat-no-hover"
      className="relative overflow-visible px-6 py-6 sm:px-8 sm:py-7"
    >
      <div
        className="absolute -top-20 right-[-60px] h-56 w-56 rounded-full blur-3xl opacity-40"
        aria-hidden="true"
        style={{
          background: accentColor.shadowValue,
        }}
      />

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="font-minecraft text-4xl sm:text-5xl lowercase tracking-wider text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
            adventskalender
          </h1>
          <p className="font-minecraft-ten text-xs sm:text-sm text-white/80 normal-case max-w-xl leading-relaxed">
            {infoText}
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
          <TagBadge variant="filter" size="lg" className="font-minecraft lowercase tracking-wide whitespace-nowrap">
            {formattedDate.toLowerCase()}
          </TagBadge>
          <span
            className={cn(
              "font-minecraft-ten text-xs uppercase tracking-widest text-white/70 whitespace-nowrap",
            )}
          >
            {openedCount}/{totalDoors} geöffnet
          </span>
        </div>
      </div>
    </Card>
  );
}
