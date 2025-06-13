import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/buttons/Button';
import { Icon } from '@iconify/react';
import { useThemeStore } from '../../store/useThemeStore';
import { openExternalUrl } from '../../services/tauri-service';
import { toast } from 'react-hot-toast';

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