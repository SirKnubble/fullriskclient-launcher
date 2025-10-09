"use client";

import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { SkinView3DWrapper } from "../common/SkinView3DWrapper";
import { Button } from "../ui/buttons/Button";
import { IconButton } from "../ui/buttons/IconButton";
import { Icon } from "@iconify/react";
import { useThemeStore } from "../../store/useThemeStore";
import { uploadCape } from "../../services/cape-service";
import { toast } from "react-hot-toast";

interface UploadCapeModalProps {
  previewImageUrl: string;
  previewImagePath: string;
  formatErrorMessage: (error: string) => string;
  isWarningMessage: (error: string) => boolean;
  onCancelUpload: () => void;
}

// Utility function to resize an image to 512x256 using Canvas (only if needed)
const resizeImageToCape = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Check if image is already the correct size
      if (img.naturalWidth === 512 && img.naturalHeight === 256) {
        // Image is already correct size, return original URL
        resolve(imageUrl);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set canvas size to 512x256
      canvas.width = 512;
      canvas.height = 256;

      // Use nearest neighbor scaling for pixel-perfect results
      ctx.imageSmoothingEnabled = false;

      // Draw the image scaled to fit 512x256
      ctx.drawImage(img, 0, 0, 512, 256);

      // Convert to data URL
      const resizedDataUrl = canvas.toDataURL('image/png');
      resolve(resizedDataUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
};

export function UploadCapeModal({
  previewImageUrl,
  previewImagePath,
  formatErrorMessage,
  isWarningMessage,
  onCancelUpload
}: UploadCapeModalProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showElytraPreview, setShowElytraPreview] = useState(false);
  const [resizedCapeUrl, setResizedCapeUrl] = useState<string | null>(null);

  // Resize the cape for preview when component mounts
  useEffect(() => {
    const resizeCapeForPreview = async () => {
      try {
        const resizedUrl = await resizeImageToCape(previewImageUrl);
        setResizedCapeUrl(resizedUrl);
      } catch (error) {
        console.error('Failed to resize cape for preview:', error);
        // Fallback to original URL if resize fails
        setResizedCapeUrl(previewImageUrl);
      }
    };

    resizeCapeForPreview();
  }, [previewImageUrl]);

  const handleConfirmUpload = async () => {
    setIsUploading(true);
    setUploadError(null);
    setUploadWarning(null);

    try {
      const result = await uploadCape(previewImagePath);

      // Show combined success message with resize info if applicable
      if (result.wasResized && result.originalDimensions) {
        const [origWidth, origHeight] = result.originalDimensions;
        toast.success(`Cape uploaded successfully! (Resized from ${origWidth}x${origHeight} to 512x256)`, {
          duration: 5000, // Show longer for important info
        });
      } else {
        toast.success("Cape uploaded successfully!");
      }

      onCancelUpload(); // Close modal on success
    } catch (err: any) {
      console.error("Error uploading cape:", err);
      const formattedError = formatErrorMessage(err.message || "Unknown error");

      if (isWarningMessage(formattedError)) {
        setUploadWarning(formattedError);
        setUploadError(null);
      } else {
        setUploadError(formattedError);
        setUploadWarning(null);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      title="Preview & Upload Cape"
      onClose={onCancelUpload}
      closeOnClickOutside={true}
      width="md"
      variant="flat"
    >
      <div className="p-4">
        <p className="text-white/80 mb-4 text-center font-minecraft-ten">
          {uploadError ? "Failed to upload Cape" : uploadWarning ? "Cape submitted for review" : "Does this look correct? If so, hit upload!"}
        </p>
        {uploadError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-md">
            <p className="text-red-400 text-sm font-minecraft-ten text-center">
              {uploadError}
            </p>
          </div>
        )}
        {uploadWarning && (
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded-md">
            <p className="text-yellow-400 text-sm font-minecraft-ten text-center">
              {uploadWarning}
            </p>
            <p className="text-yellow-300/70 text-xs font-minecraft-ten text-center mt-2">
              Reviews can take up to 24 hours
            </p>
          </div>
        )}
        <div className="relative flex justify-center items-center mb-6 p-2 rounded-md aspect-[10/16] max-w-[200px] mx-auto">
          <SkinView3DWrapper
            capeUrl={resizedCapeUrl || previewImageUrl}
            className="w-full h-full"
            zoom={1.5}
            displayAsElytra={showElytraPreview}
          />
          <IconButton
            onClick={() => setShowElytraPreview(!showElytraPreview)}
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 z-10"
            icon={
              <Icon
                icon={
                  showElytraPreview
                    ? "ph:airplane-tilt-fill"
                    : "ph:airplane-tilt-duotone"
                }
                className="w-5 h-5"
              />
            }
            title={showElytraPreview ? "Show as Cape" : "Show as Elytra"}
          />
        </div>
        <div className="flex justify-center gap-4">
          <Button
            onClick={handleConfirmUpload}
            variant="flat"
            disabled={isUploading || !!uploadError || !!uploadWarning}
            size="lg"
          >
            {isUploading ? "Uploading..." : "Upload Cape"}
          </Button>
          <Button
            onClick={onCancelUpload}
            variant="flat-secondary"
            disabled={isUploading}
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
