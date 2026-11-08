import type { ReactNode } from "react";

interface ProfileSelectionPopupProps {
  profiles?: any[];
  onSelect?: (profileId: string) => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
  contentVersion?: any;
}

export function ProfileSelectionPopup({
  profiles = [],
  onSelect,
  onCancel,
  title,
  description,
}: ProfileSelectionPopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-slate-900 p-4 shadow-2xl">
        {title && (
          <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
        )}
        {description && (
          <p className="mb-4 text-sm text-white/70">{description}</p>
        )}

        <div className="space-y-2">
          {profiles.length === 0 ? (
            <p className="text-sm text-white/50">No profiles available.</p>
          ) : (
            profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => onSelect?.(profile.id)}
                className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-white transition hover:bg-white/10"
              >
                <span>{profile.name || profile.id}</span>
                <span className="text-xs text-white/50">Select</span>
              </button>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
