"use client";

import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";
import { Icon } from "@iconify/react";

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  title?: string;
  message?: React.ReactNode;
}

export function ConfirmDeleteDialog({
  isOpen,
  itemName,
  onClose,
  onConfirm,
  isDeleting,
  title,
  message,
}: ConfirmDeleteDialogProps) {
  if (!isOpen) {
    return null;
  }

  const dialogTitle = title || `Delete '${itemName}'?`;
  const dialogMessage = message || (
    <p className="text-white/80 font-minecraft-ten">
      Are you sure you want to permanently delete <strong className="text-white">{itemName}</strong>?
      <br />
      This action cannot be undone.
    </p>
  );

  const dialogFooter = (
    <div className="flex justify-end items-center gap-3">
      <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
        Cancel
      </Button>
      <Button
        variant="destructive"
        onClick={onConfirm}
        disabled={isDeleting}
        icon={isDeleting ? <Icon icon="solar:refresh-bold" className="animate-spin h-4 w-4" /> : null}
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
    </div>
  );

  return (
    <Modal
      title={dialogTitle}
      titleIcon={<Icon icon="solar:trash-bin-trash-bold-duotone" className="w-6 h-6 text-red-400" />}
      onClose={onClose}
      width="sm"
      footer={dialogFooter}
    >
      <div className="p-6">
        {dialogMessage}
      </div>
    </Modal>
  );
} 