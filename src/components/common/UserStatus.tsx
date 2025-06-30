import React from 'react';
import { cn } from '../../lib/utils';

export interface UserStatusProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export const getUserStatusColor = (status: string): string => {
  switch (status?.toUpperCase()) {
    case "ONLINE":
      return "border-green-500";
    case "AFK":
      return "border-orange-500";
    case "BUSY":
      return "border-red-500";
    case "AWAY":
    case "INVISIBLE":
    case "OFFLINE":
    default:
      return "border-gray-500";
  }
};

export const getUserStatusText = (status: string): string => {
  switch (status?.toUpperCase()) {
    case "ONLINE":
      return "Online";
    case "AWAY":
      return "Away";
    case "BUSY":
      return "Busy";
    case "AFK":
      return "AFK";
    case "INVISIBLE":
      return "Invisible";
    case "OFFLINE":
    default:
      return "Offline";
  }
};

export const getUserStatusDotColor = (status: string): string => {
  switch (status?.toUpperCase()) {
    case "ONLINE":
      return "bg-green-500";
    case "AFK":
      return "bg-orange-500";
    case "BUSY":
      return "bg-red-500";
    case "AWAY":
    case "INVISIBLE":
    case "OFFLINE":
    default:
      return "bg-gray-500";
  }
};

export const UserStatus: React.FC<UserStatusProps> = ({
  status,
  size = 'md',
  className,
  showText = false,
  textClassName,
}) => {
  const statusText = getUserStatusText(status);
  const statusDotColor = getUserStatusDotColor(status);

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3', 
    lg: 'w-4 h-4',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (showText) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn("rounded-full", statusDotColor, sizeClasses[size])} />
        <span className={cn("text-white/70", textSizeClasses[size], textClassName)}>
          {statusText}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={cn("rounded-full", statusDotColor, sizeClasses[size], className)}
      title={statusText}
    />
  );
};
