"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { ToggleSwitch } from "./ToggleSwitch";
import { RangeSlider } from "./RangeSlider";
import { Tooltip } from "./Tooltip";

export type SettingType = "toggle" | "range" | "spacer";

export interface BaseSetting {
  id: string;
  label?: string;
  tooltip?: string;
  type: SettingType;
}

export interface ToggleSetting extends BaseSetting {
  type: "toggle";
  value: boolean;
  onChange: (value: boolean) => void;
}

export interface RangeSetting extends BaseSetting {
  type: "range";
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  icon?: string;
  minLabel?: string;
  maxLabel?: string;
}

export interface SpacerSetting extends BaseSetting {
  type: "spacer";
}

export type SettingItem = ToggleSetting | RangeSetting | SpacerSetting;

export interface CompactSettingsGridProps {
  settings: SettingItem[];
  disabled?: boolean;
  className?: string;
}

export function CompactSettingsGrid({
  settings,
  disabled = false,
  className = "",
}: CompactSettingsGridProps) {
  const renderSetting = (setting: SettingItem) => {
    if (setting.type === "spacer") {
      return <div key={setting.id} />;
    }

    if (setting.type === "toggle") {
      return (
        <div
          key={setting.id}
          className="col-span-1 flex items-center justify-between p-2 rounded-lg border border-[#ffffff20] hover:bg-black/30 transition-colors"
        >
          <Tooltip content={setting.tooltip}>
            <h5 className="font-minecraft-ten text-base text-white">
              {setting.label}
            </h5>
          </Tooltip>
          <ToggleSwitch
            checked={setting.value}
            onChange={setting.onChange}
            disabled={disabled}
            size="md"
          />
        </div>
      );
    }

    if (setting.type === "range") {
      return (
        <div
          key={setting.id}
          className="col-span-1 p-2 rounded-lg border border-[#ffffff20] hover:bg-black/30 transition-colors"
        >
          <div className="flex flex-col gap-2">
            <Tooltip content={setting.tooltip}>
              <h5 className="font-minecraft-ten text-base text-white text-center">
                {setting.label}
              </h5>
            </Tooltip>
            <RangeSlider
              value={setting.value}
              onChange={setting.onChange}
              min={setting.min}
              max={setting.max}
              step={setting.step}
              disabled={disabled}
              variant="flat"
              size="sm"
              minLabel={setting.minLabel}
              maxLabel={setting.maxLabel}
              icon={
                setting.icon ? (
                  <Icon icon={setting.icon} className="w-3 h-3" />
                ) : undefined
              }
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {settings.map(renderSetting)}
    </div>
  );
}
