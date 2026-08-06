'use client';

import { useEffect, useState, useRef }  from 'react';
import { useNotificationStore }         from '@/store/notificationStore';
import { usePublicAuthStore }           from '@/store/publicAuthStore';
import { BellIcon, CloseIcon }          from '@/components/icons';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_COLOR = {
  booking_new:       'bg-amber-400',
  booking_accepted:  'bg-emerald-400',
  booking_completed: 'bg-green-500',
  booking_cancelled: 'bg-red-400',
  review_received:   'bg-yellow-400',
  worker_verified:   'bg-blue-500',
  payment_received:  'bg-emerald-600',
  welcome:           'bg-blue-400',
  category_approved: 'bg-emerald-500',
  system:            'bg-gray-400',
};

function NotificationItem({ n, onRead, onClose }) {
  function handleClick() {
    if (!n.isRead) onRead(n.id);
    if (n.link) {
      window.location.href = n.link;
      onClose();
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5
                  border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50
                  ${!n.isRead ? 'bg-blue-50/60' : 'bg-white'}`}
    >
      {/* Type color dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 mt-1.5
                    ${TYPE_COLOR[n.type] ?? 'bg-gray-400'}`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-snug
                         ${!n.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
            {n.title}
          </p>
          {!n.isRead && (
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
          )}
        </div>
        <p className="text-gray-500 text-xs mt-0.5 leading-relaxed line-clamp-2">
          {n.body}
        </p>
        <p className="text-gray-300 text-[10px] mt-1">{timeAgo(n.createdAt)}</p>
      </div>
    </button>
  );
}

export default function NotificationBell() {
  const { user }   = usePublicAuthStore();
  const {
    notifications, unreadCount,
    subscribe, unsubscribe,
    markRead, markAllRead,
  }                = useNotificationStore();

  const [open,    setOpen]    = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const buttonRef  = useRef(null);
  const panelRef   = useRef(null);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auth subscription
  useEffect(() => {
    if (user?.uid) {
      subscribe(user.uid);
    } else {
      unsubscribe();
    }
    return () => unsubscribe();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (
        panelRef.current  && !panelRef.current.contains(e.target)  &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Prevent scroll behind on mobile
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, isMobile]);

  if (!user) return null;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="relative p-2.5 rounded-xl text-gray-500 hover:text-gray-700
                   hover:bg-gray-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1
                       bg-red-500 text-white text-[10px] font-bold rounded-full
                       flex items-center justify-center leading-none"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: dim backdrop behind the panel */}
          {isMobile && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
          )}

          {/*
            POSITIONING FIX:
            Mobile  → fixed, centered horizontally with 12px side margins,
                       sits just below the top nav bar (top: 68px).
                       This guarantees it is always fully on-screen.
            Desktop → absolute, right-aligned to the bell button.
                       Standard dropdown behavior.
          */}
          <div
            ref={panelRef}
            className={
              isMobile
                ? `fixed z-50 bg-white border border-gray-100 rounded-2xl shadow-2xl
                   flex flex-col overflow-hidden`
                : `absolute right-0 top-full mt-2 z-50 bg-white border border-gray-100
                   rounded-2xl shadow-2xl flex flex-col overflow-hidden w-80`
            }
            style={
              isMobile
                ? {
                    top:       68,
                    left:      12,
                    right:     12,
                    maxHeight: 'calc(100vh - 88px)',
                  }
                : {
                    width:     320,
                    maxHeight: 480,
                  }
            }
          >

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5
                            border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold
                                   bg-red-100 text-red-600">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead(user.uid)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800
                               transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                {isMobile && (
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100
                               transition-colors ml-1"
                    aria-label="Close"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <BellIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    onRead={markRead}
                    onClose={() => setOpen(false)}
                  />
                ))
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}