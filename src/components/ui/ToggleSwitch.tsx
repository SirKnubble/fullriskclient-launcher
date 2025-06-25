import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  size = "md",
  className,
}: ToggleSwitchProps) {
  const accentColor = useThemeStore((state) => state.accentColor);

  const getSizeConfig = () => {
    switch (size) {
      case "sm":
        return {
          track: "w-8 h-4",
          knob: "w-3 h-3",
          knobTranslate: "translate-x-4",
          label: "text-base",
        };
      case "lg":
        return {
          track: "w-14 h-7",
          knob: "w-5 h-5",
          knobTranslate: "translate-x-7",
          label: "text-2xl",
        };
      default:
        return {
          track: "w-10 h-5",
          knob: "w-4 h-4",
          knobTranslate: "translate-x-5",
          label: "text-lg",
        };
    }
  };

  const sizeConfig = getSizeConfig();

  return (
    <label
      className={cn(
        "flex items-center gap-3",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={cn(
            "rounded-full transition-all duration-200 ease-in-out",
            sizeConfig.track,
            checked ? "shadow-inner" : ""
          )}
          style={{
            backgroundColor: checked
              ? `${accentColor.value}80`
              : `${accentColor.value}30`,
            borderWidth: "2px",
            borderStyle: "solid",
            borderColor: checked
              ? `${accentColor.value}CC`
              : `${accentColor.value}50`,
            borderBottomWidth: "3px",
            borderBottomColor: checked
              ? accentColor.dark
              : `${accentColor.value}70`,
            boxShadow: `inset 0 1px 0 ${accentColor.value}20`,
          }}
        >
          <div
            className={cn(
              "absolute top-1/2 left-0.5 -translate-y-1/2 bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out",
              sizeConfig.knob,
              checked ? sizeConfig.knobTranslate : ""
            )}
            style={{
              boxShadow: checked
                ? `0 1px 3px rgba(0,0,0,0.3), 0 0 0 2px ${accentColor.value}40`
                : "0 1px 3px rgba(0,0,0,0.3)",
            }}
          />
        </div>
      </div>

      {label && (
        <span
          className={cn(
            "font-minecraft lowercase text-white",
            sizeConfig.label
          )}
        >
          {label}
        </span>
      )}
    </label>
  );
}
