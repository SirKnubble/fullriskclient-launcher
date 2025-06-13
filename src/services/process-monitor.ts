import { useLaunchStateStore } from "../store/launch-state-store";
import * as ProcessService from "./process-service";

class ProcessMonitor {
  private monitoringInterval: number | null = null;
  private currentProfileId: string | null = null;

  startMonitoring(profileId: string) {
    this.currentProfileId = profileId;
    const store = useLaunchStateStore.getState();
    console.debug(`Starting process monitoring for profile ${profileId}`);

    this.stopMonitoring();

    this.monitoringInterval = window.setInterval(async () => {
      try {
        const isRunning = await this.checkIfProcessIsRunning(profileId);
        if (!isRunning) {
          console.debug(
            `Process for profile ${profileId} is no longer running`,
          );
          // @ts-ignore
          store.setProfileLaunchState(profileId, "idle");
          this.stopMonitoring();
        }
      } catch (error) {
        console.debug(`Error monitoring process: ${error}`);
      }
    }, 5000) as unknown as number;
  }

  stopMonitoring() {
    if (this.monitoringInterval !== null) {
      window.clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.currentProfileId = null;
    }
  }

  private async checkIfProcessIsRunning(profileId: string): Promise<boolean> {
    try {
      return await ProcessService.isMinecraftRunning(profileId);
    } catch (error) {
      console.error("Error checking if process is running:", error);
      return false;
    }
  }

  isMonitoring(profileId: string): boolean {
    return (
      this.currentProfileId === profileId && this.monitoringInterval !== null
    );
  }
}

export const processMonitor = new ProcessMonitor();
