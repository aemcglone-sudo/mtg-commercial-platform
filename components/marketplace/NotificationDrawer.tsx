'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  cta_url: string;
  read: boolean;
  created_at: string;
}

interface Props {
  onRead: () => void;
  onReadAll: () => void;
  onClose: () => void;
}

export default function NotificationDrawer({ onRead, onReadAll, onClose }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/marketplace/notifications?page=1')
      .then(r => r.ok ? r.json() : null)
      .then((data: { notifications: Notification[] } | null) => {
        if (data) setNotifications(data.notifications);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/marketplace/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    onRead();
  }

  async function markAllRead() {
    await fetch('/api/marketplace/notifications/read-all', { method: 'PATCH' });
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    onReadAll();
  }

  function typeIcon(type: string) {
    if (type.startsWith('hold_confirmed')) return '✅';
    if (type.startsWith('hold_declined') || type.startsWith('hold_expired')) return '❌';
    if (type.startsWith('hold_completed')) return '🎉';
    if (type.startsWith('hold_cancelled')) return '↩️';
    if (type.startsWith('hold')) return '📋';
    if (type.startsWith('card_available')) return '🟢';
    if (type.startsWith('campaign')) return '📣';
    return '🔔';
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const unread = notifications.filter(n => !n.read);

  return (
    <div className="absolute right-0 top-10 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="font-semibold text-zinc-100 text-sm">Notifications</span>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Mark all read
            </button>
          )}
          <button type="button" onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">✕</button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800">
        {loading ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">No notifications yet</div>
        ) : (
          notifications.map(n => {
            const content = (
              <div
                className={`px-4 py-3 flex gap-3 hover:bg-zinc-800 transition-colors cursor-pointer ${!n.read ? 'bg-zinc-800/40' : ''}`}
                onClick={() => !n.read && markRead(n.id)}
              >
                <span className="text-lg shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium leading-tight ${n.read ? 'text-zinc-400' : 'text-zinc-100'}`}>{n.title}</p>
                    {!n.read && <span className="shrink-0 w-2 h-2 rounded-full bg-blue-400 mt-1" />}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{n.body}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );

            return n.cta_url ? (
              <Link key={n.id} href={n.cta_url} onClick={() => { markRead(n.id); onClose(); }}>
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })
        )}
      </div>
    </div>
  );
}
