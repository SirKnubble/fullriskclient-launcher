"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";
import { useThemeStore } from "../../store/useThemeStore";
import type { Reward } from "../../types/advent";

interface AdventRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: number;
  reward: Reward | null;
  isLoading?: boolean;
}

function RewardDisplay({ reward }: { reward: Reward }) {
  const accentColor = useThemeStore((state) => state.accentColor);

  const renderReward = () => {
    switch (reward.type) {
      case "Coins":
        return (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-24 h-24 rounded-lg flex items-center justify-center border-2"
              style={{
                backgroundColor: `${accentColor.value}20`,
                borderColor: accentColor.value,
              }}
            >
              <Icon
                icon="solar:coins-bold"
                className="w-16 h-16"
                style={{ color: accentColor.value }}
              />
            </div>
            <div className="text-center">
              <p className="font-minecraft-ten text-2xl text-white mb-1">
                {reward.amount} Coins
              </p>
              <p className="font-minecraft-ten text-white/60 text-sm">Added to your account</p>
            </div>
          </div>
        );

      case "ShopItem":
        return (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-24 h-24 rounded-lg flex items-center justify-center border-2"
              style={{
                backgroundColor: `${accentColor.value}20`,
                borderColor: accentColor.value,
              }}
            >
              <Icon
                icon="solar:shop-bold"
                className="w-16 h-16"
                style={{ color: accentColor.value }}
              />
            </div>
            <div className="text-center">
              <p className="font-minecraft-ten text-xl text-white mb-1">
                Shop Item
              </p>
              <p className="font-minecraft-ten text-white/60 text-sm">
                {reward.duration
                  ? `Duration: ${Math.floor(reward.duration / (1000 * 60 * 60 * 24))} days`
                  : "Permanent"}
              </p>
            </div>
          </div>
        );

      case "RandomShopItem":
        return (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-24 h-24 rounded-lg flex items-center justify-center border-2"
              style={{
                backgroundColor: `${accentColor.value}20`,
                borderColor: accentColor.value,
              }}
            >
              <Icon
                icon="solar:gift-bold"
                className="w-16 h-16"
                style={{ color: accentColor.value }}
              />
            </div>
            <div className="text-center">
              <p className="font-minecraft-ten text-xl text-white mb-1">
                Random {reward.itemType}
              </p>
              <p className="font-minecraft-ten text-white/60 text-sm">
                {reward.duration
                  ? `Duration: ${Math.floor(reward.duration / (1000 * 60 * 60 * 24))} days`
                  : "Permanent"}
              </p>
            </div>
          </div>
        );

      case "Discount":
        return (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-24 h-24 rounded-lg flex items-center justify-center border-2"
              style={{
                backgroundColor: `${accentColor.value}20`,
                borderColor: accentColor.value,
              }}
            >
              <Icon
                icon="solar:tag-price-bold"
                className="w-16 h-16"
                style={{ color: accentColor.value }}
              />
            </div>
            <div className="text-center">
              <p className="font-minecraft-ten text-2xl text-white mb-1">
                {reward.percentage}% Discount
              </p>
              <p className="font-minecraft-ten text-white/60 text-sm">
                Valid until {new Date(reward.endTimestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
        );

      case "NrcPlus":
        return (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-24 h-24 rounded-lg flex items-center justify-center border-2"
              style={{
                backgroundColor: `${accentColor.value}20`,
                borderColor: accentColor.value,
              }}
            >
              <Icon
                icon="solar:star-bold"
                className="w-16 h-16"
                style={{ color: accentColor.value }}
              />
            </div>
            <div className="text-center">
              <p className="font-minecraft-ten text-xl text-white mb-1">
                NoRisk Plus
              </p>
              <p className="font-minecraft-ten text-white/60 text-sm">
                {Math.floor(reward.duration / (1000 * 60 * 60 * 24))} days
              </p>
            </div>
          </div>
        );

      case "Theme":
        return (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-24 h-24 rounded-lg flex items-center justify-center border-2"
              style={{
                backgroundColor: `${accentColor.value}20`,
                borderColor: accentColor.value,
              }}
            >
              <Icon
                icon="solar:palette-bold"
                className="w-16 h-16"
                style={{ color: accentColor.value }}
              />
            </div>
            <div className="text-center">
              <p className="font-minecraft-ten text-xl text-white mb-1">
                Theme Unlocked
              </p>
              <p className="font-minecraft-ten text-white/60 text-sm">Theme ID: {reward.themeId}</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center gap-4">
            <Icon
              icon="solar:gift-bold"
              className="w-16 h-16"
              style={{ color: accentColor.value }}
            />
            <p className="font-minecraft-ten text-xl text-white">Unknown Reward</p>
          </div>
        );
    }
  };

  return <div className="py-6">{renderReward()}</div>;
}

export function AdventRewardModal({
  isOpen,
  onClose,
  day,
  reward,
  isLoading = false,
}: AdventRewardModalProps) {
  const accentColor = useThemeStore((state) => state.accentColor);

  return (
    <Modal
      title={`Day ${day} Reward`}
      titleIcon={
        <Icon
          icon="solar:gift-bold"
          className="w-6 h-6"
          style={{ color: accentColor.value }}
        />
      }
      onClose={onClose}
      width="lg"
    >
      <div className="p-6 min-h-[300px] flex flex-col justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="animate-spin">
              <Icon
                icon="solar:refresh-bold"
                className="w-12 h-12"
                style={{ color: accentColor.value }}
              />
            </div>
            <p className="font-minecraft-ten text-white/70">Claiming reward...</p>
          </div>
        ) : reward ? (
          <RewardDisplay reward={reward} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Icon
              icon="solar:info-circle-bold"
              className="w-12 h-12 text-white/50"
            />
            <p className="font-minecraft-ten text-white/70">No reward available</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

