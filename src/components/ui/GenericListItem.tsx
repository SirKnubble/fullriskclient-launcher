"use client";

import { ReactNode } from "react";

interface GenericListItemProps {
  icon?: ReactNode;
  content: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
  // Add any other props that might be useful for common list item styling or behavior
  // For example, if the item itself needs to be a clickable element beyond specific actions:
  // hoverEffect?: boolean; // e.g., to apply hover:bg-white/5
}

export function GenericListItem({
  icon,
  content,
  actions,
  onClick,
  className = "p-4 flex items-start gap-4 hover:bg-white/5 transition-colors", // Default class from WorldsTab
}: GenericListItemProps) {
  const clickableProps = onClick ? { onClick, role: "button", tabIndex: 0 } : {};

  return (
    <li className={className} {...clickableProps}>
      {/* Icon Section - consistent with WorldsTab structure */}
      {icon && (
        <div className="relative w-24 h-24 flex-shrink-0">
          {/* 
            The icon prop is expected to be a fully formed element.
            If specific styling like border/background from WorldsTab is always desired for the icon container,
            it could be added here or made configurable.
            For now, keeping it simple and letting the passed icon define its own wrapper if needed.
            Example from WorldsTab icon container style:
            className="absolute inset-0 border-2 border-b-4 overflow-hidden rounded-md"
            style={{ 
              backgroundColor: `${accentColor.value}15`, 
              borderColor: `${accentColor.value}30`,
              borderBottomColor: `${accentColor.value}50`,
              boxShadow: `0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 ${accentColor.value}20`
            }}
          */}
          {icon}
        </div>
      )}

      {/* Middle Section (Content) - consistent with WorldsTab structure */}
      <div className="flex-grow min-w-0 h-24 flex flex-col justify-between overflow-hidden">
        {content}
      </div>

      {/* Right Section (Actions) - consistent with WorldsTab structure */}
      {actions && (
        <div className="flex-shrink-0 h-24 flex flex-col items-end justify-center gap-1">
          {actions}
        </div>
      )}
    </li>
  );
} 