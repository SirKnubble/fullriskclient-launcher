export interface RefreshConfig {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface RefreshState {
  isRefreshing: boolean;
  lastRefresh: number;
  refreshCount: number;
}

export const createRefreshState = (): RefreshState => ({
  isRefreshing: false,
  lastRefresh: 0,
  refreshCount: 0,
});

export const createRefreshActions = <TState extends RefreshState>(
  set: (partial: Partial<TState>) => void,
  get: () => TState,
  refreshFunction: () => Promise<void>,
  config: RefreshConfig = {}
) => {
  const { timeout = 10000, retryCount = 3, retryDelay = 1000 } = config;

  const executeRefresh = async (): Promise<void> => {
    const timeoutId = setTimeout(() => {
      set({ isRefreshing: false } as Partial<TState>);
    }, timeout);

    try {
      set({ isRefreshing: true } as Partial<TState>);
      await refreshFunction();
      
      const state = get();
      set({
        isRefreshing: false,
        lastRefresh: Date.now(),
        refreshCount: state.refreshCount + 1,
      } as Partial<TState>);
    } catch (error) {
      set({ isRefreshing: false } as Partial<TState>);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const executeRefreshWithRetry = async (attempts = 0): Promise<void> => {
    try {
      await executeRefresh();
    } catch (error) {
      if (attempts < retryCount) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return executeRefreshWithRetry(attempts + 1);
      }
      throw error;
    }
  };

  return {
    refresh: executeRefresh,
    refreshWithRetry: executeRefreshWithRetry,
    resetRefreshState: () => set({
      isRefreshing: false,
      lastRefresh: 0,
      refreshCount: 0,
    } as Partial<TState>),
  };
};

export const createAutoRefreshConfig = (
  refreshFunction: () => Promise<void>,
  interval: number = 30000
) => {
  let intervalId: NodeJS.Timeout | null = null;

  const start = () => {
    if (intervalId) return;
    intervalId = setInterval(() => {
      refreshFunction().catch(() => {
      });
    }, interval);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const restart = () => {
    stop();
    start();
  };

  return { start, stop, restart };
};
