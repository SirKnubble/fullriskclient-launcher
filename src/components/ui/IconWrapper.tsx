"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

interface IconWrapperProps {
  /** The icon identifier */
  icon: string;
  /** Additional CSS classes */
  className?: string;
  /** Custom style object */
  style?: React.CSSProperties;
  /** Fallback icon to show while loading */
  fallbackIcon?: string;
  /** Whether to show a placeholder while loading */
  showPlaceholder?: boolean;
  /** Placeholder background color */
  placeholderColor?: string;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
}

export function IconWrapper({
  icon,
  className = "",
  style,
  fallbackIcon,
  showPlaceholder = true,
  placeholderColor = "transparent",
  onClick,
}: IconWrapperProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset loading state when icon changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [icon]);

  // Create a temporary Icon component to check if it loads
  useEffect(() => {
    if (!icon) return;

    // Create a hidden element to test icon loading
    const testElement = document.createElement('div');
    testElement.style.position = 'absolute';
    testElement.style.visibility = 'hidden';
    testElement.style.pointerEvents = 'none';
    testElement.style.width = '1px';
    testElement.style.height = '1px';
    document.body.appendChild(testElement);

    // Use Iconify's built-in loading detection
    const checkIcon = () => {
      try {
        // Simple way to check if icon exists in Iconify's cache
        const iconData = (window as any).Iconify?.getIcon?.(icon);
        if (iconData) {
          setIsLoaded(true);
          setHasError(false);
        } else {
          // Icon not in cache, try to load it
          const timer = setTimeout(() => {
            const recheckIconData = (window as any).Iconify?.getIcon?.(icon);
            if (recheckIconData) {
              setIsLoaded(true);
              setHasError(false);
            } else {
              setHasError(true);
            }
          }, 100); // Small delay to allow icon to load

          return () => clearTimeout(timer);
        }
      } catch (error) {
        setHasError(true);
      }
    };

    const cleanup = checkIcon();
    document.body.removeChild(testElement);

    return cleanup;
  }, [icon]);

  // Determine what to render
  const renderContent = () => {
    if (hasError && fallbackIcon) {
      return <Icon icon={fallbackIcon} className={className} style={style} onClick={onClick} />;
    }
    
    if (hasError && !fallbackIcon) {
      // Show invisible placeholder to maintain layout
      return (
        <div 
          className={className} 
          style={{ 
            ...style, 
            backgroundColor: placeholderColor,
            opacity: showPlaceholder ? 0.3 : 0 
          }} 
          onClick={onClick}
        />
      );
    }

    // Always render the Icon component - Iconify handles loading internally
    return <Icon icon={icon} className={className} style={style} onClick={onClick} />;
  };

  return (
    <div 
      className="flex-shrink-0 inline-flex items-center justify-center"
      style={{
        // Ensure the wrapper maintains consistent dimensions
        minWidth: style?.width || 'auto',
        minHeight: style?.height || 'auto',
      }}
    >
      {renderContent()}
    </div>
  );
}

// Simpler version for most use cases
export function StableIcon({
  icon,
  className = "",
  style,
  onClick,
}: {
  icon: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div 
      className={`flex-shrink-0 inline-flex items-center justify-center ${className}`}
      style={style}
      onClick={onClick}
    >
      <Icon icon={icon} />
    </div>
  );
}
