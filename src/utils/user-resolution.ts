import type { FriendsFriendUser } from '../types/friends';
import type { ChatWithMetadata, Chat } from '../types/messaging';

export class UserResolver {
  static async resolveUserName(
    userId: string, 
    friends?: FriendsFriendUser[], 
    chats: (ChatWithMetadata | Chat)[] = []
  ): Promise<string> {
    let friendsList = friends;
    if (!friendsList || friendsList.length === 0) {
      try {
        const { useFriendsStore } = await import('../store/useFriendsStore');
        const store = useFriendsStore.getState();
        friendsList = store.friends || [];
        
        if (friendsList.length === 0) {
          try {
            await store.refreshFriendsData();
            const updatedStore = useFriendsStore.getState();
            friendsList = updatedStore.friends || [];
          } catch (refreshError) {
          }
        }
      } catch (error) {
        friendsList = [];
      }
    }
    
    const senderFriend = friendsList.find(f => this.areUuidsEqual(f.noriskUser.uuid, userId));
    if (senderFriend) {
      const friendName = senderFriend.noriskUser.displayName || senderFriend.noriskUser.ign;
      return friendName;
    }
    
    const fallbackName = this.formatUserIdFallback(userId);
    return fallbackName;
  }
  
  static resolveUserNameSync(
    userId: string, 
    friends: FriendsFriendUser[] = [], 
    chats: (ChatWithMetadata | Chat)[] = []
  ): string {
    const senderFriend = friends.find(f => this.areUuidsEqual(f.noriskUser.uuid, userId));
    if (senderFriend) {
      const friendName = senderFriend.noriskUser.displayName || senderFriend.noriskUser.ign;
      return friendName;
    }
    
    const fallbackName = this.formatUserIdFallback(userId);
    return fallbackName;
  }
  
  private static formatUserIdFallback(userId: string): string {
    if (!userId) return "Unknown User";
    
    if (userId.length >= 8) {
      return `User ${userId.slice(0, 8)}`;
    }
    
    return `User ${userId}`;
  }

  static areUuidsEqual(uuid1: string, uuid2: string): boolean {
    if (!uuid1 || !uuid2) return false;
    
    const clean1 = uuid1.replace(/-/g, '').toLowerCase();
    const clean2 = uuid2.replace(/-/g, '').toLowerCase();
    
    return clean1 === clean2;
  }
}