import React from 'react';
import { Icon } from '@iconify/react';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../store/useThemeStore';
import { Card } from '../ui/Card';
import { IconButton } from '../ui/buttons/IconButton';
import { Avatar } from './Avatar';
import { UserStatus, getUserStatusColor } from './UserStatus';

export interface UserCardAction {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface UserCardProps {
  userId?: string | null;
  displayName: string;
  status?: string;
  avatarSize?: number;
  className?: string;
  actions?: UserCardAction[];
  subtitle?: string;
  server?: string;
  lastSeen?: string;
  showStatusText?: boolean;
  isClickable?: boolean;
  onClick?: () => void;
  badge?: {
    count: number;
    color?: string;
  };
}

export const UserCard: React.FC<UserCardProps> = ({
  userId,
  displayName,
  status = 'OFFLINE',
  avatarSize = 48,
  className,
  actions = [],
  subtitle,
  server,
  lastSeen,
  showStatusText = false,
  isClickable = false,
  onClick,
  badge,
}) => {
  const accentColor = useThemeStore((state) => state.accentColor);

  const statusColor = getUserStatusColor(status);
  const isOnline = status?.toUpperCase() === 'ONLINE';

  const getActionVariantStyles = (variant: UserCardAction['variant']) => {
    switch (variant) {
      case 'primary':
        return 'text-white hover:bg-white/10';
      case 'danger':
        return 'text-red-400 hover:bg-red-400/10';
      case 'secondary':
      default:
        return 'text-white/70 hover:bg-white/5';
    }
  };

  return (
    <Card 
      variant="flat" 
      className={cn(
        "p-4",
        isClickable && "cursor-pointer transition-all duration-200 hover:bg-black/50",
        className
      )}
      onClick={isClickable ? onClick : undefined}
      disableHover={!isClickable}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar
            userId={userId}
            displayName={displayName}
            size={avatarSize}
            className={statusColor}
            showSkeleton={true}
          />
          
          {badge && badge.count > 0 && (
            <div
              className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: badge.color || accentColor.value }}
            >
              {badge.count > 99 ? "99+" : badge.count}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="font-minecraft text-white text-4xl font-medium truncate">
              {displayName}
            </div>
            {showStatusText && (
              <UserStatus status={status} size="sm" showText={true} />
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            {subtitle && (
              <div className="text-xs text-white/60 font-minecraft-ten truncate flex-1">
                {subtitle}
              </div>
            )}
            
            {server && isOnline && (
              <div className="text-xs text-white/40 font-minecraft-ten">
                Playing on {server}
              </div>
            )}
            
            {lastSeen && !isOnline && (
              <div className="text-xs text-white/40 font-minecraft-ten">
                {lastSeen}
              </div>
            )}
          </div>
        </div>

        {actions.length > 0 && (
          <div className="flex items-center gap-1">
            {actions.map((action, index) => (
              <IconButton
                key={index}
                icon={<Icon icon={action.icon} />}
                variant="ghost"
                size="sm"
                className={cn(
                  "opacity-70 hover:opacity-100",
                  getActionVariantStyles(action.variant)
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                disabled={action.disabled}
                aria-label={action.label}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
