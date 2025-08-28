"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { useThemeStore } from "../../store/useThemeStore";
import type { Profile } from "../../types/profile";

export interface ActionButton {
  /** Unique identifier for the button */
  id: string;
  /** Label text to display */
  label: string;
  /** Icon to display */
  icon: string;
  /** Button variant/style */
  variant: "primary" | "secondary" | "icon-only" | "destructive";
  /** Optional tooltip text */
  tooltip?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Click handler */
  onClick: (profile: Profile, e: React.MouseEvent) => void;
}

export interface ProfileActionButtonsProps {
  /** The profile these actions are for */
  profile: Profile;
  /** Array of action button configurations */
  actions: ActionButton[];
  /** Additional CSS classes */
  className?: string;
  /** Whether to use flex-grow spacer between buttons */
  useFlexSpacer?: boolean;
  /** Index after which to insert the flex spacer (only if useFlexSpacer is true) */
  flexSpacerAfterIndex?: number;
}

export function ProfileActionButtons({
  profile,
  actions,
  className = "",
  useFlexSpacer = false,
  flexSpacerAfterIndex = 1,
}: ProfileActionButtonsProps) {
  const accentColor = useThemeStore((state) => state.accentColor);

  const handleButtonClick = (action: ActionButton, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!action.disabled) {
      action.onClick(profile, e);
    }
  };

  const getButtonStyles = (action: ActionButton) => {
    const baseClasses = "transition-all duration-200 hover:scale-105 border font-minecraft lowercase text-2xl rounded-lg flex items-center gap-2";
    
    switch (action.variant) {
      case "primary":
        return {
          className: `${baseClasses} text-white px-3 py-1`,
          style: {
            backgroundColor: `${accentColor.value}20`,
            borderColor: `${accentColor.value}60`,
            color: 'white',
          },
          onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
            if (!action.disabled) {
              e.currentTarget.style.backgroundColor = `${accentColor.value}30`;
              e.currentTarget.style.borderColor = `${accentColor.value}80`;
            }
          },
          onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
            if (!action.disabled) {
              e.currentTarget.style.backgroundColor = `${accentColor.value}20`;
              e.currentTarget.style.borderColor = `${accentColor.value}60`;
            }
          },
        };
      
      case "secondary":
        return {
          className: `${baseClasses} bg-black/30 hover:bg-black/40 text-white/70 hover:text-white px-3 py-1 border-white/10 hover:border-white/20`,
          style: {},
        };
      
      case "icon-only":
        return {
          className: `${baseClasses} bg-black/30 hover:bg-black/40 text-white/70 hover:text-white py-[0.57rem] px-[0.57rem] justify-center border-white/10 hover:border-white/20`,
          style: {},
        };
      
      case "destructive":
        return {
          className: `${baseClasses} bg-red-600/20 hover:bg-red-600/30 text-white hover:text-white px-3 py-1 border-red-500/30 hover:border-red-500/50`,
          style: {},
        };
      
      default:
        return {
          className: `${baseClasses} bg-black/30 hover:bg-black/40 text-white/70 hover:text-white px-3 py-1 border-white/10 hover:border-white/20`,
          style: {},
        };
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {actions.map((action, index) => {
        const buttonStyles = getButtonStyles(action);
        const isDisabled = action.disabled;
        
        const buttonElement = (
          <button
            key={action.id}
            onClick={(e) => handleButtonClick(action, e)}
            className={`${buttonStyles.className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={!isDisabled ? buttonStyles.style : { ...buttonStyles.style, opacity: 0.5 }}
            onMouseEnter={!isDisabled ? buttonStyles.onMouseEnter : undefined}
            onMouseLeave={!isDisabled ? buttonStyles.onMouseLeave : undefined}
            title={action.tooltip}
            disabled={isDisabled}
          >
            <div className={action.variant === "icon-only" ? "w-5 h-5 flex items-center justify-center" : "w-4 h-4 flex items-center justify-center"}>
              <Icon 
                icon={action.icon} 
                className={action.variant === "icon-only" ? "w-5 h-5" : "w-4 h-4"} 
              />
            </div>
             {action.variant !== "icon-only" && (
               <span style={{ transform: 'translateY(-0.075em)' }}>{action.label}</span>
             )}
          </button>
        );

        // Insert flex spacer if needed
        if (useFlexSpacer && index === flexSpacerAfterIndex) {
          return (
            <React.Fragment key={`${action.id}-with-spacer`}>
              {buttonElement}
              <div className="flex-1"></div>
            </React.Fragment>
          );
        }

        return buttonElement;
      })}
    </div>
  );
}
