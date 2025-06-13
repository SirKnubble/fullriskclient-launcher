"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { cn } from "../../lib/utils";
import { gsap } from "gsap";
import { useThemeStore } from "../../store/useThemeStore";

interface TabHeaderProps {
  title: string;
  icon?: string;
  children?: ReactNode;
  className?: string;
}

export function TabHeader({
  title,
  icon,
  children,
  className,
}: TabHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const accentColor = useThemeStore((state) => state.accentColor);

  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: -20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
        },
      );
    }
  }, []);

  return (
    <div
      ref={headerRef}
      className={cn(
        "flex-shrink-0 flex flex-col gap-4 p-6 backdrop-blur-md border-b-4 shadow-md",
        className,
      )}
      style={{
        backgroundColor: `${accentColor.value}30`,
        borderColor: `${accentColor.value}60`,
        borderBottomColor: accentColor.value,
        boxShadow: `0 4px 0 rgba(0,0,0,0.2), 0 6px 10px rgba(0,0,0,0.25), inset 0 1px 0 ${accentColor.value}20, inset 0 0 0 1px ${accentColor.value}10`,
      }}
    >
      <span
        className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
        style={{ backgroundColor: `${accentColor.value}80` }}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-white font-minecraft text-2xl lowercase flex items-center gap-2">
          {icon && (
            <Icon
              icon={icon}
              className="w-6 h-6"
              style={{ color: accentColor.value }}
            />
          )}
          {title}
        </h2>
        <div className="flex items-center gap-3">{children}</div>
      </div>
    </div>
  );
}
