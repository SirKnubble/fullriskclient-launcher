"use client";

import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { Icon } from "@iconify/react";
import { SearchInput } from "./SearchInput";
import type { ReactNode } from "react";

type TabLayoutProps = {
  title: string;
  icon?: string;
  children: ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function TabLayout({
  title,
  icon,
  children,
  search,
  actions,
  className,
  contentClassName,
}: TabLayoutProps) {
  const { accentColor } = useThemeStore();

  const headerStyle = {
    backgroundColor: `${accentColor.value}15`,
    borderColor: `${accentColor.value}60`,
    boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`,
  };

  const contentStyle = {
    borderColor: `${accentColor.value}40`,
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <div
        className={cn(
          "flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4 border-b-2 sticky top-0 z-10",
          "backdrop-blur-md transition-all duration-200",
        )}
        style={headerStyle}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <Icon
              icon={icon}
              className="w-6 h-6 text-white"
              style={{ color: accentColor.value }}
            />
          )}
          <h2 className="font-minecraft text-2xl lowercase text-white">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
          {search && (
            <SearchInput
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder || "Search..."}
              className="w-full md:w-auto flex-grow md:flex-grow-0 h-[42px]"
              variant="flat"
            />
          )}
          {actions}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 p-6 overflow-y-auto custom-scrollbar",
          contentClassName,
        )}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  );
}
