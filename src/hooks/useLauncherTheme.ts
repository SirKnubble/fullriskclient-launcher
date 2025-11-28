import { useEffect, useRef } from "react";
import { useLauncherThemeStore, LAUNCHER_THEMES } from "../store/launcher-theme-store";
import { useThemeStore, ACCENT_COLORS } from "../store/useThemeStore";

export function useLauncherTheme() {
  const {
    selectedThemeId,
    openedAdventDoors,
    originalAccentColor,
    selectTheme,
    markAdventDoorOpened,
    isThemeUnlocked,
    setOriginalAccentColor,
    getSelectedTheme,
  } = useLauncherThemeStore();

  const { accentColor, setAccentColor } = useThemeStore();
  const isApplyingTheme = useRef(false);


  useEffect(() => {
    if (isApplyingTheme.current) return;

    const selectedTheme = getSelectedTheme();

    if (selectedTheme) {
      if (!originalAccentColor && accentColor.value !== selectedTheme.accentColor.value) {
        setOriginalAccentColor(accentColor);
      }

      if (accentColor.value !== selectedTheme.accentColor.value) {
        isApplyingTheme.current = true;
        setAccentColor(selectedTheme.accentColor);
        setTimeout(() => {
          isApplyingTheme.current = false;
        }, 100);
      }
    } else {
      if (originalAccentColor) {
        const presetColor = Object.values(ACCENT_COLORS).find(
          (c) => c.value === originalAccentColor.value
        );

        if (presetColor || originalAccentColor.isCustom) {
          isApplyingTheme.current = true;
          setAccentColor(originalAccentColor);
          setTimeout(() => {
            isApplyingTheme.current = false;
          }, 100);
        }

        setOriginalAccentColor(null);
      }
    }
  }, [selectedThemeId, originalAccentColor, accentColor.value, setAccentColor, setOriginalAccentColor, getSelectedTheme]);

  const toggleTheme = (themeId: string) => {
    if (selectedThemeId === themeId) {
      selectTheme(null);
    } else {
      if (isThemeUnlocked(themeId)) {
        selectTheme(themeId);
      }
    }
  };

  return {
    selectedThemeId,
    selectedTheme: getSelectedTheme(),
    openedAdventDoors,
    isThemeActive: selectedThemeId !== null,
    themes: LAUNCHER_THEMES,
    toggleTheme,
    markAdventDoorOpened,
    isThemeUnlocked,
  };
}
