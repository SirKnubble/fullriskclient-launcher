"use client";

import type React from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../lib/utils";
import { useThemeStore } from "../../../store/useThemeStore";

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
  width?: number;
  className?: string;
  children: React.ReactNode;
  position?: "bottom" | "top" | "left" | "right";
}

export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      isOpen,
      onClose,
      triggerRef,
      width = 300,
      className,
      children,
      position = "bottom",
    },
    ref,
  ) => {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [dropdownTop, setDropdownTop] = useState<number>(0);
    const [dropdownLeft, setDropdownLeft] = useState<number>(0);
    const [animationState, setAnimationState] = useState<
      "entering" | "entered" | "exiting" | "exited"
    >("exited");
    const accentColor = useThemeStore((state) => state.accentColor);
    const previousIsOpen = useRef(isOpen);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [dropdownHeight, setDropdownHeight] = useState(300);

    useEffect(() => {
      setIsMounted(true);
      return () => {
        setIsMounted(false);
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (isOpen !== previousIsOpen.current) {
        if (isOpen) {
          if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
          }

          setAnimationState("entering");
          setTimeout(() => {
            if (isMounted) {
              setAnimationState("entered");
            }
          }, 10);
        } else if (
          animationState === "entered" ||
          animationState === "entering"
        ) {
          setAnimationState("exiting");

          closeTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              setAnimationState("exited");
            }
            closeTimeoutRef.current = null;
          }, 200);
        }

        previousIsOpen.current = isOpen;
      }
    }, [isOpen, animationState, isMounted]);

    // Update dropdown height after it's rendered
    useEffect(() => {
      if (isOpen && dropdownRef.current && animationState === "entered") {
        const height = dropdownRef.current.offsetHeight;
        setDropdownHeight(height);
        // Recalculate position with the actual height
        calculatePosition(height);
      }
    }, [isOpen, animationState]);

    const calculatePosition = useCallback(
      (actualHeight?: number) => {
        if (!isOpen || !triggerRef.current) return;

        const rect = triggerRef.current.getBoundingClientRect();
        let top = 0;
        let left = 0;

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;

        // Use actual height if available, otherwise estimate
        const estimatedHeight = actualHeight || Math.min(400, dropdownHeight);
        const offset = 12; // Increased offset for better spacing

        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        let effectivePosition = position;
        if (
          position === "bottom" &&
          spaceBelow < estimatedHeight &&
          spaceAbove > estimatedHeight
        ) {
          effectivePosition = "top";
        } else if (
          position === "top" &&
          spaceAbove < estimatedHeight &&
          spaceBelow > estimatedHeight
        ) {
          effectivePosition = "bottom";
        }

        switch (effectivePosition) {
          case "bottom":
            top = rect.bottom + scrollY + offset;
            left = rect.left + scrollX + rect.width / 2 - width / 2;
            break;
          case "top":
            top = rect.top + scrollY - estimatedHeight - offset;
            left = rect.left + scrollX + rect.width / 2 - width / 2;
            break;
          case "left":
            top = rect.top + scrollY + rect.height / 2 - estimatedHeight / 2;
            left = rect.left + scrollX - width - offset;
            break;
          case "right":
            top = rect.top + scrollY + rect.height / 2 - estimatedHeight / 2;
            left = rect.right + scrollX + offset;
            break;
        }

        // Ensure dropdown stays within viewport
        const padding = 16;
        left = Math.max(padding + scrollX, left);
        left = Math.min(left, viewportWidth + scrollX - width - padding);

        // Ensure dropdown doesn't go above the viewport
        top = Math.max(padding + scrollY, top);

        // If dropdown would go below viewport, try to position it above if there's space
        if (top + estimatedHeight > viewportHeight + scrollY - padding) {
          if (rect.top - estimatedHeight - offset > padding) {
            // Position above if there's enough space
            top = rect.top + scrollY - estimatedHeight - offset;
          } else {
            // Otherwise, position at the bottom of the viewport with padding
            top = viewportHeight + scrollY - estimatedHeight - padding;
          }
        }

        setDropdownTop(top);
        setDropdownLeft(left);
      },
      [isOpen, triggerRef, width, position, dropdownHeight],
    );

    useEffect(() => {
      const handleResizeOrScroll = () => calculatePosition();

      if (isOpen) {
        calculatePosition();
        window.addEventListener("resize", handleResizeOrScroll);
        window.addEventListener("scroll", handleResizeOrScroll, true);
      }

      return () => {
        window.removeEventListener("resize", handleResizeOrScroll);
        window.removeEventListener("scroll", handleResizeOrScroll, true);
      };
    }, [isOpen, calculatePosition]);
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(event.target as Node)
        ) {
          onClose();
        }
      };

      if (isOpen) {
        setTimeout(() => {
          document.addEventListener("mousedown", handleClickOutside);
        }, 0);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen, onClose, triggerRef]);

    if (!isMounted || animationState === "exited") {
      return null;
    }

    const getAnimationClasses = () => {
      switch (position) {
        case "bottom":
          return {
            entering: "opacity-0 translate-y-[-10px]",
            entered: "opacity-100 translate-y-0",
            exiting: "opacity-0 translate-y-[-10px]",
          };
        case "top":
          return {
            entering: "opacity-0 translate-y-[10px]",
            entered: "opacity-100 translate-y-0",
            exiting: "opacity-0 translate-y-[10px]",
          };
        case "left":
          return {
            entering: "opacity-0 translate-x-[10px]",
            entered: "opacity-100 translate-x-0",
            exiting: "opacity-0 translate-x-[10px]",
          };
        case "right":
          return {
            entering: "opacity-0 translate-x-[-10px]",
            entered: "opacity-100 translate-x-0",
            exiting: "opacity-0 translate-x-[-10px]",
          };
      }
    };

    const animationClasses = getAnimationClasses();

    return createPortal(
      <div
        ref={(node) => {
          if (ref) {
            if (typeof ref === "function") {
              ref(node);
            } else {
              ref.current = node;
            }
          }
          dropdownRef.current = node;
        }}
        className={cn(
          "fixed font-minecraft backdrop-blur-md z-50 overflow-hidden",
          "rounded-md text-white",
          "transition-all duration-200",
          "border-2 border-b-4 shadow-[0_8px_0_rgba(0,0,0,0.3),0_10px_15px_rgba(0,0,0,0.35)]",
          animationState === "entering" && animationClasses.entering,
          animationState === "entered" && animationClasses.entered,
          animationState === "exiting" && animationClasses.exiting,
          className,
        )}
        style={{
          top: `${dropdownTop}px`,
          left: `${dropdownLeft}px`,
          width: `${width}px`,
          backgroundColor: `${accentColor.value}15`,
          borderColor: `${accentColor.value}40`,
          borderBottomColor: accentColor.dark,
          boxShadow: `0 8px 0 rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.35), inset 0 1px 0 ${accentColor.light}20, inset 0 0 0 1px ${accentColor.value}10`,
        }}
      >
        <div className="absolute inset-0 opacity-20 bg-gradient-radial from-white/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">{children}</div>
      </div>,
      document.body,
    );
  },
);

Dropdown.displayName = "Dropdown";