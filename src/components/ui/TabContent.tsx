"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { gsap } from "gsap";
import { useThemeStore } from "../../store/useThemeStore";

interface TabContentProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

export function TabContent({
  children,
  className,
  active = true,
}: TabContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const accentColor = useThemeStore((state) => state.accentColor);

  useEffect(() => {
    if (contentRef.current && active) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
        },
      );
    }
  }, [active]);

  return (
    <div
      ref={contentRef}
      className={cn(
        "relative flex-1 min-h-0 p-4 rounded-md overflow-auto custom-scrollbar",
        className,
      )}
      style={{
        backgroundColor: `${accentColor.value}10`,
        boxShadow: `inset 0 1px 0 ${accentColor.value}20, inset 0 0 0 1px ${accentColor.value}10`,
      }}
    >
      {children}
    </div>
  );
}
