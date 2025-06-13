"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";
import {
  discordAuthLink,
  discordAuthStatus,
  discordAuthUnlink,
} from "../../services/nrc-service";
import { Skeleton } from "../ui/Skeleton";
import { useSocialsModalStore } from "../../store/socials-modal-store";
import { openExternalUrl } from "../../services/tauri-service";
import { IconButton } from "../ui/buttons/IconButton";

// Define a type for social platform configuration
interface SocialPlatform {
  key: string;
  name: string;
  icon: string;
  visitUrl?: string;
  isImplemented: boolean;
  fetchStatus?: () => Promise<boolean>;
  handleLink?: () => Promise<void>;
  handleUnlink?: () => Promise<void>;
}

export function SocialsModal() {
  const { isModalOpen, closeModal } = useSocialsModalStore();
  
  // States for Discord (can be generalized later if needed)
  const [isLoadingDiscordStatus, setIsLoadingDiscordStatus] = useState(true);
  const [isDiscordLinked, setIsDiscordLinked] = useState(false);
  const [isProcessingDiscordAction, setIsProcessingDiscordAction] = useState(false);

  const fetchDiscordStatus = useCallback(async (): Promise<boolean> => {
    setIsLoadingDiscordStatus(true);
    try {
      const status = await discordAuthStatus();
      setIsDiscordLinked(status);
      return status;
    } catch (error) {
      console.error("Failed to fetch Discord auth status:", error);
      toast.error("Could not fetch Discord status. See console.");
      setIsDiscordLinked(false);
      return false;
    } finally {
      setIsLoadingDiscordStatus(false);
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      fetchDiscordStatus();
      // Future: fetch statuses for other implemented platforms
    }
  }, [isModalOpen, fetchDiscordStatus]);

  const handleDiscordLink = async () => {
    setIsProcessingDiscordAction(true);
    try {
      await discordAuthLink(); // Rust backend handles window, this waits for it to complete
      
      // Now that the linking window process is done, re-fetch status to update UI
      const successfullyLinked = await fetchDiscordStatus();

      if (successfullyLinked) {
        toast.success("Discord account successfully linked!");
      } else {
        toast("Discord linking process finished. Please check your link status or try again if needed.");
      }
      // Modal remains open to show updated status
    } catch (error) {
      console.error("Failed to initiate Discord linking process:", error);
      toast.error("Could not start Discord linking. See console for details.");
    } finally {
      setIsProcessingDiscordAction(false);
    }
  };

  const handleDiscordUnlink = async () => {
    setIsProcessingDiscordAction(true);
    try {
      await discordAuthUnlink();
      toast.success("Discord account unlinked successfully.");
      setIsDiscordLinked(false);
    } catch (error) {
      console.error("Failed to unlink Discord account:", error);
      toast.error("Could not unlink Discord. See console.");
    } finally {
      setIsProcessingDiscordAction(false);
    }
  };

  const socialPlatforms: SocialPlatform[] = [
    {
      key: "discord",
      name: "Discord",
      icon: "ic:baseline-discord",
      visitUrl: "https://discord.norisk.gg",
      isImplemented: true,
      fetchStatus: fetchDiscordStatus,
      handleLink: handleDiscordLink,
      handleUnlink: handleDiscordUnlink,
    },
    {
      key: "youtube",
      name: "YouTube",
      icon: "mdi:youtube",
      visitUrl: "https://www.youtube.com/@NoRiskClient",
      isImplemented: false,
    },
    {
      key: "x",
      name: "X (Twitter)",
      icon: "simple-icons:x",
      visitUrl: "https://twitter.com/NoRiskClient",
      isImplemented: false,
    },
    {
      key: "tiktok",
      name: "TikTok",
      icon: "ic:baseline-tiktok",
      visitUrl: "https://www.tiktok.com/@noriskclient",
      isImplemented: false,
    },
    {
      key: "twitch",
      name: "Twitch",
      icon: "mdi:twitch",
      visitUrl: "https://www.twitch.tv/NoRiskClient",
      isImplemented: false,
    },
  ];

  if (!isModalOpen) {
    return null;
  }

  const renderPlatformRow = (platform: SocialPlatform) => {
    const isLoadingStatus = platform.key === "discord" ? isLoadingDiscordStatus : false;
    const isLinked = platform.key === "discord" ? isDiscordLinked : false; // Placeholder for others
    const isProcessingAction =
      platform.key === "discord" ? isProcessingDiscordAction : false;

    return (
      <div
        key={platform.key}
        className="flex items-center justify-between p-3 bg-black/20 rounded-md mb-2 gap-2"
      >
        <div className="flex items-center flex-grow">
          <Icon icon={platform.icon} className="w-7 h-7 mr-3 text-white/80 flex-shrink-0" />
          <span className="text-white/90 font-medium font-minecraft-ten text-xs">
            Link {platform.name} account
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {platform.isImplemented && platform.handleLink && platform.handleUnlink ? (
            isLinked ? (
              <Button
                variant="destructive"
                onClick={platform.handleUnlink}
                disabled={isProcessingAction || isLoadingStatus}
                size="sm"
                icon={<Icon icon="mdi:link-off" />}
              >
                Unlink
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={platform.handleLink}
                disabled={isProcessingAction || isLoadingStatus}
                size="sm"
                icon={<Icon icon="mdi:link-variant" />}
              >
                Link
              </Button>
            )
          ) : (
            <Button variant="secondary" size="sm" disabled icon={<Icon icon="mdi:link-variant" />}>
              Link
            </Button>
          )}
          {platform.visitUrl && (
            <IconButton
              variant="ghost" 
              size="sm"
              onClick={() => openExternalUrl(platform.visitUrl!)}
              icon={<Icon icon="mdi:arrow-top-right-bold-box-outline" className="w-5 h-5" />}
              aria-label={`Visit ${platform.name} page`}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      title="Social Accounts"
      titleIcon={<Icon icon="fluent:people-community-20-filled" className="w-7 h-7" />} // Generic icon
      onClose={closeModal}
      width="md" // Adjusted width for more content
    >
      <div className="p-4 space-y-3 min-h-[55vh] max-h-[60vh] overflow-y-auto custom-scrollbar">
        {isLoadingDiscordStatus && socialPlatforms.find(p => p.key === 'discord')?.isImplemented ? (
          <div className="space-y-2">
            {socialPlatforms.filter(p => p.isImplemented && p.key === 'discord').map((platform, i) => (
              <div key={`skeleton-discord-${i}`} className="flex items-center justify-between p-3 bg-black/20 rounded-md gap-2">
                <div className="flex items-center flex-grow">
                  <Skeleton variant="block" width={28} height={28} className="mr-3 flex-shrink-0" />
                  <Skeleton variant="text" width={150} height={16} />
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Skeleton variant="block" width={80} height={32} />
                  {platform.visitUrl && <Skeleton variant="block" width={32} height={32} /> }
                </div>
              </div>
            ))}
            {socialPlatforms.filter(p => !p.isImplemented || p.key !== 'discord').map(platform => (
              <div key={`skeleton-${platform.key}`} className="flex items-center justify-between p-3 bg-black/20 rounded-md opacity-70 gap-2">
                <div className="flex items-center flex-grow">
                  <Icon icon={platform.icon} className="w-7 h-7 mr-3 text-white/50 flex-shrink-0" />
                  <span className='text-white/60 font-minecraft-ten text-xs'>Link {platform.name} account</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button variant="secondary" size="sm" disabled icon={<Icon icon="mdi:link-variant" />}>
                    Link
                  </Button>
                  {platform.visitUrl && (
                    <IconButton
                      variant="ghost"
                      size="sm"
                      disabled
                      icon={<Icon icon="mdi:arrow-top-right-bold-box-outline" className="w-5 h-5" />}
                      aria-label={`Visit ${platform.name} page`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          socialPlatforms.map(renderPlatformRow)
        )}
      </div>
    </Modal>
  );
} 