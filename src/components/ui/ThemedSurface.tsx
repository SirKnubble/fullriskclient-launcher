"use client";

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../store/useThemeStore';

interface ThemedSurfaceProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  surfaceRef?: React.Ref<HTMLDivElement>;
  alwaysActive?: boolean;
  baseColorHex?: string;
  borderVisibility?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };
  style?: React.CSSProperties;
}

export function ThemedSurface({
  children,
  className,
  onClick,
  onContextMenu,
  surfaceRef,
  alwaysActive = false,
  baseColorHex,
  borderVisibility,
  style: incomingStyle,
}: ThemedSurfaceProps) {
  const accentColorValue = useThemeStore((state) => state.accentColor.value);
  const [isSurfaceHovered, setIsSurfaceHovered] = useState(false);

  const isValidHex = (hex: string | undefined): hex is string => {
    if (!hex) return false;
    return /^#[0-9A-F]{6}$/i.test(hex) || /^#[0-9A-F]{8}$/i.test(hex);
  };

  const effectiveBaseColor = isValidHex(baseColorHex) ? baseColorHex : accentColorValue;

  const parseHexToRgba = (hex: string, alpha: number) => {
    const pureHex = hex.startsWith('#') ? hex.substring(1, 7) : hex.substring(0, 6);
    const r = parseInt(pureHex.substring(0, 2), 16);
    const g = parseInt(pureHex.substring(2, 4), 16);
    const b = parseInt(pureHex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return `rgba(0, 0, 0, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const opacityDefault = 0.2;
  const opacityHover = 0.48;
  const opacityActive = 0.6; // For alwaysActive or future focus state

  let currentBorderOpacity = opacityDefault;
  if (alwaysActive) {
    currentBorderOpacity = opacityActive;
  } else if (isSurfaceHovered) {
    currentBorderOpacity = opacityHover;
  }

  const { 
    top: showTopBorder = true, 
    bottom: showBottomBorder = true, 
    left: showLeftBorder = true, 
    right: showRightBorder = true 
  } = borderVisibility || {};

  const internalStyles = {
    '--surface-bg-default': parseHexToRgba(effectiveBaseColor, 0.03),
    '--surface-bg-hover': parseHexToRgba(effectiveBaseColor, 0.1),
    borderTopColor: ((isSurfaceHovered && !alwaysActive) || showTopBorder) ? parseHexToRgba(effectiveBaseColor, currentBorderOpacity) : 'transparent',
    borderRightColor: ((isSurfaceHovered && !alwaysActive) || showRightBorder) ? parseHexToRgba(effectiveBaseColor, currentBorderOpacity) : 'transparent',
    borderBottomColor: ((isSurfaceHovered && !alwaysActive) || showBottomBorder) ? parseHexToRgba(effectiveBaseColor, currentBorderOpacity) : 'transparent',
    borderLeftColor: ((isSurfaceHovered && !alwaysActive) || showLeftBorder) ? parseHexToRgba(effectiveBaseColor, currentBorderOpacity) : 'transparent',
  } as React.CSSProperties;

  const combinedStyles = { ...internalStyles, ...incomingStyle };

  return (
    <div
      ref={surfaceRef}
      className={cn(
        "relative p-3 transition-colors duration-150 w-full select-none rounded-lg",
        "border-2", // Sets border-width and border-style
        alwaysActive
          ? "bg-[var(--surface-bg-hover)]"
          : "bg-[var(--surface-bg-default)] hover:bg-[var(--surface-bg-hover)]",
        className
      )}
      style={combinedStyles}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsSurfaceHovered(true)}
      onMouseLeave={() => setIsSurfaceHovered(false)}
    >
      {children}
    </div>
  );
} 