"use client";

import { useEffect } from "react";
import { useThemeStore } from "../../store/useThemeStore";

export function ScrollbarProvider() {
  const { accentColor } = useThemeStore();

  useEffect(() => {
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? `${Number.parseInt(result[1], 16)}, ${Number.parseInt(result[2], 16)}, ${Number.parseInt(result[3], 16)}`
        : null;
    };

    const root = document.documentElement;
    root.style.setProperty("--scrollbar-thumb-color", accentColor.value);
    root.style.setProperty(
      "--scrollbar-thumb-hover-color",
      accentColor.hoverValue,
    );

    const rgbValue = hexToRgb(accentColor.value);
    if (rgbValue) {
      root.style.setProperty("--scrollbar-thumb-rgb", rgbValue);
    }
  }, [accentColor]);

  return null;
}
