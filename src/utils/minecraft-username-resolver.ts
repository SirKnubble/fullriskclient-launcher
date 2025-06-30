interface MinecraftProfile {
  id: string;
  name: string;
}

class MinecraftUsernameResolver {
  private cache = new Map<string, string>();
  private pendingRequests = new Set<string>();

  async resolveUsername(uuid: string): Promise<string | null> {
    if (!uuid) return null;

    const cached = this.cache.get(uuid);
    if (cached) {
      return cached;
    }

    if (this.pendingRequests.has(uuid)) {
      while (this.pendingRequests.has(uuid)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.cache.get(uuid) || null;
    }

    this.pendingRequests.add(uuid);

    try {
      const cleanUuid = uuid.replace(/-/g, '');
      const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${cleanUuid}`);
      
      if (!response.ok) {
        return null;
      }

      const profile: MinecraftProfile = await response.json();
      
      if (profile && profile.name) {
        this.cache.set(uuid, profile.name);
        return profile.name;
      }

      return null;

    } catch (error) {
      return null;
    } finally {
      this.pendingRequests.delete(uuid);
    }
  }

  getCachedUsername(uuid: string): string | null {
    return this.cache.get(uuid) || null;
  }

  async preloadUsernames(uuids: string[]): Promise<void> {
    const promises = uuids.map(uuid => this.resolveUsername(uuid));
    await Promise.allSettled(promises);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

const usernameResolver = new MinecraftUsernameResolver();

export { usernameResolver, MinecraftUsernameResolver };
export type { MinecraftProfile };
