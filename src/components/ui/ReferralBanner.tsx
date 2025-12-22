import { useEffect } from "react";
import { X, UserPlus } from "lucide-react";
import { useReferralStore } from "../../store/referral-store";
import { useThemeStore } from "../../store/useThemeStore";
import { getLauncherConfig } from "../../services/launcher-config-service";

export function ReferralBanner() {
  const {
    bannerVisible,
    referrerInfo,
    isLoading,
    setPendingCode,
    dismissBanner
  } = useReferralStore();

  const accentColor = useThemeStore((state) => state.accentColor);

  // Check for pending referral code on mount
  useEffect(() => {
    const checkReferralCode = async () => {
      try {
        const config = await getLauncherConfig();
        if (config.pending_referral_code) {
          setPendingCode(config.pending_referral_code);
        }
      } catch (error) {
        console.error("[ReferralBanner] Failed to check referral code:", error);
      }
    };

    checkReferralCode();
  }, [setPendingCode]);

  // DEBUG: Always show banner for testing
  const DEBUG_MODE = true;
  const debugReferrerInfo = {
    referrer_name: "nqrman",
    referrer_avatar: null,
    valid: true,
    referral_type: "friend", // "friend", "affiliate", "creator", "partner"
    translation_key: "referral.invited_by_friend",
    fallback_message: "You were invited by",
    custom_message: null,
    reward_text: null, // e.g., "Du erhältst 100 Coins!"
  };

  // Don't render if not visible or loading (bypassed in debug mode)
  if (!DEBUG_MODE && (!bannerVisible || isLoading || !referrerInfo)) {
    return null;
  }

  const displayInfo = DEBUG_MODE ? debugReferrerInfo : referrerInfo;

  return (
    <div
      className="animate-slide-up-fade-in rounded-full"
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Icon */}
        <UserPlus className="w-4 h-4 text-white/70 flex-shrink-0" />

        {/* Content */}
        <span className="font-minecraft-ten text-sm text-white/80 tracking-wide">
          {displayInfo?.fallback_message || "You were invited by"}{" "}
          <span style={{ color: accentColor.value }} className="font-semibold">
            {displayInfo?.referrer_name}
          </span>
        </span>

        {/* Close button */}
        <button
          type="button"
          onClick={dismissBanner}
          className="flex-shrink-0 ml-1 p-1 rounded-full transition-colors hover:bg-white/10"
          aria-label="Close banner"
        >
          <X className="w-3.5 h-3.5 text-white/50 hover:text-white" />
        </button>
      </div>
    </div>
  );
}
