"use client";

import type React from "react";
import { forwardRef, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../store/useThemeStore";
import { 
  createRadiusStyle,
  getBorderRadiusClass,
  type ComponentSize,
  type StateVariant
} from "./design-system";

interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: string;  titleIcon?: React.ReactNode;
  children: React.ReactNode;
  size?: ComponentSize | "xs" | "full";
  width?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  state?: StateVariant;
  className?: string;
  footer?: React.ReactNode;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ 
    isOpen = true,
    onClose, 
    title,
    titleIcon,
    children, 
    size = "md",
    width,
    showCloseButton = true,
    closeOnOverlayClick = true,
    closeOnClickOutside,
    closeOnEscape = true,
    state,
    className,
    footer,
  }, ref) => {    const modalRef = useRef<HTMLDivElement>(null);
    const accentColor = useThemeStore((state) => state.accentColor);
    const isAnimationEnabled = useThemeStore((state) => state.isBackgroundAnimationEnabled);    const borderRadius = useThemeStore((state) => state.borderRadius);
    
    const borderRadiusStyle = createRadiusStyle(borderRadius, 1.2);
    const borderRadiusClass = getBorderRadiusClass(borderRadius);

    const effectiveCloseOnOverlayClick = closeOnClickOutside !== undefined ? closeOnClickOutside : closeOnOverlayClick;
    const effectiveSize = width || size;

    const sizeClasses = {
      xs: "max-w-sm",
      sm: "max-w-md",
      md: "max-w-lg", 
      lg: "max-w-2xl",
      xl: "max-w-4xl",
      full: "max-w-[95vw] max-h-[95vh]",
    };

    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (closeOnEscape && e.key === "Escape") {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener("keydown", handleEscape);
        document.body.style.overflow = "hidden";
      }

      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }, [isOpen, closeOnEscape, onClose]);

    useEffect(() => {
      if (isOpen && modalRef.current) {
        modalRef.current.focus();
      }
    }, [isOpen]);    const handleOverlayClick = (e: React.MouseEvent) => {
      if (effectiveCloseOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    };

    if (!isOpen) return null;    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center",
          "bg-black/90 backdrop-blur-xl",
          isAnimationEnabled && "animate-in fade-in duration-300"
        )}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >        <div
          ref={modalRef}
          className={cn(
            "relative w-full m-4 max-h-[90vh] overflow-hidden",
            "backdrop-blur-2xl shadow-2xl border border-b-2",
            borderRadiusClass,
            sizeClasses[effectiveSize],
            isAnimationEnabled && "animate-in zoom-in-95 duration-300 ease-out",
            className,
          )}
          style={{
            backgroundColor: `${accentColor.value}25`,
            borderColor: `${accentColor.value}90`,
            borderBottomColor: accentColor.value,
            ...borderRadiusStyle,
          }}
          tabIndex={-1}
        >          {(title || showCloseButton) && (<div className={cn(
              "flex items-center justify-between p-6 border-b backdrop-blur-2xl",
              "border-opacity-40"
            )}
            style={{
              borderBottomColor: `${accentColor.value}70`,
              backgroundColor: `${accentColor.value}15`
            }}>
              {(title || titleIcon) && (
                <div className="flex items-center gap-3">
                  {titleIcon && (
                    <span className="flex items-center justify-center text-[var(--accent)] text-lg" aria-hidden="true">
                      {titleIcon}
                    </span>
                  )}                  {title && (
                    <h2 
                      id="modal-title"
                      className="text-2xl font-minecraft text-white lowercase"
                    >
                      {title}
                    </h2>
                  )}
                </div>
              )}
              {showCloseButton && (                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "p-2 text-white text-opacity-70 hover:text-opacity-100",
                    "transition-all duration-200",
                    getBorderRadiusClass(borderRadius),
                    "focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-30"
                  )}
                  style={createRadiusStyle(borderRadius)}
                  aria-label="Close modal"
                >
                  <Icon icon="mingcute:close-line" className="w-5 h-5" />
                </button>
              )}
            </div>          )}

          <div className={cn(
            footer ? "p-6" : "p-6 overflow-y-auto",
            effectiveSize === "full" ? "max-h-[calc(95vh-8rem)]" : "max-h-[calc(90vh-8rem)]"
          )}>
            {children}          </div>          {footer && (
            <div className={cn(
              "p-6 border-t border-opacity-40 backdrop-blur-2xl"
            )}
            style={{
              borderTopColor: `${accentColor.value}70`,
              backgroundColor: `${accentColor.value}15`
            }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Modal.displayName = "Modal";
