"use client";

import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";

interface GroupMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onLaunch: () => void;
  profileId?: string;
}

export function GroupMigrationModal({
  isOpen,
  onClose,
  onCopy,
  onLaunch,
  profileId
}: GroupMigrationModalProps) {
  if (!isOpen) return null;

  const handleCopy = () => {
    if (profileId) {
      navigator.clipboard.writeText(profileId);
    }
    onCopy();
  };

  const handleLaunch = () => {
    onLaunch();
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
          <Button
            onClick={handleCopy}
            variant="flat-secondary"
            size="md"
          >
            copy files
          </Button>
          <Button
            onClick={handleLaunch}
            variant="default"
            size="md"
          >
            skip & launch
          </Button>
        </div>
      </div>
    </Modal>
  );
}
