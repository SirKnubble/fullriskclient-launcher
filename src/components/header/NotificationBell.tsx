"use client";

import { Icon } from "@iconify/react";
import { useNotificationStore, useUnreadCount } from "../../store/notification-store";

export function NotificationBell() {
  const { openModal } = useNotificationStore();
  const unreadCount = useUnreadCount();

  return (
    <button
      onClick={openModal}
      className="relative p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
      aria-label="Notifications"
    >
      <Icon icon="solar:bell-bold" className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 right-0 bg-red-500 text-white text-[10px] font-minecraft-ten min-w-[16px] h-[16px] flex items-center justify-center px-1 pointer-events-none leading-none -mt-[1px]">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
