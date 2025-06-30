import { useState, useEffect, useCallback } from 'react';

interface AvatarState {
  loading: boolean;
  loaded: boolean;
  error: boolean;
  url?: string;
}

class AvatarLoadManager {
  private cache = new Map<string, AvatarState>();
  private activeRequests = new Set<string>();

  private getAvatarUrl(userId: string): string {
    return `https://crafatar.com/avatars/${userId}?size=48&overlay&default=MHF_Steve`;
  }

  private async loadAvatar(userId: string, attempt = 1): Promise<AvatarState> {
    const url = this.getAvatarUrl(userId);
    
    return new Promise((resolve) => {
      const img = new Image();
      
      const onLoad = () => {
        cleanup();
        resolve({
          loading: false,
          loaded: true,
          error: false,
          url,
        });
      };
      
      const onError = () => {
        cleanup();
        if (attempt < 2) {
          setTimeout(() => {
            this.loadAvatar(userId, attempt + 1).then(resolve);
          }, 500);
        } else {
          resolve({
            loading: false,
            loaded: false,
            error: true,
            url: undefined,
          });
        }
      };
      
      const cleanup = () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      
      img.crossOrigin = 'anonymous';
      img.src = url;
      
      setTimeout(() => {
        if (!img.complete || (img.complete && img.naturalWidth === 0)) {
          cleanup();
          onError();
        }
      }, 3000);
    });
  }

  public async loadUserAvatar(userId: string, callback: (state: AvatarState) => void): Promise<() => void> {
    if (!userId) {
      callback({
        loading: false,
        loaded: false,
        error: true,
      });
      return () => {};
    }

    const cached = this.cache.get(userId);
    if (cached && (cached.loaded || cached.error)) {
      callback(cached);
      return () => {};
    }

    if (this.activeRequests.has(userId)) {
      const checkComplete = () => {
        const current = this.cache.get(userId);
        if (current && (current.loaded || current.error)) {
          callback(current);
        } else {
          setTimeout(checkComplete, 100);
        }
      };
      setTimeout(checkComplete, 100);
      return () => {};
    }

    const loadingState: AvatarState = {
      loading: true,
      loaded: false,
      error: false,
    };
    
    this.cache.set(userId, loadingState);
    callback(loadingState);
    this.activeRequests.add(userId);

    this.loadAvatar(userId).then((result) => {
      this.cache.set(userId, result);
      callback(result);
      this.activeRequests.delete(userId);
    }).catch(() => {
      const errorState: AvatarState = {
        loading: false,
        loaded: false,
        error: true,
      };
      this.cache.set(userId, errorState);
      callback(errorState);
      this.activeRequests.delete(userId);
    });

    return () => {
    };
  }

  public preloadAvatars(userIds: string[]) {
    userIds.forEach(userId => {
      if (userId && !this.cache.has(userId) && !this.activeRequests.has(userId)) {
        this.loadUserAvatar(userId, () => {});
      }
    });
  }

  public getCachedState(userId: string): AvatarState | undefined {
    return this.cache.get(userId);
  }

  public clearCache() {
    this.cache.clear();
    this.activeRequests.clear();
  }
}

const avatarManager = new AvatarLoadManager();

export function useAvatarLoader(userId: string | null | undefined): AvatarState {
  const [state, setState] = useState<AvatarState>(() => {
    if (!userId) {
      return {
        loading: false,
        loaded: false,
        error: true,
      };
    }
    
    const cached = avatarManager.getCachedState(userId);
    if (cached) {
      return cached;
    }
    
    return {
      loading: true,
      loaded: false,
      error: false,
    };
  });

  useEffect(() => {
    if (!userId) {
      setState({
        loading: false,
        loaded: false,
        error: true,
      });
      return;
    }

    const cached = avatarManager.getCachedState(userId);
    if (cached && (cached.loaded || cached.error)) {
      setState(cached);
      return;
    }

    let cleanup: (() => void) | undefined;
    
    avatarManager.loadUserAvatar(userId, setState).then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [userId]);

  return state;
}

export function useAvatarPreloader() {
  return useCallback((userIds: string[]) => {
    avatarManager.preloadAvatars(userIds);
  }, []);
}

export function useClearAvatarCache() {
  return useCallback(() => {
    avatarManager.clearCache();
  }, []);
}
