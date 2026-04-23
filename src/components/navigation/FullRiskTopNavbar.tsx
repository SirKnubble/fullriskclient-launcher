"use client";

import { NotificationBell } from "../header/NotificationBell";
import { useThemeStore } from "../../store/useThemeStore";
import { useMinecraftAuthStore } from "../../store/minecraft-auth-store";

interface FullRiskTopNavbarProps {
  items: Array<{ id: string; label: string }>;
  activeItem?: string;
  onItemClick?: (id: string) => void;
}

export function FullRiskTopNavbar({
  items,
  activeItem,
  onItemClick,
}: FullRiskTopNavbarProps) {
  const { activeAccount } = useMinecraftAuthStore();
  const accentColor = useThemeStore((state) => state.accentColor);
  const renderNavButton = (item: { id: string; label: string }, showDivider: boolean) => {
    const disabled = ["mods", "skins", "capes"].includes(item.id) && !activeAccount;
    const active = activeItem === item.id;

    return (
      <div key={item.id} className="flex items-center" data-tauri-drag-region>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onItemClick?.(item.id)}
          className="font-minecraft text-[34px] px-[20px] lowercase transition-all duration-150 disabled:opacity-15 disabled:cursor-default"
          style={{
            color: active ? accentColor.value : "#ffffff",
            textShadow: active ? "2px 2px rgba(0,0,0,0.9)" : undefined,
            transform: active ? "scaleX(1.15)" : undefined,
          }}
        >
          {item.label}
        </button>
        {showDivider && (
          <span className="font-minecraft text-[36px] text-white/80 px-[2px]" data-tauri-drag-region>
            |
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className="h-[56px] border-b-[3px]"
      style={{
        borderColor: `${accentColor.value}80`,
        background: "linear-gradient(180deg, rgba(34,33,38,0.98) 0%, rgba(26,25,28,0.98) 100%)",
      }}
      data-tauri-drag-region
    >
      <div className="relative h-full w-full" data-tauri-drag-region>
        <div className="absolute inset-0 flex items-center justify-center px-24" data-tauri-drag-region>
          <div className="flex items-center justify-center gap-0" data-tauri-drag-region>
            {items.map((item, index) =>
              renderNavButton(item, index !== items.length - 1),
            )}
          </div>
        </div>

        <div className="absolute right-8 top-1/2 flex -translate-y-1/2 items-center justify-end">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-black/15 shadow-[0_3px_0_rgba(0,0,0,0.18)]">
            <NotificationBell />
          </div>
        </div>
      </div>
    </div>
  );
}
