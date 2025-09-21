import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useVanillaCapeStore } from '../../store/useVanillaCapeStore';
import { useMinecraftAuthStore } from '../../store/minecraft-auth-store';
import { useThemeStore } from '../../store/useThemeStore';
import type { VanillaCape } from '../../types/vanillaCapes';
import { IconButton } from '../ui/buttons/IconButton';
import { Button } from '../ui/buttons/Button';
import { Modal } from '../ui/Modal';
import { SkinView3DWrapper } from '../common/SkinView3DWrapper';
import { useGlobalModal } from '../../hooks/useGlobalModal';
import { VanillaCapeImage } from './VanillaCapeImage';

interface VanillaCapeListProps {
  isEquippingCapeId?: string | null;
}

export function VanillaCapeList({ isEquippingCapeId }: VanillaCapeListProps): JSX.Element {
  const {
    ownedCapes,
    equippedCape,
    isLoading,
    error,
    fetchOwnedCapes,
    equipCape,
  } = useVanillaCapeStore();
  
  const { activeAccount } = useMinecraftAuthStore();
  const { showModal, hideModal } = useGlobalModal();
  const accentColor = useThemeStore((state) => state.accentColor);

  useEffect(() => {
    if (activeAccount && ownedCapes.length === 0 && !isLoading && !error) {
      fetchOwnedCapes();
    }
  }, [activeAccount, ownedCapes.length, isLoading, error, fetchOwnedCapes]);

  const handleEquipCape = async (capeId: string) => {
    await equipCape(capeId);
  };

  const handleCapePreview = (cape: VanillaCape) => {
    const userSkinUrl = activeAccount?.id
      ? `https://crafatar.com/skins/${activeAccount.id}`
      : undefined;

    showModal(`vanilla-cape-preview-${cape.id}`, (
      <Modal
        title=""
        onClose={() => hideModal(`vanilla-cape-preview-${cape.id}`)}
        width="md"
        variant="flat"
      >
        <VanillaCape3DPreviewWithToggle
          skinUrl={userSkinUrl}
          capeUrl={cape.url}
          capeId={cape.id}
          isEquipped={cape.id === equippedCape?.id}
          onEquipCape={() => {
            if (cape.id === equippedCape?.id) {
              equipCape(null); 
            } else {
              handleEquipCape(cape.id); 
            }
            hideModal(`vanilla-cape-preview-${cape.id}`);
          }}
        />
      </Modal>
    ));
  };

  if (!activeAccount) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Icon icon="solar:user-cross-bold-duotone" className="w-16 h-16 text-white/30 mb-4" />
        <h3 className="font-minecraft text-xl text-white/70 mb-2">No Account Selected</h3>
        <p className="text-white/50 text-lg">Please sign in to view your vanilla capes</p>
      </div>
    );
  }

  if (isLoading && ownedCapes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: accentColor.value }}>
        </div>
        <p className="text-white/70 mt-4 font-minecraft text-lg">Loading vanilla capes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Icon icon="solar:danger-bold-duotone" className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="font-minecraft text-xl text-white/70 mb-2">Error Loading Capes</h3>
        <p className="text-white/50 text-lg mb-4">{error}</p>
        <button
          onClick={() => fetchOwnedCapes()}
          className="px-4 py-2 bg-black/30 hover:bg-black/40 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-lg font-minecraft text-xl lowercase transition-all duration-200 flex items-center gap-2"
        >
          <Icon icon="solar:refresh-bold" className="w-4 h-4" />
          retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-minecraft text-2xl text-white/90">
          Your Vanilla Capes ({ownedCapes.length})
        </h3>
      </div>

      {ownedCapes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Icon icon="solar:shield-cross-bold-duotone" className="w-16 h-16 text-white/30 mb-4" />
          <h3 className="font-minecraft text-xl text-white/70 mb-2">No Vanilla Capes</h3>
          <p className="text-white/50 text-lg">You don't own any vanilla Minecraft capes yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {ownedCapes.map((cape) => (
            <VanillaCapeItemDisplay
              key={cape.id}
              cape={cape}
              isCurrentlyEquipping={isEquippingCapeId === cape.id}
              isEquipped={cape.id === equippedCape?.id}
              onEquipCape={handleEquipCape}
              onPreview={handleCapePreview}
              accentColor={accentColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface VanillaCapeItemDisplayProps {
  cape: VanillaCape;
  isCurrentlyEquipping: boolean;
  isEquipped: boolean;
  onEquipCape: (capeId: string) => void;
  onPreview: (cape: VanillaCape) => void;
  accentColor: any;
}

function VanillaCapeItemDisplay({
  cape,
  isCurrentlyEquipping,
  isEquipped,
  onEquipCape,
  onPreview,
  accentColor,
}: VanillaCapeItemDisplayProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleLeftClick = () => {
    if (isCurrentlyEquipping) return;
    onEquipCape(cape.id);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isCurrentlyEquipping) return;
    onPreview(cape);
  };

  const displayWidth = 140;
  const displayHeight = Math.round(displayWidth * (16 / 10)); 

  return (
    <div
      className="relative flex flex-col gap-3 p-4 rounded-lg bg-black/20 border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleLeftClick}
      onContextMenu={handleRightClick}
    >
      <div className="flex flex-col items-center gap-3 relative z-10 w-full">
        <div
          className="relative flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden border-2 transition-all duration-300 ease-out"
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            backgroundColor: isHovered ? `${accentColor.value}20` : 'transparent',
            borderColor: isEquipped ? accentColor.value : (isHovered ? `${accentColor.value}60` : 'transparent'),
          }}
        >
          {!imageError ? (
            <VanillaCapeImage
              imageUrl={cape.url}
              width={displayWidth}
              className="rounded-sm block"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black/30 rounded-sm">
              <Icon icon="solar:image-broken-bold-duotone" className="w-8 h-8 text-white/30" />
            </div>
          )}

          {isEquipped && (
            <div
              className="absolute top-2 right-2 px-2 py-1 text-xs font-minecraft text-white rounded-md shadow-lg"
              style={{ backgroundColor: accentColor.value }}
            >
              equipped
            </div>
          )}

          {isCurrentlyEquipping && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
              <Icon
                icon="solar:refresh-bold"
                className="w-8 h-8 animate-spin mb-1"
                style={{ color: accentColor.value }}
              />
              <span className="font-minecraft text-xs text-white lowercase">
                Equipping
              </span>
            </div>
          )}
        </div>

        <div className="flex-grow min-w-0 w-full text-center">
          <h3
            className="font-minecraft-ten text-white text-base whitespace-nowrap overflow-hidden text-ellipsis max-w-full normal-case mb-1"
            title={cape.name}
          >
            {cape.name}
          </h3>
        </div>
      </div>
    </div>
  );
}

function VanillaCape3DPreviewWithToggle({
  skinUrl,
  capeUrl,
  capeId,
  isEquipped,
  onEquipCape
}: {
  skinUrl?: string;
  capeUrl: string;
  capeId: string;
  isEquipped: boolean;
  onEquipCape: () => void;
}) {
  const [showElytra, setShowElytra] = useState(false);

  return (
    <div className="p-4">
      <div style={{ width: 300, height: 380, margin: "0 auto", position: "relative" }}>
        <IconButton
          onClick={() => setShowElytra((v) => !v)}
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10"
          icon={
            <Icon
              icon={showElytra ? "ph:airplane-tilt-fill" : "ph:airplane-tilt-duotone"}
              className="w-5 h-5"
            />
          }
          title={showElytra ? "Show as Cape" : "Show as Elytra"}
          aria-label={showElytra ? "Show as Cape" : "Show as Elytra"}
        />
        <SkinView3DWrapper
          skinUrl={skinUrl}
          capeUrl={capeUrl}
          enableAutoRotate={true}
          autoRotateSpeed={0.5}
          startFromBack={true}
          zoom={0.9}
          displayAsElytra={showElytra}
          width={300}
          height={380}
        />
      </div>

      <div className="flex justify-center mt-4">
        <Button
          onClick={onEquipCape}
          variant="flat"
          size="lg"
          className="px-8"
        >
          {isEquipped ? 'UNEQUIP CAPE' : 'SELECT CAPE'}
        </Button>
      </div>
    </div>
  );
}