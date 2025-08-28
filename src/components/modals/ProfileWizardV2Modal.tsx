"use client";

import { useProfileWizardStore } from "../../store/profile-wizard-store";
import { ProfileWizardV2 } from "../profiles/wizard-v2/ProfileWizardV2";
import { useProfileStore } from "../../store/profile-store";

export function ProfileWizardV2Modal() {
  const { isModalOpen, defaultGroup, closeModal } = useProfileWizardStore();
  const { fetchProfiles } = useProfileStore();

  if (!isModalOpen) {
    return null;
  }

  const handleSave = async (profile: any) => {
    // Refresh profiles after creation
    await fetchProfiles();
    closeModal();
  };

  return (
    <ProfileWizardV2
      onClose={closeModal}
      onSave={handleSave}
      defaultGroup={defaultGroup}
    />
  );
}
