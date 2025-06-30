import React from 'react';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { Avatar } from '../components/common/Avatar';

export interface ToastHelperOptions {
  accentColor: string;
  iconName?: string;
  avatarUserId?: string;
  avatarDisplayName?: string;
}

export const showSuccessToast = (message: string, options: ToastHelperOptions) => {
  return toast(message, {
    icon: React.createElement(Icon, {
      icon: options.iconName || "solar:check-circle-bold",
      style: { color: options.accentColor }
    }),
  });
};

export const showErrorToast = (message: string, options: ToastHelperOptions) => {
  return toast(message, {
    icon: React.createElement(Icon, {
      icon: options.iconName || "solar:info-circle-bold",
      style: { color: options.accentColor }
    }),
  });
};

export const showInfoToast = (message: string, options: ToastHelperOptions) => {
  let toastIcon;
  
  if (options.avatarUserId) {
    try {
      toastIcon = React.createElement(Avatar, {
        userId: options.avatarUserId,
        displayName: options.avatarDisplayName || 'Friend',
        size: 24,
        showSkeleton: false
      });
    } catch (error) {
      toastIcon = React.createElement(Icon, {
        icon: options.iconName || "solar:info-circle-bold",
        style: { color: options.accentColor }
      });
    }
  } else {
    toastIcon = React.createElement(Icon, {
      icon: options.iconName || "solar:info-circle-bold",
      style: { color: options.accentColor }
    });
  }

  const result = toast(message, {
    icon: toastIcon,
  });
  
  return result;
};
