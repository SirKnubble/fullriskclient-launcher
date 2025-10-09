"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";
import type { CosmeticCape } from "../../types/noriskCapes";

interface ConfirmDeletionModalProps {
  capeToDelete: CosmeticCape;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export function ConfirmDeletionModal({
  capeToDelete,
  onConfirmDelete,
  onCancelDelete
}: ConfirmDeletionModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      title="Confirm Deletion"
      onClose={onCancelDelete}
      width="sm"
      variant="flat"
    >
      <div className="p-4">
        <p className="text-white/90 mb-6 text-center font-minecraft-ten">
          Are you sure you want to delete the cape{" "}
          <span style={{ color: "var(--accent)" }}>{capeToDelete._id}</span>
          ? This action cannot be undone.
        </p>
        <div className="flex justify-center gap-4">
          <Button
            onClick={handleConfirmDelete}
            variant="destructive"
            disabled={isDeleting}
            size="md"
          >
            {isDeleting ? "Deleting..." : "Delete Cape"}
          </Button>
          <Button
            onClick={onCancelDelete}
            variant="flat-secondary"
            disabled={isDeleting}
            size="md"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
