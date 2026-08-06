'use client';

import { useEffect, useState }   from 'react';
import Link                      from 'next/link';
import { usePublicAuthStore }    from '@/store/publicAuthStore';
import { useChatStore }          from '@/store/chatStore';
import ChatModal                 from '@/components/public/ChatModal';
import LoadingSpinner            from '@/components/shared/LoadingSpinner';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_LABELS = {
  active:          { label: 'Active',           cls: 'bg-blue-100   text-blue-700'   },
  price_proposed:  { label: 'Price Proposed',   cls: 'bg-amber-100  text-amber-700'  },
  price_confirmed: { label: 'Price Confirmed',  cls: 'bg-green-100  text-green-700'  },
  booked:          { label: 'Booked',           cls: 'bg-purple-100 text-purple-700' },
  closed:          { label: 'Closed',           cls: 'bg-gray-100   text-gray-500'   },
};

// ── Chat icon SVG (self-contained, no dependency on icons/index) ──────────────
function ChatIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847
           2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354
           0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126
           2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976
           1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637
           c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3
           c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226
           c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21
           l4.155-4.155" />
    </svg>
  );
}

export default function CustomerChatsPage() {
  const { user }   = usePublicAuthStore();
  const {
    chats,
    chatsLoading,
    subscribeChats,
    unsubscribeChats,
  }                = useChatStore();

  const [selectedChat, setSelectedChat] = useState(null);

  useEffect(() => {
    if (user?.uid) subscribeChats(user.uid, 'customer');
    return () => unsubscribeChats();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div>
        <Link
          href="/customer-dashboard"
          className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block
                     transition-colors"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">My Chats</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {chats.length} conversation{chats.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Loading */}
      {chatsLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading chats…" />
        </div>
      )}

      {/* Empty state */}
      {!chatsLoading && chats.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm
                        p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center
                          justify-center mx-auto">
            {/* Complete inline SVG — no truncation */}
            <ChatIcon className="w-8 h-8 text-gray-300" />
          </div>

          <div>
            <p className="font-semibold text-gray-500">No chats yet</p>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">
              Start a conversation by clicking "Chat" on a worker's profile.
              Discuss the job and agree on a price before booking.
            </p>
          </div>

          <Link
            href="/services"
            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Browse Workers
          </Link>
        </div>
      )}

      {/* Chat list */}
      {!chatsLoading && chats.length > 0 && (
        <div className="space-y-3">
          {chats.map((chat) => {
            const lastReadTs = chat.lastReadAt?.[user?.uid];
            const lastMsgTs  = chat.lastMessageAt;
            const isUnread   =
              lastReadTs && lastMsgTs
                ? new Date(lastMsgTs) > new Date(lastReadTs)
                : !!lastMsgTs;

            const statusInfo =
              STATUS_LABELS[chat.status] ?? STATUS_LABELS.active;

            // Build peer (worker) object for ChatModal
            const peerForModal = {
              uid:             chat.workerId,
              id:              chat.workerId,
              name:            chat.workerName,
              categoryName:    chat.workerCategoryName,
              profileImageUrl: chat.workerProfileImageUrl,
            };

            return (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(peerForModal)}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm
                           p-4 flex items-center gap-4 text-left hover:shadow-md
                           hover:border-blue-200 transition-all duration-150"
              >
                {/* Worker avatar */}
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100
                                shrink-0">
                  {chat.workerProfileImageUrl ? (
                    <img
                      src={chat.workerProfileImageUrl}
                      alt={chat.workerName}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center
                                    bg-blue-50 text-blue-600 font-bold text-lg">
                      {(chat.workerName || 'W')[0].toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p
                      className={`font-semibold truncate text-sm
                                  ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}
                    >
                      {chat.workerName}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                                  shrink-0 ${statusInfo.cls}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <p className="text-gray-400 text-xs">{chat.workerCategoryName}</p>

                  {chat.lastMessage && (
                    <p
                      className={`text-sm truncate mt-0.5
                                  ${isUnread
                                    ? 'text-gray-800 font-medium'
                                    : 'text-gray-400'}`}
                    >
                      {chat.lastMessage}
                    </p>
                  )}

                  {/* Confirmed price when agreed */}
                  {chat.confirmedPrice != null && chat.confirmedPrice > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-0.5">
                      Agreed: ₹{chat.confirmedPrice.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>

                {/* Timestamp + unread dot */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="text-gray-300 text-xs whitespace-nowrap">
                    {timeAgo(chat.lastMessageAt)}
                  </p>
                  {isUnread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Chat modal */}
      {selectedChat && (
        <ChatModal
          peer={selectedChat}
          onClose={() => setSelectedChat(null)}
        />
      )}
    </div>
  );
}