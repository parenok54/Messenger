// ─── Auth ───────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ─── User ────────────────────────────────────────────────
export interface User {
  id: string;
  phone?: string | null;
  email?: string | null;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

export interface UserPublic {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
}

// ─── Chat ────────────────────────────────────────────────
export type ChatType = 'private' | 'group' | 'channel';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface ChatRole {
  id: string;
  chat_id: string;
  name: string;
  color?: string | null;
  can_manage_roles: boolean;
  can_manage_members: boolean;
  can_delete_messages: boolean;
  can_pin_messages: boolean;
  can_change_info: boolean;
  can_post_messages: boolean;
  position: number;
  created_at: string;
}

export interface ChatMember {
  user: UserPublic;
  role: MemberRole;
  custom_role_id?: string | null;
  custom_role?: ChatRole | null;
  custom_title?: string | null;
  can_manage_roles?: boolean;
  can_manage_members?: boolean;
  can_delete_messages?: boolean;
  can_pin_messages?: boolean;
  can_change_info?: boolean;
  can_post_messages?: boolean;
  joined_at: string;
  last_read_at?: string | null;
  last_read_message_id?: string | null;
}

export interface Chat {
  id: string;
  type: ChatType;
  title: string | null;
  description: string | null;
  avatar_url: string | null;
  created_at: string;
  members: ChatMember[];
  roles?: ChatRole[];
  last_message: Message | null;
  unread_count: number;
  pinned_message_id?: string | null;
  pinned_message?: Message | null;
}

// ─── Message ─────────────────────────────────────────────
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice' | 'system';

export interface MessageReplyInfo {
  id: string;
  sender: UserPublic | null;
  content: string | null;
  type: MessageType;
  file_name: string | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender: UserPublic | null;
  content: string | null;
  type: MessageType;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  reply_to_id: string | null;
  reply_to?: MessageReplyInfo | null;
  reactions?: Reaction[];
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  edited_at: string | null;
}

export interface MessagePage {
  items: Message[];
  total: number;
  has_more: boolean;
}

// ─── WebSocket Events ────────────────────────────────────
export type WsEvent =
  | { type: 'new_message'; message: Message }
  | { type: 'message_edited'; message: Message }
  | { type: 'message_deleted'; message_id: string; chat_id: string }
  | { type: 'message_reaction'; chat_id: string; message_id: string; reactions: Reaction[] }
  | {
      type: 'chat_pinned_message';
      chat_id: string;
      pinned_message_id: string | null;
      pinned_message: Message | null;
    }
  | { type: 'typing'; chat_id: string; user_id: string; action: 'start' | 'stop' }
  | { type: 'read_receipt'; chat_id: string; message_id?: string; user_id: string; read_at?: string }
  | { type: 'member_added'; chat_id: string; user_id: string; added_by: string }
  | { type: 'user_online'; user_id: string; is_online: boolean; last_seen?: string | null }
  | {
      type: 'call_offer';
      from_user_id: string;
      from_user_name: string;
      offer: any;
      is_video: boolean;
      chat_id: string;
    }
  | { type: 'call_answer'; from_user_id: string; answer: any; chat_id?: string }
  | { type: 'ice_candidate'; from_user_id: string; candidate: any; chat_id?: string }
  | { type: 'call_end'; from_user_id: string; chat_id?: string; reason?: string }
  | {
      type: 'media_state';
      from_user_id: string;
      chat_id?: string;
      is_video_enabled: boolean;
      is_audio_enabled: boolean;
      is_screen_sharing: boolean;
    }
  | { type: 'pong' }
  | { type: 'error'; detail: string };
