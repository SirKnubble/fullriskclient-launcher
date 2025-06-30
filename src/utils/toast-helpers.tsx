import React from 'react';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';

export interface ToastHelperOptions {
  accentColor: string;
  iconName?: string;
}

export const showSuccessToast = (message: string, options: ToastHelperOptions) => {
  return toast(message, {
    icon: (
      <Icon
        icon={options.iconName || "solar:check-circle-bold"}
        style={{ color: options.accentColor }}
      />
    ),
  });
};

export const showErrorToast = (message: string, options: ToastHelperOptions) => {
  return toast(message, {
    icon: (
      <Icon
        icon={options.iconName || "solar:info-circle-bold"}
        style={{ color: options.accentColor }}
      />
    ),
  });
};

export const showInfoToast = (message: string, options: ToastHelperOptions) => {
  return toast(message, {
    icon: (
      <Icon
        icon={options.iconName || "solar:info-circle-bold"}
        style={{ color: options.accentColor }}
      />
    ),
  });
};
