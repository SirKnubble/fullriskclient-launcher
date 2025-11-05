import { useEffect, useRef } from "react";
import { useChristmasModeStore } from "../../store/christmas-mode-store";
import { useThemeStore, type AccentColor, ACCENT_COLORS } from "../../store/useThemeStore";

const CHRISTMAS_GRADIENT: AccentColor = {
  name: "Christmas Gradient",
  value: "#C41E3A", 
  hoverValue: "#A01729",
  light: "#E74C3C",
  dark: "#0f5132", 
  shadowValue: "rgba(196, 30, 58, 0.5)",
  isCustom: true,
};

export function useChristmasMode() {
  const {
    isEnabled,
    autoEnableInDecember,
    originalAccentColor,
    enableChristmasMode,
    disableChristmasMode,
    toggleChristmasMode,
    setAutoEnable,
    setOriginalAccentColor,
    checkAndAutoEnable,
  } = useChristmasModeStore();

  const { accentColor, setAccentColor } = useThemeStore();
  const isApplyingTheme = useRef(false);

  useEffect(() => {
    checkAndAutoEnable();
  }, [checkAndAutoEnable]);

  useEffect(() => {
    if (isApplyingTheme.current) return;

    if (isEnabled) {
      if (!originalAccentColor && accentColor.value !== CHRISTMAS_GRADIENT.value) {
        setOriginalAccentColor(accentColor.value);
      }
      
      if (accentColor.value !== CHRISTMAS_GRADIENT.value) {
        isApplyingTheme.current = true;
        setAccentColor(CHRISTMAS_GRADIENT);
        setTimeout(() => {
          isApplyingTheme.current = false;
        }, 100);
      }
    } else {
      if (originalAccentColor && accentColor.value === CHRISTMAS_GRADIENT.value) {
        const themeColors = Object.values(ACCENT_COLORS);
        const originalColor = themeColors.find(c => c.value === originalAccentColor);
        
        if (originalColor) {
          isApplyingTheme.current = true;
          setAccentColor(originalColor);
          setTimeout(() => {
            isApplyingTheme.current = false;
          }, 100);
        }
        
        setOriginalAccentColor(null);
      }
    }
  }, [isEnabled, originalAccentColor, accentColor.value, setAccentColor, setOriginalAccentColor]);

  return {
    isEnabled,
    autoEnableInDecember,
    enableChristmasMode,
    disableChristmasMode,
    toggleChristmasMode,
    setAutoEnable,
  };
}
