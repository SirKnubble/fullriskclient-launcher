import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { UnlistenFn, Event as TauriEvent } from '@tauri-apps/api/event';
import type { PhysicalPosition } from '@tauri-apps/api/window'; // For payload.position
import { toast } from 'react-hot-toast';
// import { invoke } from '@tauri-apps/api/core'; // No longer directly needed here

import { useAppDragDropStore } from '../store/appStore'; // Use the real store
import { useProfileStore } from '../store/profile-store'; // Import useProfileStore
import * as ContentService from '../services/content-service';
import * as ProfileService from '../services/profile-service'; // Import ProfileService
import { ContentType as BackendContentType } from '../types/content';

// Define the expected structure of the drag-drop event payload based on common Tauri patterns
interface WebviewDragDropPayload {
  type: 'hover' | 'drop' | 'cancel';
  paths?: string[];
  position?: PhysicalPosition;
}

// Simple cache for deduplicating rapid drop events
const recentlyProcessedPaths = new Set<string>();
const PROCESS_COOLDOWN_MS = 1500; // Cooldown period in milliseconds

export function useGlobalDragAndDrop() {
  // Destructure from store for useEffect dependencies, but use getState() inside event handler for freshest values.
  const { activeDropProfileId, activeDropContentType, triggerRefresh } = useAppDragDropStore();

  useEffect(() => {
    let unlistenDragDrop: UnlistenFn | undefined;
    const instanceId = Date.now(); // To distinguish listener instances if any HMR issues
    console.log(`[DragDrop Hook ${instanceId}] Initializing listener setup.`);

    const setupListener = async () => {
      try {
        const currentWebviewWindow = getCurrentWebviewWindow();
        
        unlistenDragDrop = await currentWebviewWindow.onDragDropEvent(async (event: TauriEvent<unknown>) => {
          const eventTimestamp = new Date().toISOString();
          console.log(`[DragDrop Hook ${instanceId}] Event received: ${event.payload ? (event.payload as any).type : 'unknown type'} at ${eventTimestamp}`);
          
          const payload = event.payload as WebviewDragDropPayload;

          if (payload.type === 'hover') {
            // console.log('User hovering over window at:', payload.position, 'with paths:', payload.paths);
          } else if (payload.type === 'drop') {
            const droppedPaths = payload.paths;
            console.log(`[DragDrop Hook ${instanceId}] Drop event with paths:`, droppedPaths);

            if (!droppedPaths || droppedPaths.length === 0) {
              return;
            }

            const pathKey = droppedPaths.slice().sort().join('|');

            if (recentlyProcessedPaths.has(pathKey)) {
              console.log(`[DragDrop Hook ${instanceId}] Duplicate drop event ignored (paths already processed recently): ${pathKey} at ${eventTimestamp}`);
              return; 
            }

            console.log(`[DragDrop Hook ${instanceId}] Processing new drop event for paths: ${pathKey} at ${eventTimestamp}`);
            recentlyProcessedPaths.add(pathKey);
            setTimeout(() => {
              recentlyProcessedPaths.delete(pathKey);
              console.log(`[DragDrop Hook ${instanceId}] Cleared pathKey from cache: ${pathKey}`);
            }, PROCESS_COOLDOWN_MS);

            const profilePackPath = droppedPaths.find(path => 
              path.toLowerCase().endsWith('.noriskpack') || path.toLowerCase().endsWith('.mrpack')
            );

            if (profilePackPath) {
              const operationId = `profile-import-${Date.now()}`;
              console.log(`[DragDrop Hook ${instanceId}] Initiating profile import (OpID: ${operationId}) for: ${profilePackPath} at ${eventTimestamp}`);
              const loadingToastId = `loading-${operationId}`;
              const fileName = profilePackPath.substring(profilePackPath.lastIndexOf('/') + 1).substring(profilePackPath.lastIndexOf('\\') + 1); // Get file name for toast
              toast.loading(`Importing profile from ${fileName}...`, { id: loadingToastId });

              try {
                await ProfileService.importProfileByPath(profilePackPath);
                console.log(`[DragDrop Hook ${instanceId}] Profile import SUCCESS (OpID: ${operationId}) for: ${profilePackPath} at ${new Date().toISOString()}`);
                toast.success(
                  `Profile import initiated for ${fileName}. Profile list will refresh.`,
                  { id: loadingToastId }
                );
                useProfileStore.getState().fetchProfiles(); // Fetch profiles after successful import
              } catch (err) {
                console.error(`[DragDrop Hook ${instanceId}] Profile import ERROR (OpID: ${operationId}) for: ${profilePackPath} at ${new Date().toISOString()}:`, err);
                toast.error(
                  `Failed to import profile from ${fileName}: ${err instanceof Error ? err.message : String(err)}`,
                  { id: loadingToastId }
                );
              }
              return; 
            }

            const {
              activeDropProfileId: currentProfileId,
              activeDropContentType: currentContentType,
            } = useAppDragDropStore.getState();

            if (currentProfileId && currentContentType) {
              let relevantFiles: string[] = [];
              let expectedExtensions: string[] = [];
              let itemTypeName = currentContentType.toString();

              switch (currentContentType) {
                case BackendContentType.Mod:
                  expectedExtensions = ['.jar', '.jar.disabled'];
                  itemTypeName = 'mods';
                  break;
                case BackendContentType.ResourcePack:
                  expectedExtensions = ['.zip', '.zip.disabled'];
                  itemTypeName = 'resource packs';
                  break;
                case BackendContentType.ShaderPack:
                  expectedExtensions = ['.zip', '.zip.disabled'];
                  itemTypeName = 'shader packs';
                  break;
                case BackendContentType.DataPack:
                  expectedExtensions = ['.zip', '.zip.disabled'];
                  itemTypeName = 'data packs';
                  break;
                default:
                  toast.error(`Drag and drop not configured for content type: ${currentContentType}`);
                  return;
              }

              relevantFiles = droppedPaths.filter(path => 
                expectedExtensions.some(ext => path.toLowerCase().endsWith(ext))
              );

              if (relevantFiles.length > 0) {
                const operationId = `op-${Date.now()}`;
                console.log(`[DragDrop Hook ${instanceId}] Initiating content import (OpID: ${operationId}) for ${relevantFiles.length} files at ${eventTimestamp}`);
                
                const loadingToastId = `loading-${operationId}`;
                toast.loading(`Importing ${relevantFiles.length} ${itemTypeName} via drag & drop...`, { id: loadingToastId });

                ContentService.installLocalContentToProfile({
                  profile_id: currentProfileId,
                  file_paths: relevantFiles,
                  content_type: currentContentType,
                })
                .then(() => {
                  console.log(`[DragDrop Hook ${instanceId}] Content import SUCCESS (OpID: ${operationId}) at ${new Date().toISOString()}`);
                  toast.success(
                    `${relevantFiles.length} ${itemTypeName} import initiated. List will refresh.`,
                    { id: loadingToastId } 
                  );
                  useAppDragDropStore.getState().triggerRefresh(currentContentType);
                })
                .catch((err) => {
                  console.error(`[DragDrop Hook ${instanceId}] Content import ERROR (OpID: ${operationId}) at ${new Date().toISOString()}:`, err);
                  toast.error(
                    `Failed to import ${itemTypeName}: ${err instanceof Error ? err.message : String(err)}`,
                    { id: loadingToastId } 
                  );
                });
              } else {
                toast(`No files matching expected types (${expectedExtensions.join(', ')}) for ${itemTypeName} were dropped.`);
              }
            } else {
              toast('Drop files onto an active profile content area to import them, or drop a .noriskpack/.mrpack file anywhere to import a profile.');
            }
          } else if (payload.type === 'cancel') {
            console.log(`[DragDrop Hook ${instanceId}] File drop cancelled at ${eventTimestamp}`);
          }
        });
      } catch (error) {
        console.error(`[DragDrop Hook ${instanceId}] Failed to set up drag and drop listener:`, error);
        toast.error("Could not initialize drag & drop listener.");
      }
    };

    setupListener();

    return () => {
      if (unlistenDragDrop) {
        console.log(`[DragDrop Hook ${instanceId}] Cleaning up listener.`);
        unlistenDragDrop();
      }
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount and cleans up on unmount
} 