import { useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Card } from "../../../components/ui/Card";
import { Tooltip } from "../../../components/ui/Tooltip";
import { useThemeStore } from "../../../store/useThemeStore";
import { cn } from "../../../lib/utils";
import { createRadiusStyle } from "../../../components/ui/design-system";
import type { AdventDoor } from "../types";

interface AdventDoorCardProps {
  door: AdventDoor;
  onOpen: (day: number) => void;
}

const successPulse = {
  initial: { opacity: 0, scale: 0.88 },
  animate: {
    opacity: 0.5,
    scale: 1.12,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  exit: { opacity: 0, scale: 1.15, transition: { duration: 0.22 } },
};

const frontVariants = {
  visible: {
    opacity: 1,
    scale: 1,
    rotateY: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 200, damping: 20, duration: 0.3 },
  },
  hidden: {
    opacity: 0,
    scale: 0.92,
    rotateY: -8,
    filter: "blur(5px)",
    transition: { type: "spring", stiffness: 190, damping: 22, duration: 0.28 },
  },
};

const backVariants = {
  hidden: {
    opacity: 0,
    scale: 0.88,
    rotateY: 8,
    filter: "blur(6px)",
    transition: { type: "spring", stiffness: 200, damping: 24, duration: 0.3 },
  },
  visible: {
    opacity: 1,
    scale: 1,
    rotateY: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 220, damping: 18, duration: 0.38 },
  },
};

export function AdventDoorCard({ door, onOpen }: AdventDoorCardProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);

  const isLocked = door.status === "locked";
  const isAvailable = door.status === "available";
  const isOpened = door.status === "opened";

  const ariaLabel = (() => {
    if (isLocked) {
      return `Türchen ${door.day}, gesperrt bis ${door.availableOnLabel}`;
    }
    if (isAvailable) {
      return `Türchen ${door.day}, heutiges Türchen zum Öffnen`;
    }
    return `Türchen ${door.day}, bereits geöffnet`;
  })();

  const tooltipText = isLocked
    ? `Am ${door.availableOnLabel} verfügbar`
    : isOpened
      ? "Bereits geöffnet"
      : undefined;

  const handleActivate = useCallback(() => {
    if (!isAvailable) {
      return;
    }
    onOpen(door.day);
  }, [door.day, isAvailable, onOpen]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!isAvailable) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(door.day);
      }
    },
    [door.day, isAvailable, onOpen],
  );

  const cardVariant = "flat";

  const highlightShadow = useMemo(
    () => `0 0 32px ${accentColor.shadowValue}`,
    [accentColor.shadowValue],
  );

  const baseButton = (
    <motion.button
      type="button"
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative block w-full aspect-square min-h-[160px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
        !isAvailable && "cursor-not-allowed",
        isAvailable && "cursor-pointer",
      )}
      aria-label={ariaLabel}
      aria-disabled={!isAvailable}
      aria-pressed={isOpened}
    >
      <motion.div
        className="relative h-full w-full"
        initial={false}
        whileHover={
          isAvailable
            ? { scale: 1.04, transition: { type: "spring", stiffness: 280, damping: 16 } }
            : undefined
        }
        transition={{ type: "spring", stiffness: 210, damping: 22 }}
        style={{
          ...createRadiusStyle(borderRadius, 1.1),
          overflow: "hidden",
          boxShadow: isAvailable ? highlightShadow : "none",
        }}
      >
        <motion.div
          key="front"
          className="absolute inset-0"
          initial={false}
          animate={isOpened ? "hidden" : "visible"}
          variants={frontVariants}
          style={{ pointerEvents: isOpened ? "none" : "auto" }}
        >
          <Card
            variant={cardVariant}
            className="h-full w-full"
          >
            <div className="h-full w-full flex flex-col items-center justify-center text-center" style={{ padding: '16px', gap: '16px' }}>
              <span className="font-minecraft text-6xl lowercase tracking-wider text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                {door.day.toString().padStart(2, "0")}
              </span>
              
              <div className="flex items-center justify-center" style={{ height: '40px', minHeight: '40px', maxHeight: '40px', width: '40px' }}>
                {isLocked && (
                  <Icon
                    icon="solar:lock-bold"
                    style={{ width: '36px', height: '36px' }}
                    className="text-white/60 drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
                  />
                )}
                {isAvailable && (
                  <Icon
                    icon="solar:star-bold"
                    style={{ width: '36px', height: '36px', color: accentColor.light }}
                    className="text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                  />
                )}
                {isOpened && (
                  <Icon
                    icon="solar:lock-unlocked-bold"
                    style={{ width: '36px', height: '36px' }}
                    className="text-white/70 drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
                  />
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          key="back"
          className="absolute inset-0"
          initial={false}
          animate={isOpened ? "visible" : "hidden"}
          variants={backVariants}
          style={{ pointerEvents: isOpened ? "auto" : "none" }}
        >
          <Card
            variant="flat"
            className="h-full w-full flex flex-col items-center justify-center text-center px-4 gap-3"
          >
            <Icon
              icon="solar:gift-bold"
              className="w-12 h-12 text-white/90 drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]"
              style={{ color: accentColor.value }}
            />
            <span className="font-minecraft text-3xl lowercase text-white/95 drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
              geöffnet
            </span>
          </Card>
        </motion.div>

        <AnimatePresence>
          {door.isRecentlyOpened && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `${accentColor.value}35`,
                boxShadow: `0 0 35px ${accentColor.shadowValue}`,
                ...createRadiusStyle(borderRadius, 1.2),
              }}
              {...successPulse}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.button>
  );

  if (tooltipText) {
    return <Tooltip content={tooltipText}>{baseButton}</Tooltip>;
  }

  return baseButton;
}
