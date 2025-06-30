import React from 'react';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../store/useThemeStore';
import { useAvatarLoader } from '../../hooks/useAvatarLoader';
import { Skeleton } from '../ui/Skeleton';

interface AvatarProps {
  userId?: string | null;
  displayName?: string;
  size?: number;
  className?: string;
  showSkeleton?: boolean;
  fallbackColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  userId,
  displayName = 'Unknown',
  size = 48,
  className,
  showSkeleton = true,
  fallbackColor,
}) => {
  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);
  
  const avatarState = useAvatarLoader(userId);
  const finalFallbackColor = fallbackColor || accentColor.value;

  const avatarSize = `${size}px`;
  const borderRadiusValue = `${borderRadius}px`;

  if (avatarState.loading && showSkeleton) {
    return (
      <div className={className} style={{ width: avatarSize, height: avatarSize }}>
        <Skeleton
          variant="image"
          width={avatarSize}
          height={avatarSize}
          className="rounded-full"
          shadowDepth="none"
          style={{ borderRadius: borderRadiusValue }}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "border-2",
          className || "border-transparent"
        )}
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: borderRadiusValue,
        }}
      >
        {avatarState.loaded && avatarState.url ? (
          <img
            src={avatarState.url}
            alt={displayName}
            className="w-full h-full object-cover p-0.5"
            style={{ borderRadius: `${borderRadius * 0.8}px` }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        
        <div
          className="w-full h-full flex items-center justify-center text-white font-minecraft font-bold absolute top-0.5 left-0.5 p-0.5"
          style={{
            backgroundColor: finalFallbackColor,
            borderRadius: `${borderRadius * 0.8}px`,
            display: (avatarState.loaded && avatarState.url) ? "none" : "flex",
            fontSize: `${size * 0.3}px`,
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  );
};
