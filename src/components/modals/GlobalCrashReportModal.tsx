import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useCrashModalStore } from '../../store/crash-modal-store';
import { Button } from '../ui/buttons/Button';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { getProfile, getProfileLatestLogContent } from '../../services/profile-service';
import { uploadLogToMclogs } from '../../services/log-service';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { submitCrashLog } from '../../services/process-service';
import type { CrashlogDto } from '../../types/processState';
import { openExternalUrl } from '../../services/tauri-service';
import { Window } from '@tauri-apps/api/window';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { EventPayload, CrashReportContentAvailablePayload } from '../../types/events';
import { EventType } from '../../types/events';

export function GlobalCrashReportModal() {
  const { isCrashModalOpen, crashData, closeCrashModal } = useCrashModalStore();
  const [profileName, setProfileName] = useState<string>('');
  const [mclogsUrl, setMclogsUrl] = useState<string | null>(null);
  const [noriskReportSubmitted, setNoriskReportSubmitted] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayedCrashReportContent, setDisplayedCrashReportContent] = useState<string | undefined>(undefined);
  const [isListeningForCrashContent, setIsListeningForCrashContent] = useState(false);

  useEffect(() => {
    if (crashData?.profile_id) {
      if (crashData.process_metadata?.profile_name) {
        setProfileName(crashData.process_metadata.profile_name);
      } else {
        setProfileName(crashData.profile_id);
        getProfile(crashData.profile_id)
          .then(details => {
            if (details?.name) {
              setProfileName(details.name);
            }
          })
          .catch(err => {
            console.error(`Failed to fetch profile details for ${crashData.profile_id}:`, err);
          });
      }
      setMclogsUrl(null);
      setNoriskReportSubmitted(false);
      setIsProcessing(false);
      setDisplayedCrashReportContent(crashData.crash_report_content);
      setIsListeningForCrashContent(false);
    } else {
      setProfileName('');
      setMclogsUrl(null);
      setNoriskReportSubmitted(false);
      setIsProcessing(false);
      setDisplayedCrashReportContent(undefined);
      setIsListeningForCrashContent(false);
    }
  }, [crashData]);

  useEffect(() => {
    const focusRelevantWindow = async () => {
      if (isCrashModalOpen && crashData?.process_id) {
        const crashedProcessId = crashData.process_id;
        console.log(`Crash modal open for process ${crashedProcessId}. Attempting to focus relevant window.`);

        const logWindowLabel = `log_window_${crashedProcessId}`;
        try {
          const targetWindowInstance = await Window.getByLabel(logWindowLabel);
          if (targetWindowInstance) {
            console.log(`Focusing log window: ${logWindowLabel}`);
            await targetWindowInstance.show();
            await targetWindowInstance.unminimize();
            await targetWindowInstance.setFocus();
          }
        } catch (e) {
          console.warn(`Log window with label ${logWindowLabel} not found for process ${crashedProcessId}:`, e);
        }

        try {
          const mainWindowInstance = await Window.getByLabel('main');
          if (mainWindowInstance) {
            console.log("Focusing main application window as fallback.");
            await mainWindowInstance.show();
            await mainWindowInstance.unminimize();
            await mainWindowInstance.setFocus();
          }
        } catch (e) {
          console.error("Error getting or focusing main window:", e);
        }
      }
    };

    focusRelevantWindow();
  }, [isCrashModalOpen, crashData]);

  useEffect(() => {
    let unlistenFn: UnlistenFn | undefined;

    const listenForCrashContent = async () => {
      if (isCrashModalOpen && crashData?.process_id && !displayedCrashReportContent && !isListeningForCrashContent) {
        setIsListeningForCrashContent(true);
        console.log(`Listening for CrashReportContentAvailable for process ${crashData.process_id}`);
        try {
          unlistenFn = await listen<EventPayload>(EventType.CrashReportContentAvailable, (event) => {
            if (event.payload.target_id === crashData.process_id) {
              try {
                const contentPayload = JSON.parse(event.payload.message) as CrashReportContentAvailablePayload;
                if (contentPayload.content) {
                  console.log(`Received CrashReportContentAvailable for process ${crashData.process_id}`);
                  setDisplayedCrashReportContent(contentPayload.content);
                  toast.success("Detailed crash report loaded!");
                  setIsListeningForCrashContent(false);
                  if (unlistenFn) unlistenFn();
                }
              } catch (e) {
                console.error("Failed to parse CrashReportContentAvailablePayload:", e);
              }
            }
          });
        } catch (error) {
          console.error("Failed to set up listener for CrashReportContentAvailable:", error);
          setIsListeningForCrashContent(false);
        }
      }
    };

    listenForCrashContent();

    return () => {
      if (unlistenFn) {
        console.log("Cleaning up CrashReportContentAvailable listener.");
        unlistenFn();
      }
      setIsListeningForCrashContent(false);
    };
  }, [isCrashModalOpen, crashData?.process_id, displayedCrashReportContent, isListeningForCrashContent]);

  if (!isCrashModalOpen || !crashData) {
    return null;
  }

  const handlePrimaryAction = async () => {
    if (!crashData?.profile_id || !crashData?.process_metadata) {
      toast.error("Cannot proceed: Missing critical crash data.");
      console.error("Action error: Missing profile_id or process_metadata", crashData);
      return;
    }

    setIsProcessing(true);
    let currentMclogsUrl = mclogsUrl;
    const mainToastId = toast.loading('Processing crash report...');

    try {
      if (!currentMclogsUrl) {
        toast.loading('Fetching latest log content...', { id: mainToastId });
        const logContent = await getProfileLatestLogContent(crashData.profile_id);
        
        let combinedLogContent = logContent;
        if (displayedCrashReportContent && displayedCrashReportContent.trim() !== "") {
          combinedLogContent = `--- CRASH REPORT ---\n${displayedCrashReportContent}\n\n--- LATEST LOG ---\n${logContent}`;
          toast.loading('Preparing combined log (crash report + latest.log)...', { id: mainToastId });
        }

        if (!combinedLogContent || combinedLogContent.trim() === "") {
          throw new Error("No log content found to upload.");
        }
        
        toast.loading('Uploading to mclogs.com...', { id: mainToastId });
        currentMclogsUrl = await uploadLogToMclogs(combinedLogContent);
        setMclogsUrl(currentMclogsUrl);
      }

      if (currentMclogsUrl && !noriskReportSubmitted) {
        toast.loading('Submitting crash report to NoRisk...', { id: mainToastId });
        const crashReportPayload: CrashlogDto = {
          mcLogsUrl: currentMclogsUrl,
          metadata: crashData.process_metadata!, 
        };
        
        await submitCrashLog(crashReportPayload);
        setNoriskReportSubmitted(true);
        
        try {
          await writeText(currentMclogsUrl);
          toast.success("Report submitted & Log URL copied!", { id: mainToastId });
        } catch (copyError) {
          console.error("Failed to copy mclogs URL after report:", copyError);
          toast.success(`Report submitted. Log URL: ${currentMclogsUrl} (Copying failed)`, { id: mainToastId });
        }
      } else if (currentMclogsUrl && noriskReportSubmitted) {
        toast.dismiss(mainToastId);
        await writeText(currentMclogsUrl);
        toast.success("mclogs.com URL copied to clipboard!");
      } else {
        toast.dismiss(mainToastId);
      }
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred.', { id: mainToastId });
      console.error("Crash report processing error:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleContactSupport = async () => {
    try {
      await openExternalUrl('https://discord.norisk.gg');
      toast.success("Opened NoRisk Discord in your browser!");
    } catch (error) {
      console.error("Failed to open Discord URL:", error);
      toast.error("Could not open Discord. Please go to discord.norisk.gg manually.");
    }
  };

  let primaryButtonText = 'Upload Logs & Report';
  if (mclogsUrl && noriskReportSubmitted) {
    primaryButtonText = 'Copy Log URL';
  }

  const modalFooter = (
    <div className="flex flex-wrap justify-end gap-3">
      <Button 
        onClick={handlePrimaryAction} 
        variant="secondary" 
        icon={<Icon icon={mclogsUrl && noriskReportSubmitted ? "solar:copy-line-duotone" : "solar:upload-linear"} className="w-5 h-5" />}
        disabled={isProcessing || !crashData?.process_metadata}
      >
        {primaryButtonText}
      </Button>
      <Button 
        onClick={handleContactSupport} 
        variant="default" 
        icon={<Icon icon="solar:letter-linear" className="w-5 h-5" />}
        disabled={isProcessing}
      >
        Contact Support
      </Button>
    </div>
  );

  const titleSubtitleNode = (
    <p className="text-xs font-minecraft-ten text-gray-400">
      Profile: {crashData.process_metadata?.profile_name || profileName || 'Loading...'}
    </p>
  );

  return (
    <Modal
      title="Minecraft Crash Report"
      titleIcon={<Icon icon="solar:danger-bold" className="w-7 h-7 text-red-400" />}
      titleSubtitle={titleSubtitleNode}
      onClose={() => !isProcessing && closeCrashModal()}
      width="md"
      footer={modalFooter}
    >
      <div className="p-6 space-y-4 text-white text-base text-center">
        <p className="pt-3 text-gray-300 text-lg font-minecraft-ten">
          An unexpected error occurred and the game crashed. We are sorry for the inconvenience.
        </p>

        <p className="pt-4 text-2xl font-minecraft text-red-400">
          exit code: {crashData.exit_code ?? 'N/A'}
        </p>
      </div>
    </Modal>
  );
} 