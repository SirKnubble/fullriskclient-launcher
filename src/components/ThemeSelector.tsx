import { Icon } from "@iconify/react";
import { cn } from "../lib/utils";
import { useLauncherTheme } from "../hooks/useLauncherTheme";
import { LAUNCHER_THEMES } from "../store/launcher-theme-store";
import { SimpleTooltip } from "./ui/Tooltip";

interface ThemeSelectorProps {
  disabled?: boolean;
}

export function ThemeSelector({ disabled }: ThemeSelectorProps) {
  const { selectedThemeId, toggleTheme, isThemeUnlocked } = useLauncherTheme();

  const themes = Object.values(LAUNCHER_THEMES);

  return (
    <div className="flex flex-wrap gap-3">
      {themes.map((theme) => {
        const isUnlocked = isThemeUnlocked(theme.id);
        const isSelected = selectedThemeId === theme.id;

        const button = (
          <button
            key={theme.id}
            onClick={() => {
              if (!disabled && isUnlocked) {
                toggleTheme(theme.id);
              }
            }}
            disabled={disabled || !isUnlocked}
            className={cn(
              "relative flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all duration-200",
              isSelected
                ? "border-white/60 bg-white/10"
                : "border-[#ffffff20] bg-black/20",
              !isUnlocked
                ? "opacity-40 cursor-not-allowed grayscale"
                : disabled
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:border-[#ffffff40] hover:bg-white/5 cursor-pointer"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-md border-2 shadow-lg transition-transform",
                !isUnlocked ? "border-white/10" : "border-white/20",
                isSelected && "scale-105"
              )}
              style={{
                backgroundColor: theme.accentColor.value,
                boxShadow: isSelected ? `0 0 12px ${theme.accentColor.value}50` : undefined,
              }}
            />

            <div className="flex flex-col items-start">
              <span
                className={cn(
                  "font-minecraft-ten text-base transition-colors",
                  isSelected ? "text-white" : "text-white/80"
                )}
              >
                {theme.name}
              </span>
              {!isUnlocked && theme.unlockRequirement && (
                <span className="text-xs text-white/40 font-minecraft-ten">
                  {theme.unlockRequirement.type === "advent-door" && (
                    <>Unlock: Open door {theme.unlockRequirement.day}</>
                  )}
                </span>
              )}
            </div>

            {!isUnlocked && (
              <Icon
                icon="solar:lock-keyhole-bold"
                className="w-4 h-4 text-white/40 absolute top-2 right-2"
              />
            )}

            {isSelected && (
              <Icon
                icon="solar:check-circle-bold"
                className="w-5 h-5 text-white absolute top-2 right-2"
              />
            )}
          </button>
        );

        if (!isUnlocked) {
          return (
            <SimpleTooltip
              key={theme.id}
              content={`Open advent calendar door ${theme.unlockRequirement?.day} to unlock this theme`}
            >
              {button}
            </SimpleTooltip>
          );
        }

        return button;
      })}
    </div>
  );
}
