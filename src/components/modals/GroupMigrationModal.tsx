"use client";

import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";

interface GroupMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: () => void;
  onMigrate?: () => void;
  profileId?: string;
}

export function GroupMigrationModal({
  isOpen,
  onClose,
  onLaunch,
  onMigrate,
  profileId
}: GroupMigrationModalProps) {
  if (!isOpen) return null;

  const handleLaunch = () => {
    onLaunch();
  };

  const handleMigrate = () => {
    if (onMigrate) {
      onMigrate();
    }
  };

  return (
    <Modal
      title="group update detected"
      onClose={onClose}
      width="md"
    >
      <div className="p-6">
        <p className="text-white/80 mb-6 text-center font-minecraft-ten">
          oh, it seems like something changed in your group. would you like to copy over your old files?
        </p>

        <div className="flex gap-4 justify-center mt-8">
          {onMigrate && (
            <Button
              onClick={handleMigrate}
              variant="default"
              size="md"
            >
              copy files
            </Button>
          )}
          <Button
            onClick={handleLaunch}
            variant="flat-secondary"
            size="md"
          >
            skip & launch
          </Button>
        </div>
      </div>
    </Modal>
  );
}
