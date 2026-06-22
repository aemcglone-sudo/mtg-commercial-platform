'use client';

import { useState, useEffect } from 'react';

interface ChatPreview {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatHistorySidebarProps {
  currentChatId?: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export default function ChatHistorySidebar({
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: ChatHistorySidebarProps) {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadChats();
  }, []);

  async function loadChats() {
    try {
      const res = await fetch('/api/khoa-chats');
      if (res.ok) {
        const data = await res.json();
        setChats(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(chatId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;

    await fetch(`/api/khoa-chats/${chatId}`, { method: 'DELETE' });
    setChats(chats.filter(c => c.id !== chatId));
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`relative h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-300 ${
          isCollapsed || (chats.length === 0 && !loading) ? 'w-12' : 'w-64'
        }`}
      >
        {/* Header with collapse button */}
        {!(chats.length === 0 && !loading) && (
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            {!isCollapsed && (
              <h2 className="text-sm font-semibold text-zinc-300">Chat History</h2>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? '→' : '←'}
            </button>
          </div>
        )}

        {/* New Chat Button */}
        {!isCollapsed && chats.length > 0 && (
          <div className="p-3 border-b border-zinc-800">
            <button
              type="button"
              onClick={() => {
                onNewChat();
                setIsOpen(false);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors text-xs"
            >
              + New Chat
            </button>
          </div>
        )}

        {/* Chat list */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-zinc-500 text-sm">Loading...</div>
            ) : chats.length === 0 ? (
              <div className="p-4 text-center text-zinc-600 text-sm">No chats yet</div>
            ) : (
              <div className="space-y-1 p-2">
                {chats.map((chat) => (
                  <div key={chat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectChat(chat.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm truncate ${
                        currentChatId === chat.id
                          ? 'bg-amber-900/30 text-amber-300 border border-amber-800'
                          : 'text-zinc-400 hover:bg-zinc-900'
                      }`}
                      title={chat.title}
                    >
                      {chat.title}
                    </button>
                    <div className="px-3 text-xs text-zinc-600">{formatDate(chat.updatedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsed state - show chat count */}
        {isCollapsed && (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
            {chats.length}
          </div>
        )}
      </div>
    </>
  );
}
