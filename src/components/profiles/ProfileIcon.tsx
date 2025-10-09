import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import type {
  ProfileBanner,
  ImageSourceAbsolutePath,
} from "../../types/profile";
import { cn } from "../../lib/utils";
import * as ProfileService from "../../services/profile-service";
import { toast } from "react-hot-toast";

interface ProfileIconProps {
  profileId: string;
  banner: ProfileBanner | null | undefined;
  profileName?: string;
  accentColor: string;
  onSuccessfulUpdate: () => void;
  className?: string;
  placeholderIcon?: string;
  iconClassName?: string;
  isEditable?: boolean;
  variant?: "default" | "bare";
  borderWidthClassName?: string;
  roundedClassName?: string;
  bgColorOpacity?: string;
  borderColorOpacity?: string;
}

export function ProfileIcon({
  profileId,
  banner,
  profileName,
  accentColor,
  onSuccessfulUpdate,
  className,
  placeholderIcon = "solar:gallery-add-bold",
  iconClassName = "w-6 h-6",
  isEditable = true,
  variant = "default",
  borderWidthClassName = "border-2",
  roundedClassName = "rounded",
  bgColorOpacity = "30",
  borderColorOpacity = "50",
}: ProfileIconProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [hasLoadedImage, setHasLoadedImage] = useState(false);
  const [imageOpacity, setImageOpacity] = useState(0);

  useEffect(() => {
    const resolveImageUrlWithService = async () => {
      if (banner?.source) {
        setIsLoading(true);
        
        // Verzögerte Anzeige der Loading-Animation um Flackern zu vermeiden
        const loadingTimeout = setTimeout(() => {
          setShowLoading(true);
        }, 100); // 100ms Verzögerung
        
        try {
          const resolvedPathOrUrl = await ProfileService.resolveImagePath(
            banner.source,
            profileId,
          );

          if (
            banner.source.type === "absolutePath" ||
            banner.source.type === "relativePath" ||
            banner.source.type === "relativeProfile"
          ) {
            if (resolvedPathOrUrl) { 
              const assetUrl = await convertFileSrc(resolvedPathOrUrl);
              setImageUrl(assetUrl + '?v=' + Date.now()); // Cache busting
              setHasLoadedImage(true);
              // Fade-in mit kleiner Verzögerung für smooth transition
              setTimeout(() => setImageOpacity(1), 50);
            } else {
                setImageUrl(null);
                setHasLoadedImage(false);
                setImageOpacity(0);
            }
          } else {
            // For URL or Base64, the resolvedPathOrUrl is already the final URL
            // No cache buster needed here as these are not typical file path caching scenarios
            setImageUrl(resolvedPathOrUrl);
            setHasLoadedImage(!!resolvedPathOrUrl);
            if (resolvedPathOrUrl) {
              setTimeout(() => setImageOpacity(1), 50);
            } else {
              setImageOpacity(0);
            }
          }
        } catch (error) {
          console.error(
            "Error resolving image source via service:",
            banner.source,
            error,
          );
          setImageUrl(null);
          setHasLoadedImage(false);
          setImageOpacity(0);
        } finally {
          clearTimeout(loadingTimeout);
          setIsLoading(false);
          setShowLoading(false);
        }
      } else {
        setImageUrl(null);
        setIsLoading(false);
        setShowLoading(false);
        setHasLoadedImage(false);
        setImageOpacity(0);
      }
    };

    resolveImageUrlWithService();
  }, [banner, profileId]);

  const handleIconClick = useCallback(async () => {
    if (!isEditable || isLoading || isUpdating) {
      return;
    }

    try {
      const selectedPath = await open({
        title: "Select Profile Icon",
        multiple: false,
        directory: false,
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
        ],
      });

      if (typeof selectedPath === "string" && selectedPath) {
        setIsUpdating(true);
        setShowLoading(true);
        setHasLoadedImage(false); // Reset während Upload
        setImageOpacity(0);
        try {
          await ProfileService.uploadProfileImages({
            profileId: profileId,
            path: selectedPath,
            imageType: "icon",
          });
          toast.success("Profile icon updated!");
          onSuccessfulUpdate();
        } catch (error) {
          console.error("Failed to upload profile icon:", error);
          toast.error("Could not update profile icon.");
        } finally {
          setIsUpdating(false);
          setShowLoading(false);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Dialog cancelled by user")) {
        // Do nothing, user cancelled.
      } else {
        console.error("Error selecting image:", error);
        toast.error("Failed to open image dialog.");
      }
    }
  }, [isEditable, isLoading, isUpdating, profileId, onSuccessfulUpdate]);

  const canBeClicked = isEditable && !isLoading && !isUpdating;
  const displaySpinner = showLoading || isUpdating;

  const effectiveIconClassName = cn(iconClassName, displaySpinner && "opacity-50");
  const displayPlaceholderIcon = displaySpinner ? "eos-icons:loading" : placeholderIcon;
  const hasImage = imageUrl && hasLoadedImage && !isLoading;
  const shouldShowPlaceholder = !banner?.source && !isLoading;
  
  const baseContainerClasses = "flex items-center justify-center flex-shrink-0 transition-all duration-200 ease-in-out relative group overflow-hidden";

  const variantClasses = variant === "default" ? cn(borderWidthClassName, roundedClassName) : "";
  const variantStyles = variant === "default" ? {
    backgroundColor: `${accentColor}${bgColorOpacity}`,
    borderColor: `${accentColor}${borderColorOpacity}`,
  } : {};

  const placeholderIconStyle = variant === "bare" && !hasImage ? { color: accentColor } : {};
  const placeholderFinalIconClassName = variant === "bare" && !hasImage ? cn(iconClassName, "text-transparent") : iconClassName;

  return (
    <div
      className={cn(
        baseContainerClasses,
        variantClasses,
        className,
        canBeClicked && "cursor-pointer hover:scale-110 active:scale-100",
      )}
      style={variantStyles}
      onClick={canBeClicked ? handleIconClick : undefined}
      title={
        displaySpinner
          ? "Processing..."
          : hasImage
            ? (isEditable ? "Change Profile Icon" : (profileName || "Profile Icon"))
            : (isEditable ? "Select Profile Icon" : (profileName || "Profile Icon"))
      }
      role={canBeClicked ? "button" : undefined}
      tabIndex={canBeClicked ? 0 : undefined}
      onKeyDown={ (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (canBeClicked) {
                handleIconClick();
            }
          }
        }
      }
    >
      {hasImage ? (
        <>
          <img
            src={imageUrl!}
            alt={profileName ? `${profileName} icon` : "Profile Icon"}
            className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                canBeClicked && "group-hover:opacity-60"
            )}
            style={{ opacity: imageOpacity }}
          />
          {canBeClicked && (
             <div className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                variant === "default" ? roundedClassName : ""
              )}>
                <Icon icon="solar:gallery-edit-bold" className="w-5 h-5 text-white" />
            </div>
          )}
        </>
      ) : displaySpinner ? (
        <Icon 
            icon="eos-icons:loading" 
            className={cn(effectiveIconClassName, placeholderFinalIconClassName)} 
            style={placeholderIconStyle}
        />
      ) : shouldShowPlaceholder ? (
        <Icon 
            icon={placeholderIcon} 
            className={cn(effectiveIconClassName, placeholderFinalIconClassName)} 
            style={placeholderIconStyle}
        />
      ) : null}
    </div>
  );
} 