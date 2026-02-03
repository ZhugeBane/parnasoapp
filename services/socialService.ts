import { User, Friendship, Message } from '../types';
import { getAllUsers } from './authService';

const FRIENDSHIPS_KEY = 'parnaso_friendships';
const MESSAGES_KEY = 'parnaso_messages';

// --- Friendships ---

export const getFriendships = (): Friendship[] => {
  const stored = localStorage.getItem(FRIENDSHIPS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const sendFriendRequest = (requesterId: string, receiverId: string) => {
  const friendships = getFriendships();
  
  // Check if exists
  const exists = friendships.find(f => 
    (f.requesterId === requesterId && f.receiverId === receiverId) ||
    (f.requesterId === receiverId && f.requesterId === requesterId)
  );

  if (exists) throw new Error("Solicitação já enviada ou vocês já são amigos.");

  const newFriendship: Friendship = {
    id: Date.now().toString(),
    requesterId,
    receiverId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  friendships.push(newFriendship);
  localStorage.setItem(FRIENDSHIPS_KEY, JSON.stringify(friendships));
  return newFriendship;
};

export const acceptFriendRequest = (friendshipId: string) => {
  const friendships = getFriendships();
  const index = friendships.findIndex(f => f.id === friendshipId);
  if (index !== -1) {
    friendships[index].status = 'accepted';
    localStorage.setItem(FRIENDSHIPS_KEY, JSON.stringify(friendships));
  }
};

export const removeFriendship = (friendshipId: string) => {
  const friendships = getFriendships();
  const newFriendships = friendships.filter(f => f.id !== friendshipId);
  localStorage.setItem(FRIENDSHIPS_KEY, JSON.stringify(newFriendships));
};

export const getFriendsList = (userId: string): { user: User, friendshipId: string }[] => {
  const friendships = getFriendships();
  const allUsers = getAllUsers();
  
  const accepted = friendships.filter(f => 
    f.status === 'accepted' && (f.requesterId === userId || f.receiverId === userId)
  );

  return accepted.map(f => {
    const friendId = f.requesterId === userId ? f.receiverId : f.requesterId;
    const friendUser = allUsers.find(u => u.id === friendId);
    return friendUser ? { user: friendUser, friendshipId: f.id } : null;
  }).filter(Boolean) as { user: User, friendshipId: string }[];
};

export const getPendingRequests = (userId: string): { user: User, friendshipId: string, type: 'received' | 'sent' }[] => {
  const friendships = getFriendships();
  const allUsers = getAllUsers();

  const pending = friendships.filter(f => f.status === 'pending' && (f.receiverId === userId || f.requesterId === userId));

  return pending.map(f => {
    const isReceived = f.receiverId === userId;
    const otherId = isReceived ? f.requesterId : f.receiverId;
    const otherUser = allUsers.find(u => u.id === otherId);
    
    return otherUser ? {
      user: otherUser,
      friendshipId: f.id,
      type: isReceived ? 'received' : 'sent'
    } : null;
  }).filter(Boolean) as any;
};

export const getAvailableUsers = (currentUserId: string): User[] => {
  const allUsers = getAllUsers();
  const friendships = getFriendships();

  // Filter out self, admins, blocked users, and existing friends/requests
  return allUsers.filter(u => {
    if (u.id === currentUserId) return false;
    if (u.role === 'admin') return false; // Usually don't add admins as writing buddies
    if (u.isBlocked) return false;

    const hasRelation = friendships.some(f => 
      (f.requesterId === currentUserId && f.receiverId === u.id) ||
      (f.requesterId === u.id && f.receiverId === currentUserId)
    );

    return !hasRelation;
  });
};

// --- Messages ---

export const getMessages = (): Message[] => {
  const stored = localStorage.getItem(MESSAGES_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const getConversation = (userId1: string, userId2: string): Message[] => {
  const allMessages = getMessages();
  return allMessages
    .filter(m => 
      (m.senderId === userId1 && m.receiverId === userId2) ||
      (m.senderId === userId2 && m.receiverId === userId1)
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export const sendMessage = (senderId: string, receiverId: string, content: string): Message => {
  const messages = getMessages();
  const newMessage: Message = {
    id: Date.now().toString(),
    senderId,
    receiverId,
    content,
    timestamp: new Date().toISOString(),
    read: false
  };
  messages.push(newMessage);
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  return newMessage;
};

export const markAsRead = (senderId: string, receiverId: string) => {
  const messages = getMessages();
  let changed = false;
  messages.forEach(m => {
    if (m.senderId === senderId && m.receiverId === receiverId && !m.read) {
      m.read = true;
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  }
};