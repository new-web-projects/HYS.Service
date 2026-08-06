'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore, getChatId }                  from '@/store/chatStore';
import { useBookingStore }                          from '@/store/bookingStore';
import { usePublicAuthStore }                        from '@/store/publicAuthStore';
import { validateChatMessage }                       from '@/lib/piiFilter';
import { useToast }                                  from '@/components/shared/Toast';
import { formatPrice }                               from '@/lib/pricing';
import BookingModal                                  from '@/components/public/BookingModal';
import {
  CloseIcon, SpinnerIcon, CheckIcon, WarningIcon,
}                                                    from '@/components/icons';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeStr(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, isSelf }) {
  const time = timeStr(msg.createdAt);

  if (msg.type === 'system' || msg.type === 'booking_created') {
    return (
      <div className="flex justify-center my-3">
        <span className="px-4 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-full
                         max-w-[85%] text-center leading-relaxed">
          {msg.text}
        </span>
      </div>
    );
  }

  if (msg.type === 'price_proposal') {
    return (
      <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1.5
                         ${isSelf
                           ? 'bg-blue-600 text-white rounded-br-sm'
                           : 'bg-white border-2 border-blue-200 rounded-bl-sm'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide
                         ${isSelf ? 'text-blue-200' : 'text-blue-500'}`}>
            Price Proposal
          </p>
          <p className={`text-2xl font-extrabold ${isSelf ? 'text-white' : 'text-blue-700'}`}>
            {formatPrice(msg.proposedPrice ?? 0)}
          </p>
          <p className={`text-xs ${isSelf ? 'text-blue-300' : 'text-gray-400'}`}>{msg.text}</p>
          <p className={`text-[10px] text-right ${isSelf ? 'text-blue-300' : 'text-gray-300'}`}>
            {time}
          </p>
        </div>
      </div>
    );
  }

  if (msg.type === 'price_accepted') {
    return (
      <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1
                         ${isSelf
                           ? 'bg-green-600 text-white rounded-br-sm'
                           : 'bg-green-50 border-2 border-green-300 rounded-bl-sm'}`}>
          <div className="flex items-center gap-1.5">
            <CheckIcon className={`w-4 h-4 ${isSelf ? 'text-green-200' : 'text-green-600'}`} />
            <p className={`text-xs font-semibold ${isSelf ? 'text-green-200' : 'text-green-600'}`}>
              Customer Agreed
            </p>
          </div>
          <p className={`text-2xl font-extrabold ${isSelf ? 'text-white' : 'text-green-700'}`}>
            {formatPrice(msg.proposedPrice ?? 0)}
          </p>
          <p className={`text-xs ${isSelf ? 'text-green-300' : 'text-gray-500'}`}>{msg.text}</p>
          <p className={`text-[10px] text-right ${isSelf ? 'text-green-300' : 'text-gray-300'}`}>
            {time}
          </p>
        </div>
      </div>
    );
  }

  if (msg.type === 'price_confirmed_worker') {
    return (
      <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1
                         ${isSelf
                           ? 'bg-blue-700 text-white rounded-br-sm'
                           : 'bg-blue-50 border-2 border-blue-400 rounded-bl-sm'}`}>
          <div className="flex items-center gap-1.5">
            <CheckIcon className={`w-4 h-4 ${isSelf ? 'text-blue-200' : 'text-blue-600'}`} />
            <CheckIcon className={`w-4 h-4 ${isSelf ? 'text-blue-200' : 'text-blue-600'}`} />
            <p className={`text-xs font-semibold ${isSelf ? 'text-blue-200' : 'text-blue-700'}`}>
              Worker Confirmed — Ready for Payment
            </p>
          </div>
          <p className={`text-2xl font-extrabold ${isSelf ? 'text-white' : 'text-blue-800'}`}>
            {formatPrice(msg.proposedPrice ?? 0)}
          </p>
          <p className={`text-[10px] text-right ${isSelf ? 'text-blue-300' : 'text-gray-300'}`}>
            {time}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5
                       ${isSelf
                         ? 'bg-blue-600 text-white rounded-br-sm'
                         : 'bg-white border border-gray-100 text-gray-900 shadow-sm rounded-bl-sm'}`}>
        <p className="text-sm leading-relaxed">{msg.text}</p>
        <p className={`text-[10px] mt-0.5 text-right
                       ${isSelf ? 'text-blue-300' : 'text-gray-300'}`}>
          {time}
        </p>
      </div>
    </div>
  );
}

// ── Worker warning modal ──────────────────────────────────────────────────────

function WorkerWarningModal({ price, onConfirm, onCancel, confirming }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center
                          justify-center shrink-0">
            <WarningIcon className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-bold text-gray-900">Confirm Final Price</h3>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 text-sm font-semibold mb-1">
            ⚠ Important — Please read before confirming
          </p>
          <p className="text-amber-700 text-sm leading-relaxed">
            Once the customer completes payment, <strong>this booking cannot be
            cancelled</strong>. Make sure you have discussed all work details,
            requirements, and pricing before confirming.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
          <span className="text-gray-600 text-sm font-medium">Final agreed price</span>
          <span className="text-xl font-bold text-gray-900">{formatPrice(price)}</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-semibold
                       rounded-xl hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold
                       rounded-xl transition-colors disabled:opacity-50
                       flex items-center justify-center gap-2"
          >
            {confirming ? (
              <><SpinnerIcon className="w-4 h-4" /> Confirming…</>
            ) : (
              <><CheckIcon className="w-4 h-4" /> Confirm Price</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ChatModal ─────────────────────────────────────────────────────────────

/**
 * Part 1 — Booking-first architecture
 *
 * FLOW:
 *   0. Customer clicks "Book Worker" on the worker's profile → fills booking
 *      details (service/date/address/description) → booking created
 *      immediately with status 'pending_chat', chat bootstrapped alongside it
 *   1. Worker accepts or rejects from their dashboard — this chat's composer
 *      stays locked (bookingAwaitingAcceptance) until they accept
 *   2. Once accepted, both discuss work + price in chat
 *   3. Worker proposes final price
 *   4. Customer accepts (customerConfirmed = true) → booking status
 *      'final_price_pending'
 *   5. Worker explicitly confirms (workerConfirmed = true) with warning →
 *      booking status 'ready_for_payment'
 *   6. readyForPayment = true → "Proceed to Payment" button shows
 *   7. Customer clicks Proceed → BookingModal opens with existingBookingId
 *      set, reusing the SAME booking (never creates a second one)
 *
 * @param {{ peer: object, onClose: () => void }} props
 */
export default function ChatModal({ peer, onClose }) {
  const { user }    = usePublicAuthStore();
  const {
    activeChatId, activeChat, messages, msgsLoading,
    openChat, closeChat, sendMessage, proposePrice,
    acceptPrice, confirmFinalPrice, setTyping,
  }                 = useChatStore();
  const toast       = useToast((s) => s.show);

  const [text,               setText]              = useState('');
  const [sending,            setSending]           = useState(false);
  const [piiWarning,         setPIIWarning]        = useState('');
  const [showPriceInput,     setShowPriceInput]    = useState(false);
  const [priceInput,         setPriceInput]        = useState('');
  const [showBooking,        setShowBooking]       = useState(false);
  const [showWorkerWarning,  setShowWorkerWarning] = useState(false);
  const [confirming,         setConfirming]        = useState(false);
  const [paidBooking,        setPaidBooking]       = useState(null);

  const msgsEndRef       = useRef(null);
  const textRef          = useRef(null);
  const typingTimeoutRef = useRef(null);

  const isWorker   = user?.role === 'worker';
  const isCustomer = user?.role === 'customer';
  const chatId     = user && peer ? getChatId(user.uid, peer.uid ?? peer.id) : null;

  const chatStatus        = activeChat?.status          ?? 'active';
  const confirmedPrice    = activeChat?.confirmedPrice  ?? null;
  const customerConfirmed = activeChat?.customerConfirmed ?? false;
  const workerConfirmed   = activeChat?.workerConfirmed   ?? false;
  const readyForPayment   = activeChat?.readyForPayment   ?? false;

  // Open chat session
  useEffect(() => {
    if (!user || !peer) return;
    openChat({
      selfUid:             user.uid,
      selfName:            user.name,
      selfRole:            user.role,
      peerUid:             peer.uid ?? peer.id,
      peerName:            peer.name,
      peerRole:            isWorker ? 'customer' : 'worker',
      peerCategoryName:    peer.categoryName    ?? '',
      peerProfileImageUrl: peer.profileImageUrl ?? '',
    });
    return () => closeChat();
  }, [user?.uid, peer?.uid ?? peer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 300);
  }, []);

  const self   = user ? { uid: user.uid, name: user.name, role: user.role } : null;
  const peerObj = peer
    ? {
        uid:             peer.uid ?? peer.id,
        name:            peer.name,
        categoryName:    peer.categoryName    ?? '',
        profileImageUrl: peer.profileImageUrl ?? '',
      }
    : null;

  // Typing indicator — peer is typing if their typingAt timestamp is <5s old
  const peerTypingTs  = activeChat?.typingAt?.[peerObj?.uid];
  const isPeerTyping  = peerTypingTs
    ? (Date.now() - new Date(peerTypingTs?.toDate?.() ?? peerTypingTs).getTime()) < 5000
    : false;

  // Seen status — find index of last message seen by peer
  // A message is "seen" if peer's lastReadAt timestamp is after the message's createdAt
  const peerLastReadTs   = activeChat?.lastReadAt?.[peerObj?.uid];
  const lastSeenByPeerIdx = peerLastReadTs
    ? (() => {
        let idx = -1;
        messages.forEach((m, i) => {
          if (m.senderId === user?.uid && m.createdAt &&
              new Date(peerLastReadTs) >= new Date(m.createdAt)) {
            idx = i;
          }
        });
        return idx;
      })()
    : -1;

  // ── Send message ──────────────────────────────────────────────────────────

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending || !chatId || !self || !peerObj) return;

    const { safe, warning } = validateChatMessage(trimmed);
    if (!safe) {
      setPIIWarning(warning ?? 'Personal information is not allowed before booking.');
      setTimeout(() => setPIIWarning(''), 6000);
      return;
    }

    setPIIWarning('');
    setSending(true);
    // Clear typing state immediately on send
    clearTimeout(typingTimeoutRef.current);
    if (chatId) setTyping(chatId, user.uid, false);
    try {
      await sendMessage({ chatId, self, peer: peerObj, text: trimmed, type: 'text' });
      setText('');
    } catch (err) {
      toast(err.message ?? 'Message failed to send.', 'error');
    } finally {
      setSending(false);
    }
  }

  // ── Worker: propose price ─────────────────────────────────────────────────

  async function handleProposePrice() {
    const price = parseFloat(priceInput);
    if (!price || price <= 0 || !chatId || !self || !peerObj) return;

    setSending(true);
    try {
      await proposePrice({ chatId, self, peer: peerObj, price });
      setShowPriceInput(false);
      setPriceInput('');
    } catch (err) {
      toast(err.message ?? 'Failed to propose price.', 'error');
    } finally {
      setSending(false);
    }
  }

  // ── Customer: accept proposed price ──────────────────────────────────────

  async function handleAcceptPrice(price) {
    if (!chatId || !self || !peerObj) return;
    setSending(true);
    try {
      await acceptPrice({ chatId, self, peer: peerObj, price });
    } catch (err) {
      toast(err.message ?? 'Failed to accept price.', 'error');
    } finally {
      setSending(false);
    }
  }

  // ── Worker: confirm final price (shows warning first) ─────────────────────

  async function handleWorkerConfirm() {
    if (!chatId || !self) return;
    setConfirming(true);
    try {
      await confirmFinalPrice({ chatId, self });
      setShowWorkerWarning(false);
    } catch (err) {
      toast(err.message ?? 'Failed to confirm price.', 'error');
    } finally {
      setConfirming(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Latest pending price proposal
  const latestProposal = [...messages]
    .reverse()
    .find((m) => m.type === 'price_proposal');

  // Worker object for BookingModal
  const workerForBooking = peer
    ? {
        ...peer,
        id:            peer.uid ?? peer.id,
        startingPrice: confirmedPrice ?? peer.startingPrice ?? peer.pricePerHour ?? 0,
      }
    : null;

  if (!user || !peer) return null;

  const isBooked = chatStatus === 'booked';

  // Part 1 — booking-first architecture: gate the composer until the
  // worker has accepted this chat's booking request. Strict === false check
  // (not just falsy) so any chat that existed before this field was
  // introduced — where it's simply `undefined` — is never gated; only
  // chats explicitly created by the new flow are affected.
  const bookingId               = activeChat?.bookingId       ?? null;
  const bookingWasRejected        = activeChat?.bookingRejected === true;
  const bookingAwaitingAcceptance = activeChat?.bookingAccepted === false && !bookingWasRejected;

  // Part 4/4.1: once the chat is marked booked (i.e. markBookingPaid has
  // actually succeeded — see bookingStore.js), fetch the booking once for
  // its Payment ID / Transaction ID / paid-at time, shown in the
  // post-payment card below instead of the now-hidden "Proceed to
  // Payment" block.
  useEffect(() => {
    if (isBooked && bookingId) {
      useBookingStore.getState().getBooking(bookingId).then(setPaidBooking);
    } else {
      setPaidBooking(null);
    }
  }, [isBooked, bookingId]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                   flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl
                        flex flex-col h-[90vh] sm:h-[600px] overflow-hidden">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100
                          bg-white shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {peer.profileImageUrl ? (
                <img src={peer.profileImageUrl} alt={peer.name}
                     className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center
                                bg-blue-50 text-blue-600 font-bold text-sm">
                  {(peer.name || 'P')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{peer.name}</p>
              {isBooked && paidBooking ? (
                <a
                  href={`tel:${isCustomer ? paidBooking.workerPhone : paidBooking.customerPhone}`}
                  className="text-blue-600 text-xs font-medium hover:underline"
                >
                  {isCustomer ? paidBooking.workerPhone : paidBooking.customerPhone}
                </a>
              ) : (
                <p className="text-gray-400 text-xs">{peer.categoryName}</p>
              )}
            </div>

            {/* Status badges */}
            {readyForPayment && (
              <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700
                               text-xs font-semibold shrink-0 border border-green-200">
                ✓ Ready to Pay
              </span>
            )}
            {!readyForPayment && customerConfirmed && !workerConfirmed && isWorker && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700
                               text-xs font-semibold shrink-0 border border-amber-200">
                Awaiting Your Confirmation
              </span>
            )}
            {!readyForPayment && customerConfirmed && !workerConfirmed && isCustomer && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700
                               text-xs font-semibold shrink-0 border border-amber-200">
                Awaiting Worker
              </span>
            )}
            {isBooked && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700
                               text-xs font-semibold shrink-0">
                Booked
              </span>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* ── PII warning ──────────────────────────────────────────── */}
          {piiWarning && (
            <div className="px-4 py-2.5 bg-red-50 border-b border-red-100
                            flex items-start gap-2 shrink-0">
              <WarningIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-xs leading-relaxed">{piiWarning}</p>
            </div>
          )}

          {/* ── Privacy notice ───────────────────────────────────────── */}
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
            <p className="text-amber-700 text-[11px] leading-relaxed">
              Personal contact info (phone, email, documents) is blocked until
              booking is confirmed and payment is made.
            </p>
          </div>

          {/* ── Messages ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
            {msgsLoading ? (
              <div className="flex justify-center pt-10">
                <SpinnerIcon className="w-6 h-6 text-gray-300" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center
                                justify-center mb-3">
                  <svg className="w-8 h-8 text-blue-300" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-500">Start the conversation</p>
                <p className="text-gray-400 text-sm mt-1 max-w-xs leading-relaxed">
                  {isCustomer
                    ? 'Describe your job requirements and discuss the price before booking.'
                    : 'Understand the job details, then propose your final price.'}
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={msg.id}>
                  <Bubble msg={msg} isSelf={msg.senderId === user.uid} />
                  {idx === lastSeenByPeerIdx && msg.senderId === user.uid && (
                    <div className="flex justify-end mb-1">
                      <span className="text-[10px] text-gray-400 pr-1 flex items-center gap-1">
                        <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24"
                             stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Seen
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* ── STEP 1: Customer accepts proposed price ────────────── */}
            {isCustomer &&
              latestProposal &&
              chatStatus === 'price_proposed' &&
              !customerConfirmed && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4
                                space-y-3 mt-3">
                  <div>
                    <p className="font-bold text-blue-900 text-sm">
                      {peer.name} proposed a price
                    </p>
                    <p className="text-3xl font-extrabold text-blue-700">
                      {formatPrice(latestProposal.proposedPrice ?? 0)}
                    </p>
                    <p className="text-blue-600 text-xs mt-0.5">
                      If you agree, click Accept. The worker will then give their final confirmation.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAcceptPrice(latestProposal.proposedPrice ?? 0)}
                    disabled={sending}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white
                               font-bold rounded-xl transition-colors disabled:opacity-50
                               flex items-center justify-center gap-2"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Accept Price — {formatPrice(latestProposal.proposedPrice ?? 0)}
                  </button>
                </div>
              )}

            {/* ── STEP 2: Customer waiting for worker to confirm ─────── */}
            {isCustomer &&
              customerConfirmed &&
              !workerConfirmed && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4
                                space-y-2 mt-3">
                  <div className="flex items-center gap-2">
                    <SpinnerIcon className="w-4 h-4 text-amber-500" />
                    <p className="font-semibold text-amber-800 text-sm">
                      Waiting for {peer.name} to give final confirmation
                    </p>
                  </div>
                  <p className="text-amber-700 text-xs leading-relaxed">
                    You've agreed to{' '}
                    <strong>{formatPrice(confirmedPrice ?? 0)}</strong>.
                    The worker needs to confirm before payment can proceed.
                  </p>
                </div>
              )}

            {/* ── STEP 3: Worker sees "confirm final price" prompt ───── */}
            {isWorker &&
              customerConfirmed &&
              !workerConfirmed && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4
                                space-y-3 mt-3">
                  <div>
                    <p className="font-bold text-blue-900 text-sm">
                      Customer agreed — Confirm your final price
                    </p>
                    <p className="text-3xl font-extrabold text-blue-700">
                      {formatPrice(confirmedPrice ?? 0)}
                    </p>
                    <p className="text-blue-600 text-xs mt-0.5">
                      If you're satisfied with the terms, confirm the price to allow the
                      customer to proceed to payment.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowWorkerWarning(true)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white
                               font-bold rounded-xl transition-colors flex items-center
                               justify-center gap-2"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Confirm Final Price
                  </button>
                </div>
              )}

            {/* ── STEP 4: Both confirmed — Proceed button (customer) ─── */}
            {isCustomer && readyForPayment && confirmedPrice && !isBooked && (
              <div className="bg-green-50 border border-green-300 rounded-2xl p-4
                              space-y-3 mt-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckIcon className="w-4 h-4 text-green-600" />
                    <CheckIcon className="w-4 h-4 text-green-600" />
                    <p className="font-bold text-green-900 text-sm">
                      Both parties confirmed!
                    </p>
                  </div>
                  <p className="text-3xl font-extrabold text-green-700">
                    {formatPrice(confirmedPrice)}
                  </p>
                  <p className="text-green-600 text-xs mt-0.5">
                    You and {peer.name} have both agreed. Proceed to complete the booking.
                  </p>
                </div>
                {/* PART 4: Cannot-cancel warning — prominent red banner */}
                <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50
                                border-2 border-red-200 rounded-2xl">
                  <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
                         c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5
                         -3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-red-700 text-sm leading-relaxed">
                    <strong>After completing the booking payment, this booking
                    cannot be cancelled.</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowBooking(true)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white
                             font-bold rounded-xl transition-colors flex items-center
                             justify-center gap-2"
                >
                  Proceed to Payment — {formatPrice(confirmedPrice)}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            )}

            {/* ── Part 4.1 Issue 2: post-payment confirmation (customer) ───
                 Replaces the block above once isBooked is true, so
                 "Proceed to Payment" can never be shown — or clicked —
                 again for this booking. */}
            {isCustomer && isBooked && (
              <div className="bg-green-50 border border-green-300 rounded-2xl p-4
                              space-y-2 mt-3">
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <p className="font-bold text-green-900 text-sm">
                    ✅ Payment Successful
                  </p>
                </div>
                <p className="text-2xl font-extrabold text-green-700">
                  {formatPrice(confirmedPrice)}
                </p>
                <div className="text-xs text-green-700 space-y-1 pt-2
                                border-t border-green-200">
                  {paidBooking?.paymentRef && (
                    <p>Payment ID: <span className="font-mono">{paidBooking.paymentRef}</span></p>
                  )}
                  {paidBooking?.transactionId && (
                    <p>Transaction ID: <span className="font-mono">{paidBooking.transactionId}</span></p>
                  )}
                  {paidBooking?.paidAt && (
                    <p>
                      Paid: {new Date(paidBooking.paidAt).toLocaleString('en-IN', {
                        dateStyle: 'medium', timeStyle: 'short',
                      })}
                    </p>
                  )}
                  <p>Booking Status: Paid</p>
                </div>
              </div>
            )}

            {/* Worker: both confirmed status ────────────────────────── */}
            {isWorker && readyForPayment && confirmedPrice && !isBooked && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <p className="font-bold text-green-900 text-sm">Price Confirmed</p>
                </div>
                <p className="text-green-700 text-xs">
                  {formatPrice(confirmedPrice)} — Customer can now proceed to payment.
                  Once payment is completed, the booking cannot be cancelled.
                </p>
              </div>
            )}

            {/* Typing indicator */}
            {isPeerTyping && (
              <div className="flex justify-start mb-2">
                <div className="flex items-center gap-2 bg-white border border-gray-100
                                shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                  <span className="text-xs text-gray-400">{peer.name} is typing</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            <div ref={msgsEndRef} />
          </div>

          {/* ── Price proposal input (worker) ────────────────────────── */}
          {isWorker && showPriceInput && (
            <div className="px-4 py-3 bg-blue-50 border-t border-blue-100
                            flex items-center gap-2 shrink-0">
              <div className="flex-1 flex items-center gap-2 bg-white border
                              border-blue-200 rounded-xl px-3 py-2">
                <span className="text-gray-500 font-semibold">₹</span>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Enter your price"
                  className="flex-1 text-sm outline-none text-gray-900"
                  autoFocus
                  min="1"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleProposePrice(); }}
                />
              </div>
              <button
                onClick={handleProposePrice}
                disabled={!priceInput || sending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                           font-semibold text-sm rounded-xl transition-colors
                           disabled:opacity-50"
              >
                {sending ? '…' : 'Propose'}
              </button>
              <button
                onClick={() => { setShowPriceInput(false); setPriceInput(''); }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Input area ───────────────────────────────────────────── */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0 space-y-2">

            {/* Part 1: awaiting-acceptance / declined banners */}
            {bookingAwaitingAcceptance && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl
                              bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                <SpinnerIcon className="w-3.5 h-3.5 shrink-0" />
                {isCustomer
                  ? `Waiting for ${peer.name} to accept your booking request.`
                  : 'Accept or decline this booking request to start chatting.'}
              </div>
            )}
            {bookingWasRejected && (
              <div className="px-3 py-2.5 rounded-xl bg-gray-100 border border-gray-200
                              text-gray-500 text-xs">
                This booking request was declined.
              </div>
            )}

            {/* Worker: propose price button */}
            {isWorker &&
              !showPriceInput &&
              !readyForPayment &&
              !isBooked &&
              !bookingAwaitingAcceptance &&
              !bookingWasRejected && (
                <button
                  onClick={() => setShowPriceInput(true)}
                  className="w-full py-2 border-2 border-blue-200 text-blue-600 text-sm
                             font-semibold rounded-xl hover:bg-blue-50 transition-colors
                             flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Propose a Price
                </button>
              )}

            {/* Text input row */}
            <div className="flex items-end gap-2">
              <textarea
                ref={textRef}
                value={text}
                onChange={(e) => {
                setText(e.target.value);
                setPIIWarning('');
                // Typing indicator — debounce clear to 3s after last keystroke
                if (chatId && user?.uid) {
                  setTyping(chatId, user.uid, true);
                  clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => {
                    setTyping(chatId, user.uid, false);
                  }, 3000);
                }
              }}
                onKeyDown={handleKeyDown}
                placeholder={
                  bookingWasRejected
                    ? 'This booking request was declined.'
                    : bookingAwaitingAcceptance
                    ? 'Waiting for the worker to accept your booking request…'
                    : readyForPayment && isCustomer && !isBooked
                    ? 'Proceed to payment above, or continue chatting…'
                    : 'Type a message…'
                }
                className="flex-1 resize-none rounded-xl border border-gray-200
                           px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           max-h-24"
                rows={1}
                disabled={bookingAwaitingAcceptance || bookingWasRejected}
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending || bookingAwaitingAcceptance || bookingWasRejected}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl
                           transition-colors disabled:opacity-40 shrink-0"
                aria-label="Send"
              >
                {sending ? (
                  <SpinnerIcon className="w-5 h-5" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Worker warning modal — before confirming final price */}
      {showWorkerWarning && confirmedPrice && (
        <WorkerWarningModal
          price={confirmedPrice}
          onConfirm={handleWorkerConfirm}
          onCancel={() => setShowWorkerWarning(false)}
          confirming={confirming}
        />
      )}

      {/* Booking modal — opens only after both confirmed, customer clicks Proceed */}
      {showBooking && workerForBooking && confirmedPrice && (
        <BookingModal
          worker={workerForBooking}
          confirmedPrice={confirmedPrice}
          existingBookingId={bookingId}
          onClose={() => {
            setShowBooking(false);
            onClose();
          }}
        />
      )}
    </>
  );
}