'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Phone,
  Video,
  Copy,
  UserPlus,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Crown,
  LogOut,
  FileText,
  Download,
  ExternalLink,
  Search,
  Check,
  Image as ImageIcon,
  File,
  Mic,
  Link2,
  Users,
  Settings,
  Plus,
  Pencil,
  CheckSquare,
  Square,
  Sparkles,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Chat, ChatMember, ChatRole, Message, UserPublic, MemberRole } from '@/types';
import { useAuthStore, useChatStore, useLanguageStore } from '@/store/useStore';
import { chatsApi, usersApi } from '@/lib/api';
import { formatUserStatus } from '@/lib/formatStatus';
import { MediaLightboxModal, MediaItem } from './MediaLightboxModal';
import { VoiceWaveformPlayer } from './VoiceWaveformPlayer';

interface ChatInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat;
  messages: Message[];
}

type TabType = 'members' | 'roles' | 'media' | 'files' | 'voice' | 'links';

const ROLE_COLORS = [
  '#2AABEE', // Telegram Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate
];

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ChatInfoModal({ isOpen, onClose, chat, messages }: ChatInfoModalProps) {
  const currentUser = useAuthStore((s) => s.user);
  const updateChat = useChatStore((s) => s.updateChat);
  const removeChat = useChatStore((s) => s.removeChat);
  const setActiveCall = useChatStore((s) => s.setActiveCall);
  const { t, lang } = useLanguageStore();

  const isPrivate = chat.type === 'private';
  const otherMember = isPrivate ? chat.members.find((m) => m.user.id !== currentUser?.id) : null;
  const currentMember = chat.members.find((m) => m.user.id === currentUser?.id);
  const isOwner = currentMember?.role === 'owner';
  const canManageRoles =
    isOwner ||
    !!currentMember?.can_manage_roles ||
    !!currentMember?.custom_role?.can_manage_roles;

  const [activeTab, setActiveTab] = useState<TabType>(isPrivate ? 'media' : 'members');

  // Lightbox для медиа
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Добавление участников
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPublic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Кастомные роли (модальное окно создания / редактирования роли)
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ChatRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#2AABEE');
  const [roleCanManageRoles, setRoleCanManageRoles] = useState(false);
  const [roleCanManageMembers, setRoleCanManageMembers] = useState(false);
  const [roleCanDeleteMessages, setRoleCanDeleteMessages] = useState(false);
  const [roleCanPinMessages, setRoleCanPinMessages] = useState(false);
  const [roleCanChangeInfo, setRoleCanChangeInfo] = useState(false);
  const [roleCanPostMessages, setRoleCanPostMessages] = useState(true);
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Настройка прав и роли конкретного участника
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ChatMember | null>(null);
  const [memberRole, setMemberRole] = useState<MemberRole>('member');
  const [memberCustomRoleId, setMemberCustomRoleId] = useState<string>('');
  const [memberCustomTitle, setMemberCustomTitle] = useState('');
  const [memberCanManageRoles, setMemberCanManageRoles] = useState(false);
  const [memberCanManageMembers, setMemberCanManageMembers] = useState(false);
  const [memberCanDeleteMessages, setMemberCanDeleteMessages] = useState(false);
  const [memberCanPinMessages, setMemberCanPinMessages] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Сброс при открытии
  useEffect(() => {
    if (isOpen) {
      setActiveTab(isPrivate ? 'media' : 'members');
      setIsAddingMember(false);
      setSearchQuery('');
      setSearchResults([]);
      setRoleModalOpen(false);
      setMemberModalOpen(false);
    }
  }, [isOpen, isPrivate]);

  // Поиск пользователей для добавления
  useEffect(() => {
    if (!isAddingMember || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await usersApi.search(searchQuery.trim());
        const existingIds = new Set(chat.members.map((m) => m.user.id));
        const filtered = (res.data || []).filter(
          (u: UserPublic) => !existingIds.has(u.id) && u.id !== currentUser?.id
        );
        setSearchResults(filtered);
      } catch {
        // Ошибка поиска
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isAddingMember, chat.members, currentUser?.id]);

  // Фильтрация общих материалов
  const mediaItems: MediaItem[] = useMemo(() => {
    return messages
      .filter((m) => (m.type === 'image' || m.type === 'video') && m.file_url)
      .map((m) => ({
        id: m.id,
        url: m.file_url!,
        type: m.type as 'image' | 'video',
        fileName: m.file_name,
        senderName: m.sender?.display_name || m.sender?.username,
        createdAt: m.created_at,
      }));
  }, [messages]);

  const fileItems = useMemo(() => {
    return messages.filter((m) => m.type === 'file' && m.file_url);
  }, [messages]);

  const voiceItems = useMemo(() => {
    return messages.filter((m) => (m.type === 'voice' || m.type === 'audio') && m.file_url);
  }, [messages]);

  const linkItems = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const items: { id: string; url: string; date: string; sender: string }[] = [];
    messages.forEach((m) => {
      if (m.content) {
        const matches = m.content.match(urlRegex);
        if (matches) {
          matches.forEach((url) => {
            items.push({
              id: `${m.id}-${url}`,
              url,
              date: m.created_at,
              sender: m.sender?.display_name || m.sender?.username || '',
            });
          });
        }
      }
    });
    return items;
  }, [messages]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t.copiedToClipboard);
  };

  const handleAddMember = async (userId: string) => {
    setActionLoadingId(userId);
    try {
      await chatsApi.addMember(chat.id, userId);
      const res = await chatsApi.getById(chat.id);
      updateChat(res.data);
      toast.success(lang === 'ky' ? 'Катышуучу кошулду' : lang === 'en' ? 'Member added' : 'Участник добавлен');
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      toast.error('Ошибка добавления');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(lang === 'ky' ? 'Катышуучуну чыгаруу керекпи?' : lang === 'en' ? 'Remove this member?' : 'Удалить участника из чата?')) {
      return;
    }
    setActionLoadingId(userId);
    try {
      await chatsApi.removeMember(chat.id, userId);
      const res = await chatsApi.getById(chat.id);
      updateChat(res.data);
      toast.success(lang === 'ky' ? 'Катышуучу чыгарылды' : lang === 'en' ? 'Member removed' : 'Участник удален');
    } catch {
      toast.error('Ошибка удаления');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeaveChat = async () => {
    if (!currentUser) return;
    if (!confirm(lang === 'ky' ? 'Чаттан чыгууну каалайсызбы?' : lang === 'en' ? 'Leave this chat?' : 'Вы уверены, что хотите покинуть чат?')) {
      return;
    }
    try {
      await chatsApi.removeMember(chat.id, currentUser.id);
      removeChat(chat.id);
      toast.success(lang === 'ky' ? 'Сиз чаттан чыктыңыз' : lang === 'en' ? 'You left the chat' : 'Вы покинули чат');
      onClose();
    } catch {
      toast.error('Ошибка выхода из чата');
    }
  };

  // Открыть редактор роли
  const openCreateRole = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleColor('#2AABEE');
    setRoleCanManageRoles(false);
    setRoleCanManageMembers(false);
    setRoleCanDeleteMessages(false);
    setRoleCanPinMessages(false);
    setRoleCanChangeInfo(false);
    setRoleCanPostMessages(true);
    setRoleModalOpen(true);
  };

  const openEditRole = (role: ChatRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleColor(role.color || '#2AABEE');
    setRoleCanManageRoles(role.can_manage_roles);
    setRoleCanManageMembers(role.can_manage_members);
    setRoleCanDeleteMessages(role.can_delete_messages);
    setRoleCanPinMessages(role.can_pin_messages);
    setRoleCanChangeInfo(role.can_change_info);
    setRoleCanPostMessages(role.can_post_messages);
    setRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      toast.error(t.roleName);
      return;
    }
    setIsSavingRole(true);
    try {
      const payload = {
        name: roleName.trim(),
        color: roleColor,
        can_manage_roles: isOwner ? roleCanManageRoles : false,
        can_manage_members: roleCanManageMembers,
        can_delete_messages: roleCanDeleteMessages,
        can_pin_messages: roleCanPinMessages,
        can_change_info: roleCanChangeInfo,
        can_post_messages: roleCanPostMessages,
      };

      if (editingRole) {
        await chatsApi.updateRole(chat.id, editingRole.id, payload);
        toast.success(t.roleUpdated);
      } else {
        await chatsApi.createRole(chat.id, payload);
        toast.success(t.roleCreated);
      }
      const res = await chatsApi.getById(chat.id);
      updateChat(res.data);
      setRoleModalOpen(false);
    } catch {
      toast.error('Ошибка сохранения роли');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm(t.deleteRole + '?')) return;
    try {
      await chatsApi.deleteRole(chat.id, roleId);
      const res = await chatsApi.getById(chat.id);
      updateChat(res.data);
      toast.success(t.roleDeleted);
    } catch {
      toast.error('Ошибка удаления роли');
    }
  };

  // Открыть редактор прав участника
  const openEditMember = (member: ChatMember) => {
    setEditingMember(member);
    setMemberRole(member.role);
    setMemberCustomRoleId(member.custom_role_id || '');
    setMemberCustomTitle(member.custom_title || '');
    setMemberCanManageRoles(!!member.can_manage_roles);
    setMemberCanManageMembers(!!member.can_manage_members);
    setMemberCanDeleteMessages(!!member.can_delete_messages);
    setMemberCanPinMessages(!!member.can_pin_messages);
    setMemberModalOpen(true);
  };

  const handleSaveMember = async () => {
    if (!editingMember) return;
    setIsSavingMember(true);
    try {
      const payload: any = {
        role: memberRole,
        custom_role_id: memberCustomRoleId ? memberCustomRoleId : '00000000-0000-0000-0000-000000000000',
        custom_title: memberCustomTitle.trim() || null,
        can_manage_members: memberCanManageMembers,
        can_delete_messages: memberCanDeleteMessages,
        can_pin_messages: memberCanPinMessages,
      };
      if (isOwner) {
        payload.can_manage_roles = memberCanManageRoles;
      }
      await chatsApi.updateMemberRole(chat.id, editingMember.user.id, payload);
      const res = await chatsApi.getById(chat.id);
      updateChat(res.data);
      toast.success(lang === 'ky' ? 'Укуктар жаңыртылды' : lang === 'en' ? 'Permissions updated' : 'Права участника обновлены');
      setMemberModalOpen(false);
    } catch {
      toast.error('Ошибка обновления прав');
    } finally {
      setIsSavingMember(false);
    }
  };

  const startCall = (isVideo: boolean) => {
    if (!otherMember) return;
    setActiveCall({
      targetUserId: otherMember.user.id,
      targetUserName: otherMember.user.display_name || otherMember.user.username || 'Собеседник',
      chatId: chat.id,
      isVideo,
      isIncoming: false,
    });
    onClose();
  };

  const userStatus = isPrivate ? formatUserStatus(otherMember?.user, lang) : null;
  const avatarUrl = isPrivate ? otherMember?.user.avatar_url : chat.avatar_url;
  const title = isPrivate
    ? otherMember?.user.display_name || otherMember?.user.username || 'Собеседник'
    : chat.title || 'Чат';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Main Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-[#17212b] border-l border-gray-800 text-white shadow-2xl animate-fade-in sm:w-[460px]">
        {/* Top bar */}
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-5">
          <h3 className="font-semibold text-lg text-white">
            {isPrivate
              ? t.userProfile
              : chat.type === 'channel'
              ? t.channelInfo
              : t.groupInfo}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Profile Card */}
          <div className="flex flex-col items-center border-b border-gray-800 bg-[#1c2733]/50 px-6 py-6 text-center">
            <div className="relative mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 text-3xl font-bold shadow-lg">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={title}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                title.charAt(0).toUpperCase()
              )}
              {isPrivate && otherMember?.user.is_online && (
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-[#17212b]" />
              )}
            </div>

            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-0.5 text-xs">
              {isPrivate ? (
                <span className={userStatus?.isOnline ? 'text-[#2AABEE] font-medium' : 'text-gray-400'}>
                  {userStatus?.text}
                </span>
              ) : (
                <span className="text-gray-400">
                  {chat.type === 'channel'
                    ? t.subscribersCount(chat.members.length)
                    : t.membersCount(
                        chat.members.length,
                        chat.members.filter((m) => m.user.is_online).length
                      )}
                </span>
              )}
            </p>

            {/* Quick action buttons for private chat */}
            {isPrivate && otherMember && (
              <div className="mt-4 flex items-center space-x-3">
                <button
                  onClick={() => startCall(false)}
                  className="flex items-center space-x-2 rounded-xl bg-[#242f3d] px-4 py-2 text-xs font-medium text-gray-200 hover:bg-emerald-600 hover:text-white transition shadow-sm"
                >
                  <Phone size={15} />
                  <span>{t.audioCall}</span>
                </button>
                <button
                  onClick={() => startCall(true)}
                  className="flex items-center space-x-2 rounded-xl bg-[#242f3d] px-4 py-2 text-xs font-medium text-gray-200 hover:bg-[#2AABEE] hover:text-white transition shadow-sm"
                >
                  <Video size={15} />
                  <span>{t.videoCall}</span>
                </button>
              </div>
            )}
          </div>

          {/* Details info section */}
          <div className="border-b border-gray-800 px-6 py-4 space-y-3.5 text-sm">
            {/* Username */}
            {isPrivate && otherMember?.user.username && (
              <div className="flex items-center justify-between group">
                <div>
                  <p className="text-xs text-gray-400">{t.username}</p>
                  <p className="font-medium text-white">@{otherMember.user.username}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(`@${otherMember.user.username}`)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-[#2AABEE] transition"
                  title={t.copyText}
                >
                  <Copy size={16} />
                </button>
              </div>
            )}

            {/* Bio / Description */}
            {(isPrivate ? otherMember?.user.bio : chat.description) && (
              <div>
                <p className="text-xs text-gray-400">{isPrivate ? t.bio : 'Описание'}</p>
                <p className="font-medium text-white break-words mt-0.5">
                  {isPrivate ? otherMember?.user.bio : chat.description}
                </p>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-800 bg-[#17212b] px-4 overflow-x-auto no-scrollbar">
            {!isPrivate && (
              <>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`flex items-center space-x-1.5 border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition ${
                    activeTab === 'members'
                      ? 'border-[#2AABEE] text-[#2AABEE]'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Users size={15} />
                  <span>{chat.type === 'channel' ? t.subscribers : t.tabMembers}</span>
                  <span className="rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300">
                    {chat.members.length}
                  </span>
                </button>

                {canManageRoles && (
                  <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex items-center space-x-1.5 border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition ${
                      activeTab === 'roles'
                        ? 'border-[#2AABEE] text-[#2AABEE]'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    <Tag size={15} />
                    <span>{t.customRoles}</span>
                    {chat.roles && chat.roles.length > 0 && (
                      <span className="rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300">
                        {chat.roles.length}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setActiveTab('media')}
              className={`flex items-center space-x-1.5 border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition ${
                activeTab === 'media'
                  ? 'border-[#2AABEE] text-[#2AABEE]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <ImageIcon size={15} />
              <span>{t.tabMedia}</span>
              {mediaItems.length > 0 && (
                <span className="rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300">
                  {mediaItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center space-x-1.5 border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition ${
                activeTab === 'files'
                  ? 'border-[#2AABEE] text-[#2AABEE]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <File size={15} />
              <span>{t.tabFiles}</span>
              {fileItems.length > 0 && (
                <span className="rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300">
                  {fileItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('voice')}
              className={`flex items-center space-x-1.5 border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition ${
                activeTab === 'voice'
                  ? 'border-[#2AABEE] text-[#2AABEE]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Mic size={15} />
              <span>{t.tabVoice}</span>
              {voiceItems.length > 0 && (
                <span className="rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300">
                  {voiceItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('links')}
              className={`flex items-center space-x-1.5 border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition ${
                activeTab === 'links'
                  ? 'border-[#2AABEE] text-[#2AABEE]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Link2 size={15} />
              <span>{t.tabLinks}</span>
              {linkItems.length > 0 && (
                <span className="rounded-full bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-300">
                  {linkItems.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Contents */}
          <div className="p-4">
            {/* Members tab */}
            {activeTab === 'members' && !isPrivate && (
              <div className="space-y-4">
                {/* Add member button */}
                {(isOwner || currentMember?.role === 'admin' || canManageRoles) && (
                  <div>
                    {!isAddingMember ? (
                      <button
                        onClick={() => setIsAddingMember(true)}
                        className="flex w-full items-center justify-center space-x-2 rounded-xl bg-[#242f3d] py-2.5 text-xs font-semibold text-[#2AABEE] hover:bg-[#2AABEE]/15 transition border border-[#2AABEE]/20 shadow-sm"
                      >
                        <UserPlus size={16} />
                        <span>{t.addMember}</span>
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-gray-700/80 bg-[#1c2733] p-3 space-y-2 animate-message">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-300">{t.addMember}</p>
                          <button
                            onClick={() => {
                              setIsAddingMember(false);
                              setSearchQuery('');
                              setSearchResults([]);
                            }}
                            className="text-gray-400 hover:text-white text-xs"
                          >
                            {t.cancelBtn}
                          </button>
                        </div>
                        <div className="relative">
                          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.searchUsersToAdd}
                            className="w-full rounded-xl bg-[#242f3d] py-1.5 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2AABEE]"
                            autoFocus
                          />
                        </div>

                        {/* Search Results */}
                        {isSearching ? (
                          <div className="py-4 text-center text-xs text-gray-400">
                            {lang === 'ky' ? 'Издөө жүрүүдө...' : lang === 'en' ? 'Searching...' : 'Поиск...'}
                          </div>
                        ) : searchResults.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-gray-800">
                            {searchResults.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center justify-between pt-1.5 first:pt-0"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                    {user.avatar_url ? (
                                      <img
                                        src={user.avatar_url}
                                        alt={user.display_name}
                                        className="h-full w-full rounded-full object-cover"
                                      />
                                    ) : (
                                      user.display_name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-white">
                                      {user.display_name}
                                    </p>
                                    {user.username && (
                                      <p className="truncate text-[10px] text-gray-400">
                                        @{user.username}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAddMember(user.id)}
                                  disabled={actionLoadingId === user.id}
                                  className="flex items-center space-x-1 rounded-lg bg-[#2AABEE] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#229ed9] transition disabled:opacity-50"
                                >
                                  <span>{t.addBtn}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : searchQuery.trim() ? (
                          <div className="py-3 text-center text-xs text-gray-500">
                            {t.searchNoResults}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                {/* Member List */}
                <div className="space-y-2">
                  {chat.members.map((member) => {
                    const isSelf = member.user.id === currentUser?.id;
                    const canEditThisMember =
                      canManageRoles &&
                      !isSelf &&
                      member.role !== 'owner';
                    const canRemove =
                      !isSelf &&
                      member.role !== 'owner' &&
                      (isOwner || canManageRoles || (currentMember?.role === 'admin' && member.role === 'member'));

                    const memberStatus = formatUserStatus(member.user, lang);

                    return (
                      <div
                        key={member.user.id}
                        className="flex items-center justify-between rounded-xl bg-[#1c2733]/60 p-2.5 hover:bg-[#1c2733] transition"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-xs font-bold text-white">
                            {member.user.avatar_url ? (
                              <img
                                src={member.user.avatar_url}
                                alt={member.user.display_name}
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              (member.user.display_name || 'У').charAt(0).toUpperCase()
                            )}
                            {member.user.is_online && (
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#1c2733]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                              <p className="truncate text-xs font-semibold text-white">
                                {member.user.display_name}
                                {isSelf && ` (${t.youPrefix.replace(':', '')})`}
                              </p>
                              {member.role === 'owner' && (
                                <span className="flex items-center space-x-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                                  <Crown size={10} />
                                  <span>{t.ownerRole}</span>
                                </span>
                              )}
                              {member.role === 'admin' && (
                                <span className="flex items-center space-x-0.5 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-[#2AABEE]">
                                  <Shield size={10} />
                                  <span>{t.adminRole}</span>
                                </span>
                              )}
                              {member.custom_role && (
                                <span
                                  className="flex items-center space-x-1 rounded-full px-2 py-0.5 text-[9px] font-bold shadow-sm"
                                  style={{
                                    backgroundColor: `${member.custom_role.color || '#2AABEE'}22`,
                                    color: member.custom_role.color || '#2AABEE',
                                    border: `1px solid ${member.custom_role.color || '#2AABEE'}44`,
                                  }}
                                >
                                  <Tag size={9} />
                                  <span>{member.custom_role.name}</span>
                                </span>
                              )}
                              {member.custom_title && (
                                <span className="rounded-md bg-gray-800/80 px-1.5 py-0.2 text-[9px] text-gray-300">
                                  {member.custom_title}
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[11px] text-gray-400">
                              {memberStatus.text}
                            </p>
                          </div>
                        </div>

                        {/* Actions for member */}
                        <div className="flex items-center space-x-1">
                          {canEditThisMember && (
                            <button
                              onClick={() => openEditMember(member)}
                              disabled={actionLoadingId === member.user.id}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-[#2AABEE] transition"
                              title="Настроить права и роль"
                            >
                              <Settings size={16} />
                            </button>
                          )}
                          {canRemove && (
                            <button
                              onClick={() => handleRemoveMember(member.user.id)}
                              disabled={actionLoadingId === member.user.id}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-red-400 transition"
                              title={t.removeMember}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Leave Chat Button */}
                <div className="pt-4 border-t border-gray-800/80">
                  <button
                    onClick={handleLeaveChat}
                    className="flex w-full items-center justify-center space-x-2 rounded-xl bg-red-500/10 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition"
                  >
                    <LogOut size={16} />
                    <span>{t.leaveChat}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Custom Roles tab */}
            {activeTab === 'roles' && canManageRoles && (
              <div className="space-y-4">
                <button
                  onClick={openCreateRole}
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-[#2AABEE] py-2.5 text-xs font-semibold text-white hover:bg-[#229ed9] transition shadow-md"
                >
                  <Plus size={16} />
                  <span>{t.createRole}</span>
                </button>

                {(!chat.roles || chat.roles.length === 0) ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    {t.noRolesYet}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {chat.roles.map((role) => {
                      const memberCountWithRole = chat.members.filter(
                        (m) => m.custom_role_id === role.id
                      ).length;

                      return (
                        <div
                          key={role.id}
                          className="rounded-2xl border border-gray-800 bg-[#1c2733]/80 p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: role.color || '#2AABEE' }}
                              />
                              <h4 className="font-semibold text-sm text-white">{role.name}</h4>
                              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300">
                                {memberCountWithRole} {t.members.toLowerCase()}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => openEditRole(role)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
                                title={t.editRole}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteRole(role.id)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-red-400 transition"
                                title={t.deleteRole}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Permissions summary */}
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            {role.can_manage_roles && (
                              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-400 font-medium">
                                👑 Роли и админы
                              </span>
                            )}
                            {role.can_manage_members && (
                              <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[#2AABEE] font-medium">
                                👥 Участники
                              </span>
                            )}
                            {role.can_delete_messages && (
                              <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-red-400 font-medium">
                                🗑️ Удаление
                              </span>
                            )}
                            {role.can_pin_messages && (
                              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-400 font-medium">
                                📌 Закрепление
                              </span>
                            )}
                            {role.can_change_info && (
                              <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-purple-400 font-medium">
                                ⚙️ Инфо чата
                              </span>
                            )}
                            {role.can_post_messages && (
                              <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-cyan-400 font-medium">
                                💬 Публикация
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Media tab */}
            {activeTab === 'media' && (
              <div>
                {mediaItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    {t.noSharedMedia}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {mediaItems.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }}
                        className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-[#242f3d]"
                      >
                        {item.type === 'video' ? (
                          <video
                            src={item.url}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <img
                            src={item.url}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                          <ImageIcon size={20} className="text-white drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Files tab */}
            {activeTab === 'files' && (
              <div className="space-y-2">
                {fileItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    {t.noSharedFiles}
                  </div>
                ) : (
                  fileItems.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-center justify-between rounded-xl bg-[#1c2733]/60 p-3 hover:bg-[#1c2733] transition"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-[#2AABEE]">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {msg.file_name || 'Документ'}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {formatFileSize(msg.file_size)} • {new Date(msg.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {msg.file_url && (
                        <a
                          href={msg.file_url}
                          download={msg.file_name || true}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition"
                          title={t.download}
                        >
                          <Download size={17} />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Voice tab */}
            {activeTab === 'voice' && (
              <div className="space-y-3">
                {voiceItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    {t.noSharedVoice}
                  </div>
                ) : (
                  voiceItems.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-xl bg-[#1c2733]/60 p-3 hover:bg-[#1c2733] transition space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span className="font-medium text-gray-300">
                          {msg.sender?.display_name || msg.sender?.username || 'Пользователь'}
                        </span>
                        <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                      {msg.file_url && (
                        <VoiceWaveformPlayer
                          fileUrl={msg.file_url}
                          isMe={msg.sender?.id === currentUser?.id}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Links tab */}
            {activeTab === 'links' && (
              <div className="space-y-2">
                {linkItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    {t.noSharedLinks}
                  </div>
                ) : (
                  linkItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-[#1c2733]/60 p-3 hover:bg-[#1c2733] transition"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-[#2AABEE]">
                          <Link2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-xs font-semibold text-[#2AABEE] hover:underline"
                          >
                            {item.url}
                          </a>
                          <p className="text-[10px] text-gray-400">
                            {item.sender} • {new Date(item.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно создания / редактирования кастомной роли */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setRoleModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-gray-700/80 bg-[#1c2733] p-6 text-white shadow-2xl animate-menu-in space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingRole ? t.editRole : t.createRole}
              </h3>
              <button
                onClick={() => setRoleModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Название роли */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                {t.roleName}
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="например: Модератор или VIP"
                className="w-full rounded-xl bg-[#242f3d] px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1.5 focus:ring-[#2AABEE]"
                autoFocus
              />
            </div>

            {/* Выбор цвета */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                {t.roleColor}
              </label>
              <div className="flex items-center space-x-2">
                {ROLE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setRoleColor(color)}
                    className="h-7 w-7 rounded-full flex items-center justify-center transition-transform active:scale-95"
                    style={{ backgroundColor: color }}
                  >
                    {roleColor === color && <Check size={14} className="text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Список прав */}
            <div className="space-y-2 pt-2 border-t border-gray-800">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {t.permissions}
              </p>

              {/* Только владелец может наделить роль правом управлять ролями и админами */}
              {isOwner && (
                <label className="flex items-center justify-between p-2 rounded-xl bg-[#242f3d]/60 cursor-pointer hover:bg-[#242f3d] transition">
                  <div className="text-xs">
                    <p className="font-semibold text-amber-400">{t.permManageRoles}</p>
                    <p className="text-[10px] text-gray-400">Назначение админов и создание ролей</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={roleCanManageRoles}
                    onChange={(e) => setRoleCanManageRoles(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#2AABEE]"
                  />
                </label>
              )}

              <label className="flex items-center justify-between p-2 rounded-xl bg-[#242f3d]/60 cursor-pointer hover:bg-[#242f3d] transition">
                <span className="text-xs text-gray-200">{t.permManageMembers}</span>
                <input
                  type="checkbox"
                  checked={roleCanManageMembers}
                  onChange={(e) => setRoleCanManageMembers(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2AABEE]"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-[#242f3d]/60 cursor-pointer hover:bg-[#242f3d] transition">
                <span className="text-xs text-gray-200">{t.permDeleteMessages}</span>
                <input
                  type="checkbox"
                  checked={roleCanDeleteMessages}
                  onChange={(e) => setRoleCanDeleteMessages(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2AABEE]"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-[#242f3d]/60 cursor-pointer hover:bg-[#242f3d] transition">
                <span className="text-xs text-gray-200">{t.permPinMessages}</span>
                <input
                  type="checkbox"
                  checked={roleCanPinMessages}
                  onChange={(e) => setRoleCanPinMessages(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2AABEE]"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-[#242f3d]/60 cursor-pointer hover:bg-[#242f3d] transition">
                <span className="text-xs text-gray-200">{t.permChangeInfo}</span>
                <input
                  type="checkbox"
                  checked={roleCanChangeInfo}
                  onChange={(e) => setRoleCanChangeInfo(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2AABEE]"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-[#242f3d]/60 cursor-pointer hover:bg-[#242f3d] transition">
                <span className="text-xs text-gray-200">{t.permPostMessages}</span>
                <input
                  type="checkbox"
                  checked={roleCanPostMessages}
                  onChange={(e) => setRoleCanPostMessages(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2AABEE]"
                />
              </label>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs text-gray-400 hover:text-white transition"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleSaveRole}
                disabled={isSavingRole}
                className="rounded-xl bg-[#2AABEE] px-5 py-2 text-xs font-semibold text-white hover:bg-[#229ed9] transition shadow-md disabled:opacity-50"
              >
                {isSavingRole ? '...' : t.saveBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования прав участника */}
      {memberModalOpen && editingMember && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMemberModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-gray-700/80 bg-[#1c2733] p-6 text-white shadow-2xl animate-menu-in space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Настройка прав участника
                </h3>
                <p className="text-xs text-[#2AABEE] font-medium">
                  {editingMember.user.display_name}
                </p>
              </div>
              <button
                onClick={() => setMemberModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Выбор роли в чате (Администратор или Участник) */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Основной статус
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMemberRole('member')}
                  className={`flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition ${
                    memberRole === 'member'
                      ? 'bg-[#2AABEE] text-white shadow-md'
                      : 'bg-[#242f3d] text-gray-400 hover:text-white'
                  }`}
                >
                  <Users size={14} />
                  <span>{t.memberRole}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMemberRole('admin')}
                  className={`flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition ${
                    memberRole === 'admin'
                      ? 'bg-[#2AABEE] text-white shadow-md'
                      : 'bg-[#242f3d] text-gray-400 hover:text-white'
                  }`}
                >
                  <Shield size={14} />
                  <span>{t.adminRole}</span>
                </button>
              </div>
            </div>

            {/* Кастомная роль */}
            {chat.roles && chat.roles.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {t.assignRole}
                </label>
                <select
                  value={memberCustomRoleId}
                  onChange={(e) => setMemberCustomRoleId(e.target.value)}
                  className="w-full rounded-xl bg-[#242f3d] px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1.5 focus:ring-[#2AABEE]"
                >
                  <option value="">Без кастомной роли</option>
                  {chat.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Пользовательский титул / должность */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Пользовательский титул (метка)
              </label>
              <input
                type="text"
                value={memberCustomTitle}
                onChange={(e) => setMemberCustomTitle(e.target.value)}
                placeholder="например: Шеф-редактор, Куратор"
                className="w-full rounded-xl bg-[#242f3d] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1.5 focus:ring-[#2AABEE]"
              />
            </div>

            {/* Специальное право: Управление ролями и назначение админов (Только владелец может выдать!) */}
            {isOwner && (
              <div className="pt-2 border-t border-gray-800">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer">
                  <div className="text-xs">
                    <p className="font-bold text-amber-400">{t.permManageRoles}</p>
                    <p className="text-[10px] text-gray-300">
                      Разрешить этому администратору назначать других админов и создавать роли
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={memberCanManageRoles}
                    onChange={(e) => setMemberCanManageRoles(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                </label>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setMemberModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs text-gray-400 hover:text-white transition"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleSaveMember}
                disabled={isSavingMember}
                className="rounded-xl bg-[#2AABEE] px-5 py-2 text-xs font-semibold text-white hover:bg-[#229ed9] transition shadow-md disabled:opacity-50"
              >
                {isSavingMember ? '...' : t.saveBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for media preview */}
      <MediaLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        mediaItems={mediaItems}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
