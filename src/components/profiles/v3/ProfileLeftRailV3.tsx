"use client";

/**
 * ProfileLeftRailV3 — einheitliche Linke-Achsen-Navigation fuer den
 * Detail-View. Merged die frueheren Main-Tabs (content/worlds/screenshots/logs)
 * und Content-Typen (mods/resourcepacks/...) zu einer Achse mit 2 Sektionen.
 */

import type React from "react";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import type { Profile } from "../../../types/profile";

export type NavKey =
  | "mods" | "resourcepacks" | "shaderpacks" | "datapacks" | "nrc"
  | "worlds" | "screenshots" | "logs";

export const CONTENT_NAV_KEYS: NavKey[] = ["mods", "resourcepacks", "shaderpacks", "datapacks", "nrc"];

interface NavItem {
  key: NavKey;
  icon: string;
  labelKey: string;
  count?: number;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

interface ProfileLeftRailV3Props {
  profile: Profile;
  activeNavItem: NavKey;
  onNavChange: (k: NavKey) => void;
}

export function ProfileLeftRailV3({ profile, activeNavItem, onNavChange }: ProfileLeftRailV3Props) {
  const { t } = useTranslation();

  const modCount = profile.mods?.length ?? 0;

  const groups: NavGroup[] = [
    {
      labelKey: "profiles.tabs.content",
      items: [
        { key: "mods",          icon: "solar:bolt-bold-duotone",         labelKey: "profiles.content.mods",          count: modCount },
        { key: "resourcepacks", icon: "solar:gallery-bold-duotone",      labelKey: "profiles.content.resourcePacks" },
        { key: "shaderpacks",   icon: "solar:sun-bold-duotone",          labelKey: "profiles.content.shaderPacks" },
        { key: "datapacks",     icon: "solar:database-bold-duotone",     labelKey: "profiles.content.dataPacks" },
        { key: "nrc",           icon: "solar:shield-check-bold-duotone", labelKey: "profiles.content.noriskClient" },
      ],
    },
    {
      labelKey: "profiles.tabs.worlds",
      items: [
        { key: "worlds",      icon: "solar:planet-bold-duotone",      labelKey: "profiles.tabs.worlds" },
        { key: "screenshots", icon: "solar:camera-bold-duotone",      labelKey: "profiles.tabs.screenshots" },
        { key: "logs",        icon: "solar:code-square-bold-duotone", labelKey: "profiles.tabs.logs" },
      ],
    },
  ];

  return (
    <aside className="w-60 flex-shrink-0 border-r border-white/5 overflow-y-auto py-3 flex flex-col">
      {groups.map((group, gi) => (
        <div key={gi} className="mb-4">
          <div className="px-4 mb-1.5 text-[10px] uppercase tracking-[0.15em] text-white/35 font-minecraft-ten">
            {gi === 0 ? t("profiles.tabs.content") : t("profiles.v3.leftRail.world")}
          </div>
          <div className="px-2 space-y-0.5">
            {group.items.map((item) => {
              const active = item.key === activeNavItem;
              return (
                <NavButton
                  key={item.key}
                  active={active}
                  icon={item.icon}
                  label={t(item.labelKey)}
                  count={item.count}
                  onClick={() => onNavChange(item.key)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

interface NavButtonProps {
  icon: string;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`group w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors ${
      active ? "bg-white/10 text-white" : "text-white/55 hover:text-white hover:bg-white/5"
    }`}
  >
    <span className={`w-0.5 h-5 rounded-full ${active ? "bg-emerald-400" : "bg-transparent"}`} />
    <Icon icon={icon} className="w-4 h-4 flex-shrink-0" />
    <span className="flex-1 font-minecraft-ten text-sm normal-case truncate">{label}</span>
    {typeof count === "number" && count > 0 && (
      <span className="text-[10px] font-minecraft-ten text-white/40 tabular-nums">{count}</span>
    )}
  </button>
);
