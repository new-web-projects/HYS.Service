import { create } from 'zustand';

/**
 * Chat ID is deterministic: sort both UIDs alphabetically and join with '_'.
 * This means the same two users always share one conversation.
 * @param {string} uid1
 * @param {string} uid2
 * @returns {string}
 */
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

const ts = (v) => v?.toDate?.()?.toISOString?.() ?? v ?? null;

function normalizeMsg(docSnap) {
  const d = docSnap.data();
  return {
    id:            docSnap.id,
    senderId:      d.senderId      ?? '',
    senderName:    d.senderName    ?? '',
    senderRole:    d.senderRole    ?? 'customer',
    text:          d.text          ?? '',
    type:          d.type          ?? 'text',
    // type options: 'text' | 'price_proposal' | 'price_accepted' | 'price_confirmed_worker' | 'system' | 'booking_created'
    proposedPrice: d.proposedPrice ?? null,
    isRead:        d.isRead        ?? false,
    createdAt:     ts(d.createdAt),
  };
}

function normalizeChat(docSnap) {
  const d = docSnap.data();
  return {
    id:                    docSnap.id,
    customerId:            d.customerId            ?? '',
    workerId:              d.workerId              ?? '',
    customerName:          d.customerName          ?? '',
    workerName:            d.workerName            ?? '',
    workerCategoryName:    d.workerCategoryName    ?? '',
    workerProfileImageUrl: d.workerProfileImageUrl ?? '',
    status:                d.status                ?? 'active',
    // status: 'active' | 'price_proposed' | 'price_confirmed' | 'booked' | 'closed'
    confirmedPrice:        d.confirmedPrice        ?? null,
    workerConfirmed:       d.workerConfirmed       ?? false,
    customerConfirmed:     d.customerConfirmed     ?? false,
    readyForPayment:       d.readyForPayment       ?? false,
    lastMessage:           d.lastMessage           ?? '',
    lastMessageAt:         ts(d.lastMessageAt),
    lastReadAt:            d.lastReadAt            ?? {},
    typingAt:              d.typingAt              ?? {},   // { [uid]: ISO string }
    bookingId:             d.bookingId             ?? null,
    // Part 1: intentionally NOT defaulted with ?? — ChatModal distinguishes
    // "explicitly false" (brand-new chat, composer gated until accepted)
    // from "undefined" (chat existed before this field existed, never
    // gated) by strict === comparison. Defaulting here would collapse that
    // distinction and either wrongly lock every legacy chat or never lock
    // any new one, depending on which default was chosen.
    bookingAccepted:       d.bookingAccepted,
    bookingRejected:       d.bookingRejected,
    createdAt:             ts(d.createdAt),
    updatedAt:             ts(d.updatedAt),
  };
}

export const useChatStore = create((set, get) => ({
  // Currently open chat
  activeChatId: null,
  activeChat:   null,
  messages:     [],
  msgsLoading:  false,

  // Chat list (sidebar / pages)
  chats:        [],
  chatsLoading: false,
  totalUnread:  0,

  _unsubMsgs:  null,
  _unsubChat:  null,
  _unsubChats: null,

  // ── Open a chat ───────────────────────────────────────────────────────────

  /**
   * Opens a real-time chat session between self and peer.
   * Creates the Firestore chat doc lazily on first message send.
   *
   * @param {{ selfUid, selfName, selfRole, peerUid, peerName, peerRole,
   *            peerCategoryName, peerProfileImageUrl }} params
   */
  async openChat({
    selfUid, selfName, selfRole,
    peerUid, peerName, peerRole,
    peerCategoryName    = '',
    peerProfileImageUrl = '',
  }) {
    const chatId = getChatId(selfUid, peerUid);

    // Clean up old listeners
    get()._unsubMsgs?.();
    get()._unsubChat?.();

    set({
      activeChatId: chatId,
      activeChat:   null,
      messages:     [],
      msgsLoading:  true,
    });

    const { db } = await import('@/lib/firebase/config');
    const {
      doc, collection, query, orderBy, onSnapshot, limit,
    } = await import('firebase/firestore');

    // Subscribe to the chat document (status, confirmedPrice, etc.)
    const chatUnsub = onSnapshot(
      doc(db, 'chats', chatId),
      (snap) => {
        if (snap.exists()) set({ activeChat: normalizeChat(snap) });
      },
      (err) => console.warn('[chatStore] chat doc sub:', err.message),
    );

    // Subscribe to messages
    const msgsUnsub = onSnapshot(
      query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200),
      ),
      (snap) => {
        set({
          messages:    snap.docs.map(normalizeMsg),
          msgsLoading: false,
        });
        // Mark as read (non-blocking)
        get().markRead(chatId, selfUid);
      },
      (err) => {
        console.error('[chatStore] messages sub:', err.message);
        set({ msgsLoading: false });
      },
    );

    set({
      _unsubMsgs:  () => { msgsUnsub(); chatUnsub(); },
      _unsubChat:  null, // merged into _unsubMsgs above
    });
  },

  closeChat() {
    get()._unsubMsgs?.();
    get()._unsubChat?.();
    set({
      activeChatId: null,
      activeChat:   null,
      messages:     [],
      msgsLoading:  false,
      _unsubMsgs:   null,
      _unsubChat:   null,
    });
  },

  // ── Send message ──────────────────────────────────────────────────────────

  async sendMessage({
    chatId,
    self,  // { uid, name, role }
    peer,  // { uid, name, categoryName?, profileImageUrl? }
    text,
    type          = 'text',
    proposedPrice = null,
  }) {
    const { db } = await import('@/lib/firebase/config');
    const {
      doc, getDoc, setDoc, addDoc, writeBatch, updateDoc,
      collection, serverTimestamp, Timestamp,
    } = await import('firebase/firestore');

    const now     = Timestamp.now();
    const chatRef = doc(db, 'chats', chatId);
    const snap    = await getDoc(chatRef);
    const isNew   = !snap.exists();
    const isCustomer = self.role === 'customer';

    // Build the message doc ref upfront
    const msgRef  = doc(collection(db, 'chats', chatId, 'messages'));

    if (isNew) {
      // Use a batch to create chat doc + first message atomically.
      // This prevents the race condition where the message write fires
      // before the chat doc is committed, causing permission errors.
      const batch = writeBatch(db);

      batch.set(chatRef, {
        customerId:            isCustomer ? self.uid : peer.uid,
        workerId:              isCustomer ? peer.uid : self.uid,
        customerName:          isCustomer ? self.name : peer.name,
        workerName:            isCustomer ? peer.name : self.name,
        workerCategoryName:    peer.categoryName    ?? '',
        workerProfileImageUrl: peer.profileImageUrl ?? '',
        status:                'active',
        confirmedPrice:        null,
        customerConfirmed:     false,
        workerConfirmed:       false,
        readyForPayment:       false,
        typingAt:              {},
        lastMessage:           text,
        lastMessageAt:         now,
        lastReadAt:            { [self.uid]: now },
        createdAt:             now,
        updatedAt:             now,
      });

      batch.set(msgRef, {
        senderId:      self.uid,
        senderName:    self.name,
        senderRole:    self.role,
        text,
        type,
        proposedPrice: proposedPrice ?? null,
        isRead:        false,
        createdAt:     now,
      });

      await batch.commit();

      // Chat request alert (non-blocking)
      try {
        const { createNotification } = await import('@/lib/notifications');
        const recipientId = isCustomer ? peer.uid : self.uid;
        await createNotification(
          recipientId,
          'chat_request',
          { senderName: self.name, categoryName: peer.categoryName ?? '' },
          chatId,
        );
      } catch (err) {
        console.warn('[chatStore] chat request notification:', err.message);
      }
    } else {
      // Chat already exists — write message + update chat doc in batch
      const batch = writeBatch(db);

      batch.update(chatRef, {
        lastMessage:                text,
        lastMessageAt:              now,
        updatedAt:                  now,
        [`lastReadAt.${self.uid}`]: now,
      });

      batch.set(msgRef, {
        senderId:      self.uid,
        senderName:    self.name,
        senderRole:    self.role,
        text,
        type,
        proposedPrice: proposedPrice ?? null,
        isRead:        false,
        createdAt:     now,
      });

      await batch.commit();
    }
  },

  // ── Worker: propose a price ───────────────────────────────────────────────

  async proposePrice({ chatId, self, peer, price }) {
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) return;

    const text = `I'm proposing ₹${priceNum.toLocaleString('en-IN')} for this job.`;

    await get().sendMessage({
      chatId, self, peer,
      text,
      type:          'price_proposal',
      proposedPrice: priceNum,
    });

    const { db }                        = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
    await updateDoc(doc(db, 'chats', chatId), {
      status:    'price_proposed',
      updatedAt: Timestamp.now(),
    });
  },

  // ── Customer: accept a proposed price ────────────────────────────────────

  async acceptPrice({ chatId, self, peer, price }) {
    const { db } = await import('@/lib/firebase/config');
    const {
      doc, getDoc, updateDoc, addDoc, writeBatch, collection, Timestamp,
    } = await import('firebase/firestore');

    const now  = Timestamp.now();
    const text = `I agree to ₹${price.toLocaleString('en-IN')}. Waiting for your final confirmation.`;

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId:      self.uid,
      senderName:    self.name,
      senderRole:    self.role,
      text,
      type:          'price_accepted',
      proposedPrice: price,
      isRead:        false,
      createdAt:     now,
    });

    // Customer has confirmed their side — waiting for worker to also confirm
    const chatSnap2 = await getDoc(doc(db, 'chats', chatId));
    const bookingId2 = chatSnap2.exists() ? chatSnap2.data().bookingId : null;

    const updateBatch = writeBatch(db);
    updateBatch.update(doc(db, 'chats', chatId), {
      status:            'price_proposed',
      confirmedPrice:    price,
      customerConfirmed: true,
      lastMessage:       text,
      lastMessageAt:     now,
      updatedAt:         now,
      [`lastReadAt.${self.uid}`]: now,
    });

    // Update booking status to 'final_price_pending'
    if (bookingId2) {
      updateBatch.update(doc(db, 'bookings', bookingId2), {
        status:    'final_price_pending',
        updatedAt: now,
      });
    }
    await updateBatch.commit();
  },

  // ── Worker: confirm final price (after customer has accepted) ─────────────
  // Only when BOTH worker + customer have confirmed does readyForPayment = true

  async confirmFinalPrice({ chatId, self }) {
    const { db } = await import('@/lib/firebase/config');
    const {
      doc, getDoc, updateDoc, addDoc, writeBatch, collection, Timestamp,
    } = await import('firebase/firestore');

    const chatSnap = await getDoc(doc(db, 'chats', chatId));
    if (!chatSnap.exists()) return;

    const chatData = chatSnap.data();
    const price    = chatData.confirmedPrice;
    if (!price) return;

    const now  = Timestamp.now();
    const text = `I confirm ₹${price.toLocaleString('en-IN')} as the final price. Customer can now proceed to payment.`;

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId:      self.uid,
      senderName:    self.name,
      senderRole:    self.role,
      text,
      type:          'price_confirmed_worker',
      proposedPrice: price,
      isRead:        false,
      createdAt:     now,
    });

    // Both sides now confirmed — mark ready for payment
    const bookingIdFinal = chatData.bookingId ?? null;
    const finalBatch = writeBatch(db);

    finalBatch.update(doc(db, 'chats', chatId), {
      status:          'price_confirmed',
      workerConfirmed: true,
      readyForPayment: true,
      lastMessage:     text,
      lastMessageAt:   now,
      updatedAt:       now,
      [`lastReadAt.${self.uid}`]: now,
    });

    // BUG FIX: this booking update used to write only confirmedPrice. For
    // the chat-negotiated flow, createBooking() initializes basePrice /
    // platformFee / gstAmount to 0 (there's no price yet at booking-request
    // time), and nothing besides this function updates them afterward — so
    // they stayed 0 for the booking's entire lifetime. markBookingPaid()
    // reads exactly those fields to build the workerEarnings and
    // transactions records, so a real, correctly-charged payment was
    // producing earnings/transaction records with baseAmount/platformFee/
    // gstAmount all zero. Computing the full breakdown here — the moment
    // the price actually becomes final — keeps the booking record itself
    // correct, not just confirmedPrice.
    const { getPricingRates, calculateFinalPrice } = await import('@/lib/pricing');
    const rates    = await getPricingRates();
    const pricing  = calculateFinalPrice(
      price,
      rates.platformFeePercent,
      rates.gstPercent,
      rates.platformFeeType,
      rates.platformFixed,
    );

    // Update booking status to 'ready_for_payment'
    if (bookingIdFinal) {
      finalBatch.update(doc(db, 'bookings', bookingIdFinal), {
        status:         'ready_for_payment',
        confirmedPrice: price,
        basePrice:      pricing.basePrice,
        platformFee:    pricing.platformFee,
        gstAmount:      pricing.gstAmount,
        priceQuoted:    pricing.finalPrice,
        updatedAt:      now,
      });
    }
    await finalBatch.commit();
  },

  // ── Mark chat as read ─────────────────────────────────────────────────────

  async markRead(chatId, userId) {
    try {
      const { db }                        = await import('@/lib/firebase/config');
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, 'chats', chatId), {
        [`lastReadAt.${userId}`]: Timestamp.now(),
      });
    } catch {
      // Non-blocking — never crash for read tracking
    }
  },

  // ── Typing indicator ─────────────────────────────────────────────────────
  //
  // Called with isTyping=true on input change (debounced).
  // Called with isTyping=false on send or after 3s of inactivity.
  // Stores the timestamp so stale typing states (>5s old) are ignored in UI.

  async setTyping(chatId, userId, isTyping) {
    try {
      const { db }                        = await import('@/lib/firebase/config');
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, 'chats', chatId), {
        [`typingAt.${userId}`]: isTyping ? Timestamp.now() : null,
        // Don't update updatedAt — typing doesn't count as a real update
      });
    } catch {
      // Non-blocking
    }
  },

  // ── Update chat status after booking ─────────────────────────────────────

  async markChatBooked(chatId) {
    try {
      const { db }                        = await import('@/lib/firebase/config');
      const { doc, updateDoc, addDoc, collection, Timestamp } =
        await import('firebase/firestore');

      const now = Timestamp.now();

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId:      'system',
        senderName:    'System',
        senderRole:    'system',
        text:          'Booking confirmed! Contact details will be shared after payment.',
        type:          'booking_created',
        proposedPrice: null,
        isRead:        false,
        createdAt:     now,
      });

      await updateDoc(doc(db, 'chats', chatId), {
        status:    'booked',
        updatedAt: now,
      });
    } catch (err) {
      console.warn('[chatStore] markChatBooked:', err.message);
    }
  },

  // ── Bootstrap chat from a booking ───────────────────────────────────────
  //
  // Called by bookingStore.createBooking() immediately after the booking doc
  // is written. Creates the chat doc + a system message so BOTH parties see
  // the chat in their My Chats section before anyone sends a manual message.

  async initBookingChat({
    customerId,
    customerName,
    workerId,
    workerName,
    workerCategoryName,
    workerProfileImageUrl,
    bookingId,
    description,
    scheduledAt,
    address,
  }) {
    try {
      const { db } = await import('@/lib/firebase/config');
      const {
        doc, getDoc, setDoc, addDoc, collection, Timestamp,
      } = await import('firebase/firestore');

      const chatId  = getChatId(customerId, workerId);
      const now     = Timestamp.now();
      const chatRef = doc(db, 'chats', chatId);
      const snap    = await getDoc(chatRef);

      const dateStr = scheduledAt
        ? new Date(scheduledAt).toLocaleString('en-IN', {
            dateStyle: 'medium', timeStyle: 'short',
          })
        : '—';

      const systemText =
        `📋 New booking request\n` +
        `Job: ${description ?? '—'}\n` +
        `Date: ${dateStr}\n` +
        (address ? `Address: ${address}` : '');

      // BUG FIX: getChatId is deterministic per (customer, worker) pair, so
      // the same two people booking each other a second time reuse this
      // exact chat document. Every new booking needs its OWN fresh
      // negotiation state, regardless of how the previous booking with this
      // same worker (or vice versa) left these fields — otherwise a
      // brand-new, un-accepted, un-priced booking could inherit a stale
      // bookingAccepted/readyForPayment/confirmedPrice from a prior,
      // unrelated engagement, unlocking chat — and even the "Proceed to
      // Payment" button with the OLD price — before the worker has seen or
      // accepted this new request at all.
      const freshNegotiationState = {
        bookingAccepted:    false,
        bookingRejected:    false,
        customerConfirmed:  false,
        workerConfirmed:    false,
        readyForPayment:    false,
        confirmedPrice:     null,
      };

      if (!snap.exists()) {
        await setDoc(chatRef, {
          customerId,
          workerId,
          customerName,
          workerName,
          workerCategoryName:    workerCategoryName    ?? '',
          workerProfileImageUrl: workerProfileImageUrl ?? '',
          status:                'active',
          bookingId:             bookingId ?? null,
          // Part 1 (booking-first architecture): explicit false (not just
          // omitted) so ChatModal can tell "brand-new chat awaiting worker
          // acceptance" apart from any chat that existed before this field
          // existed — those read back as `undefined` and are never gated.
          ...freshNegotiationState,
          lastMessage:           systemText,
          lastMessageAt:         now,
          lastReadAt:            { [customerId]: now },
          createdAt:             now,
          updatedAt:             now,
        });
      } else {
        // Chat already exists (e.g. an earlier, separate booking with the
        // same worker) — reuse the thread, but this is a brand-new booking
        // request, so its acceptance/pricing state must start fresh too.
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(chatRef, {
          bookingId:    bookingId ?? null,
          ...freshNegotiationState,
          lastMessage:  systemText,
          lastMessageAt: now,
          updatedAt:    now,
        });
      }

      // Write the system message so it shows as the first message in the chat
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId:      'system',
        senderName:    'System',
        senderRole:    'system',
        text:          systemText,
        type:          'booking_created',
        proposedPrice: null,
        isRead:        false,
        createdAt:     now,
      });

      return chatId;
    } catch (err) {
      // Non-blocking — never crash booking creation because of chat init
      console.warn('[chatStore] initBookingChat:', err.message);
      return null;
    }
  },

  // ── Worker accepted — send system message to chat ─────────────────────

  async notifyBookingAccepted({ customerId, workerId, workerName }) {
    try {
      const { db } = await import('@/lib/firebase/config');
      const {
        doc, addDoc, updateDoc, collection, Timestamp,
      } = await import('firebase/firestore');

      const chatId  = getChatId(customerId, workerId);
      const now     = Timestamp.now();
      const text    = `✅ ${workerName} has accepted your booking request. You can now discuss the details and finalise the price here.`;

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId:      'system',
        senderName:    'System',
        senderRole:    'system',
        text,
        type:          'system',
        proposedPrice: null,
        isRead:        false,
        createdAt:     now,
      });

      await updateDoc(doc(db, 'chats', chatId), {
        // Part 1: this is the actual "chat becomes active" transition —
        // the composer in ChatModal unlocks once this flips to true.
        bookingAccepted: true,
        lastMessage:     text,
        lastMessageAt:   now,
        updatedAt:       now,
      });
    } catch (err) {
      console.warn('[chatStore] notifyBookingAccepted:', err.message);
    }
  },

  // ── Worker rejected the booking request — lock chat, notify customer ──────

  async notifyBookingRejected({ customerId, workerId, workerName }) {
    try {
      const { db } = await import('@/lib/firebase/config');
      const {
        doc, addDoc, updateDoc, collection, Timestamp,
      } = await import('firebase/firestore');

      const chatId  = getChatId(customerId, workerId);
      const now     = Timestamp.now();
      const text    = `${workerName} is unable to accept this booking request.`;

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId:      'system',
        senderName:    'System',
        senderRole:    'system',
        text,
        type:          'system',
        proposedPrice: null,
        isRead:        false,
        createdAt:     now,
      });

      await updateDoc(doc(db, 'chats', chatId), {
        bookingRejected: true,
        lastMessage:     text,
        lastMessageAt:   now,
        updatedAt:       now,
      });
    } catch (err) {
      console.warn('[chatStore] notifyBookingRejected:', err.message);
    }
  },

  // ── Subscribe to user's chat list ─────────────────────────────────────────

  async subscribeChats(userId, role) {
    get()._unsubChats?.();
    set({ chatsLoading: true });

    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, orderBy, onSnapshot,
    } = await import('firebase/firestore');

    const field = role === 'worker' ? 'workerId' : 'customerId';

    const unsub = onSnapshot(
      query(
        collection(db, 'chats'),
        where(field, '==', userId),
        orderBy('lastMessageAt', 'desc'),
      ),
      (snap) => {
        const chats = snap.docs.map(normalizeChat);

        // Unread = chats where lastMessage is newer than lastReadAt for this user
        const totalUnread = chats.reduce((sum, chat) => {
          const lastRead = chat.lastReadAt?.[userId];
          const lastMsg  = chat.lastMessageAt;
          if (!lastRead || !lastMsg) return sum + 1;
          return new Date(lastMsg) > new Date(lastRead) ? sum + 1 : sum;
        }, 0);

        set({ chats, totalUnread, chatsLoading: false });
      },
      (err) => {
        console.error('[chatStore] subscribeChats:', err.message);
        set({ chatsLoading: false });
      },
    );

    set({ _unsubChats: () => { unsub(); } });
  },

  unsubscribeChats() {
    get()._unsubChats?.();
    set({ _unsubChats: null, chats: [], totalUnread: 0 });
  },
}));