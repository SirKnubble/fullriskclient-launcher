import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/buttons/Button';
import { Icon } from '@iconify/react';
import { useThemeStore } from '../../store/useThemeStore';
import { openExternalUrl } from '../../services/tauri-service';
import { toast } from 'react-hot-toast';

// Analytics Consent Banner Component
interface AnalyticsConsentBannerProps {
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

export function AnalyticsConsentBanner({ onAccept, onDecline, onDismiss }: AnalyticsConsentBannerProps) {
  const { accentColor } = useThemeStore();
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      <div
        className="bg-black/20 backdrop-blur-md border border-white/10 hover:border-white/20 shadow-2xl rounded-lg p-4 relative transition-all duration-200 cursor-default"
        style={{
          backgroundColor: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: `2px solid ${accentColor.value}80`,
          boxShadow: `
            0 4px 0 rgba(0,0,0,0.3),
            0 6px 12px rgba(0,0,0,0.35),
            inset 0 1px 0 ${accentColor.value}1A
          `
        }}
      >
        {/* Dismiss Button oben rechts */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-white transition-colors"
          title="Remind me later"
        >
          <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <Icon icon="solar:chart-square-bold" className="w-6 h-6 text-accent flex-shrink-0 mt-1" />

          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-minecraft text-white mb-2">
              Help Improve NoRisk Client
            </h3>

            <p className="text-sm text-gray-300 font-minecraft-ten leading-relaxed mb-4">
              Send anonymous usage data to help us improve the launcher. Includes game versions, UI interactions, and operating system type.{' '}
              <button
                onClick={() => openExternalUrl('https://blog.norisk.gg/en/privacy-policy/')}
                className="text-accent hover:text-accent-hover underline underline-offset-2 transition-colors text-sm"
              >
                Learn more →
              </button>
            </p>

            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={onDecline}
                variant="ghost"
                size="sm"
                className="px-3 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 font-minecraft text-lg lowercase"
              >
                no thanks
              </Button>
              <Button
                onClick={onAccept}
                variant="default"
                size="sm"
                className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-black font-minecraft text-lg lowercase"
              >
                enable analytics
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TermsOfServiceModalProps {
  isOpen: boolean;
}

export function TermsOfServiceModal({ isOpen }: TermsOfServiceModalProps) {
  const { acceptTermsOfService } = useThemeStore();

  const handleAccept = () => {
    acceptTermsOfService();
    toast.success("Terms of Service accepted!");
  };

  const handleOpenPrivacyPolicy = async () => {
    try {
      await openExternalUrl('https://blog.norisk.gg/en/privacy-policy/');
      toast.success("Privacy Policy opened in your browser!");
    } catch (error) {
      console.error("Failed to open Privacy Policy URL:", error);
      toast.error("Could not open Privacy Policy. Please visit blog.norisk.gg/privacy-policy/ manually.");
    }
  };

  const handleOpenTerms = async () => {
    try {
      await openExternalUrl('https://blog.norisk.gg/en/terms-of-use/');
      toast.success("Terms of Service opened in your browser!");
    } catch (error) {
      console.error("Failed to open Terms URL:", error);
      toast.error("Could not open Terms. Please visit blog.norisk.gg/en/terms-of-use/ manually.");
    }
  };

  if (!isOpen) {
    return null;
  }

  const modalFooter = (
    <div className="flex flex-wrap justify-end gap-3">
      <Button 
        onClick={handleAccept} 
        variant="default" 
        icon={<Icon icon="solar:check-circle-bold" className="w-5 h-5" />}
      >
        Accept & Continue
      </Button>
    </div>
  );

  return (
    <Modal
      title="Terms of Service"
      titleIcon={<Icon icon="solar:document-bold" className="w-7 h-7 text-blue-400" />}
      onClose={() => {}} // Prevent closing without accepting
      width="lg"
      footer={modalFooter}
      closeOnClickOutside={false}
    >
      <div className="p-6 space-y-6 text-white">
        <div className="text-center space-y-4">
          <h3 className="text-3xl font-minecraft text-blue-400 lowercase">
            Welcome to NoRisk Launcher!
          </h3>
          <p className="text-lg font-minecraft-ten text-gray-300">
            Before you start using our launcher, please read and accept our Terms of Service.
          </p>
        </div>

        <div className="space-y-4 text-base font-minecraft-ten text-gray-200 max-h-60 overflow-y-auto custom-scrollbar p-4 bg-black/30 rounded border border-gray-600">
          <div className="space-y-3">
            <h4 className="text-lg font-minecraft text-white">Key Points:</h4>
            <ul className="space-y-2 list-disc list-inside text-sm">
              <li>You must own a legitimate copy of Minecraft to use this launcher</li>
              <li>This launcher is provided "as is" without warranties</li>
              <li>We collect minimal usage data to improve the experience</li>
              <li>You are responsible for your use of mods and content</li>
              <li>We reserve the right to update these terms at any time</li>
              <li>By using this launcher, you agree to comply with Minecraft's EULA</li>
            </ul>
            
            <div className="pt-3 border-t border-gray-600">
              <p className="text-sm text-gray-400">
                For the complete terms and conditions, please click "View Full Terms" below.
                By continuing, you acknowledge that you have read, understood, and agree to be bound by our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button 
            onClick={handleOpenPrivacyPolicy} 
            variant="flat" 
            icon={<Icon icon="solar:document-text-linear" className="w-4 h-4" />}
            size="sm"
          >
            Privacy Policy
          </Button>
          <Button 
            onClick={handleOpenTerms} 
            variant="flat" 
            icon={<Icon icon="solar:document-text-linear" className="w-4 h-4" />}
            size="sm"
          >
            View Full Terms
          </Button>
        </div>

        <div className="text-center text-sm text-gray-400">
          <p>
            You can withdraw your consent at any time. However, you must accept the terms to use NoRisk Client.
          </p>
        </div>
      </div>
    </Modal>
  );
} 