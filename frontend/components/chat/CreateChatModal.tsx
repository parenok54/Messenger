'use client';

import React, { useState } from 'react';
import { usersApi, chatsApi } from '@/lib/api';
import { ChatType, UserPublic } from '@/types';
import { X, Users, Megaphone, Search, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

export function CreateChatModal({ isOpen, onClose, onChatCreated }: CreateChatModalProps) {
  const [chatType, setChatType] = useState<ChatType>('group');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPublic[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await usersApi.search(q);
      setSearchResults(res.data);
    } catch {
      // Игнорируем
    }
  };

  const toggleUser = (user: UserPublic) => {
    if (selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Введите название');
      return;
    }
    if (chatType === 'group' && selectedUsers.length === 0) {
      toast.error('Выберите хотя бы одного участника группы');
      return;
    }

    setLoading(true);
    try {
      const res = await chatsApi.create({
        type: chatType,
        title: title.trim(),
        description: description.trim() || undefined,
        member_ids: selectedUsers.map((u) => u.id),
      });
      toast.success(chatType === 'group' ? 'Группа создана!' : 'Канал создан!');
      onChatCreated(res.data.id);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[#17212b] p-6 shadow-2xl border border-gray-800">
        {/* Заголовок */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Создать сообщество</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Выбор типа: Группа / Канал */}
        <div className="my-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setChatType('group')}
            className={`flex items-center justify-center space-x-2 rounded-xl py-2.5 font-medium transition ${
              chatType === 'group'
                ? 'bg-[#2AABEE] text-white shadow'
                : 'bg-[#242f3d] text-gray-400 hover:text-white'
            }`}
          >
            <Users size={18} />
            <span>Группа</span>
          </button>

          <button
            type="button"
            onClick={() => setChatType('channel')}
            className={`flex items-center justify-center space-x-2 rounded-xl py-2.5 font-medium transition ${
              chatType === 'channel'
                ? 'bg-[#2AABEE] text-white shadow'
                : 'bg-[#242f3d] text-gray-400 hover:text-white'
            }`}
          >
            <Megaphone size={18} />
            <span>Канал</span>
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              {chatType === 'group' ? 'Название группы' : 'Название канала'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Разработчики или Новости проекта"
              className="w-full rounded-xl bg-[#242f3d] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2AABEE]"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              Описание (необязательно)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чем этот чат..."
              className="w-full rounded-xl bg-[#242f3d] px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2AABEE]"
            />
          </div>

          {/* Добавление участников */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              Пригласить участников ({selectedUsers.length})
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Поиск по имени или @username..."
                className="w-full rounded-xl bg-[#242f3d] py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2AABEE]"
              />
            </div>

            {/* Выбранные чипсы */}
            {selectedUsers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    onClick={() => toggleUser(u)}
                    className="flex cursor-pointer items-center space-x-1 rounded-full bg-[#2b5278] px-2.5 py-1 text-xs text-white hover:bg-red-500/80 transition"
                  >
                    <span>{u.display_name}</span>
                    <X size={12} />
                  </span>
                ))}
              </div>
            )}

            {/* Выпадающий список поиска */}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-36 overflow-y-auto rounded-xl bg-[#242f3d] p-1.5 space-y-1 border border-gray-700">
                {searchResults.map((u) => {
                  const isSelected = selectedUsers.some((sel) => sel.id === u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUser(u)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                        isSelected ? 'bg-[#2b5278] text-white' : 'hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 font-bold text-white text-[11px]">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.display_name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            u.display_name.charAt(0).toUpperCase()
                          )}
                          {u.is_online && (
                            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-[#242f3d]" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{u.display_name}</p>
                          <p className="text-[11px] text-gray-400">
                            {u.is_online ? (
                              <span className="text-emerald-400 font-medium">в сети</span>
                            ) : (
                              `@${u.username || 'user'}`
                            )}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check size={16} className="text-[#2AABEE]" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 rounded-xl bg-gray-700 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-600 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-2/3 rounded-xl bg-[#2AABEE] py-2.5 text-sm font-semibold text-white hover:bg-[#229ed9] transition disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
