"use client";
import { Modal } from "../ui/Modal";
import { useVersionSelectionStore } from "../../store/version-selection-store";
import { ProfileSelectionModalContent } from "./ProfileSelectionModalContent";

interface ProfileSelectionModalProps {
  onVersionChange: (versionId: string) => void;
  title?: string;
  isOpen?: boolean; // Optional: wenn gesetzt, wird Global Modal verwendet
  onClose?: () => void; // Optional: wird verwendet wenn isOpen gesetzt ist
}

export function ProfileSelectionModal({
  onVersionChange,
  title = "select profile",
  isOpen,
  onClose,
}: ProfileSelectionModalProps) {
  const { isModalOpen, closeModal } = useVersionSelectionStore();

  // Wenn isOpen übergeben wurde, verwende Global Modal System
  if (isOpen !== undefined) {
    if (!isOpen) return null;

    return (
      <Modal
        title={title}
        onClose={onClose}
        width="lg"
      >
        <ProfileSelectionModalContent
          onVersionChange={onVersionChange}
          onClose={onClose}
          title={title}
        />
      </Modal>
    );
  }

  // Legacy Modus: verwende den alten Store-Mechanismus
  if (!isModalOpen) return null;

  return (
    <Modal
      title={title}
      onClose={closeModal}
      width="lg"
    >
      <ProfileSelectionModalContent
        onVersionChange={onVersionChange}
        onClose={closeModal}
        title={title}
      />
    </Modal>
  );
}
