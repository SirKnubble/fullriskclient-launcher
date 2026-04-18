"use client";

/**
 * ThemedDropdown — Accent-getoentes Dropdown-Primitive fuer V3.
 *
 * Konsolidiert die bis dato 4x duplizierte Dropdown-Shell (Filter, Sort,
 * NoRisk-Pack-Selector, Version-Switcher). Wiederverwendbar auch in kommenden
 * V3-Tabs (Worlds/Screenshots/Logs).
 *
 * Der Trigger-Button bleibt beim Caller, weil seine Optik pro Dropdown
 * variiert (accent-tint vs. neutral). Dieses Primitive rendert:
 *   - click-outside Overlay
 *   - den accent-getoenten Panel-Container (blur, border, bg)
 *   - optional: Header, Items, Divider
 *
 * Usage:
 *   <div className="relative">
 *     <button onClick={() => setOpen(v => !v)}>Sort: {activeLabel}</button>
 *     <ThemedDropdown open={open} onClose={() => setOpen(false)} width="w-40" align="right">
 *       {options.map(o => (
 *         <ThemedDropdownItem key={o.value} icon={o.icon} selected={o.value === active} onClick={...}>
 *           {o.label}
 *         </ThemedDropdownItem>
 *       ))}
 *     </ThemedDropdown>
 *   </div>
 */

import type React from "react";
import { Icon } from "@iconify/react";
import { useThemeStore } from "../../../../store/useThemeStore";

interface ThemedDropdownProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Tailwind **min-width** class, z.B. "w-40", "w-60", "w-72". Das Panel
   * waechst mit dem Inhalt ueber diese Untergrenze hinaus (bis `max-w-*`
   * cap), damit lokalisierte Texte nicht abgeschnitten werden.
   * Default: "w-48".
   */
  width?: string;
  /** "left" | "right" — Ausrichtung relativ zum Trigger. Default: "right". */
  align?: "left" | "right";
  /** Max-height + Scroll fuer lange Listen. Default: false. */
  scrollable?: boolean;
  /**
   * Upper bound damit das Panel auch bei extrem langen Inhalten nicht
   * absurd breit wird. Default: "max-w-xs" (320px).
   */
  maxWidth?: string;
  /** Extra Klassen fuer den Panel-Container. */
  className?: string;
}

export function ThemedDropdown({
  open, onClose, children,
  width = "w-48", align = "right", scrollable = false,
  maxWidth = "max-w-xs", className = "",
}: ThemedDropdownProps) {
  const accent = useThemeStore((s) => s.accentColor.value);
  if (!open) return null;
  const alignClass = align === "right" ? "right-0" : "left-0";
  const scrollClass = scrollable ? "max-h-80 overflow-y-auto" : "";
  // `w-XX` wird zur Untergrenze (statt fixer Breite). Das Panel waechst mit
  // dem Inhalt (`w-max`), bis `max-w-*` cap erreicht. Verhindert dass lange
  // Texte in lokalisierten Labels den Panel-Rand ueberschreiten. Der
  // min-width wird als Inline-Style gesetzt damit Tailwind JIT mit
  // unterschiedlichen `w-*` Werten vom Caller klarkommt.
  const minWidthPx = WIDTH_TO_PX[width] ?? 192; // 192px = w-48 default
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        style={{
          backgroundColor: `${accent}1f`,
          borderColor: `${accent}66`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          minWidth: `${minWidthPx}px`,
        }}
        className={`absolute top-full ${alignClass} mt-1 w-max ${maxWidth} rounded-md border shadow-2xl z-20 py-1 ${scrollClass} ${className}`}
      >
        {children}
      </div>
    </>
  );
}

// Mapping Tailwind `w-*` -> Pixel fuer inline min-width (JIT-safe, keine
// dynamische Klassenerzeugung). Erweiterbar falls neue Dropdown-Groessen.
const WIDTH_TO_PX: Record<string, number> = {
  "w-40": 160,
  "w-44": 176,
  "w-48": 192,
  "w-52": 208,
  "w-56": 224,
  "w-60": 240,
  "w-64": 256,
  "w-72": 288,
};

// ────────────────────────────────────────────────────────────────────────────

interface ThemedDropdownItemProps {
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
  /** Zeigt "aktiv"-Styling (gefuellter accent-BG). */
  selected?: boolean;
  disabled?: boolean;
  /** Danger-Variante fuer destructive Actions (z.B. Delete). */
  tone?: "default" | "danger";
}

/**
 * Einzelnes Item. Uebernimmt accent-getoentes Hover + optional Selected-State.
 */
export function ThemedDropdownItem({
  onClick, children, icon, selected, disabled, tone = "default",
}: ThemedDropdownItemProps) {
  const accent = useThemeStore((s) => s.accentColor.value);

  const toneText =
    tone === "danger"
      ? "text-rose-300 hover:text-rose-200"
      : selected
        ? "text-white"
        : "text-white/80 hover:text-white";

  const style: React.CSSProperties = selected
    ? { backgroundColor: `${accent}33` }
    : {};

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      style={style}
      onMouseEnter={(e) => {
        if (selected || disabled) return;
        e.currentTarget.style.backgroundColor = tone === "danger"
          ? "rgba(244, 63, 94, 0.10)"
          : `${accent}40`;
      }}
      onMouseLeave={(e) => {
        if (selected || disabled) return;
        e.currentTarget.style.backgroundColor = "transparent";
      }}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-minecraft-ten text-left transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${toneText}`}
    >
      {icon && <Icon icon={icon} className="w-3.5 h-3.5 flex-shrink-0" />}
      <span className="flex-1 min-w-0">{children}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export const ThemedDropdownDivider: React.FC = () => (
  <div className="my-1 border-t border-white/10" />
);

export const ThemedDropdownHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/40 font-minecraft-ten border-b border-white/10">
    {children}
  </div>
);
