import { create }              from 'zustand';
import { createNotification }  from '@/lib/notifications';
import { useChatStore, getChatId } from '@/store/chatStore';
import { updatePaymentLog }    from '@/lib/pricing';

const ts = (v) => v?.toDate?.()?.toISOString?.() ?? v ?? null;

function normalizeBooking(docSnap) {
  const d = docSnap.data();
  return {
    id:            docSnap.id,
    customerId:    d.customerId    ?? '',
    customerName:  d.customerName  ?? '',
    workerId:      d.workerId      ?? '',
    workerName:    d.workerName    ?? '',
    categoryId:    d.categoryId    ?? '',
    categoryName:  d.categoryName  ?? '',
    description:   d.description   ?? '',
    scheduledAt:   ts(d.scheduledAt),
    address:       d.address       ?? '',
    notes:         d.notes         ?? '',
    priceQuoted:   d.priceQuoted   ?? 0,
    basePrice:     d.basePrice     ?? 0,
    platformFee:   d.platformFee   ?? 0,
    gstAmount:     d.gstAmount     ?? 0,
    jobRequestId:  d.jobRequestId  ?? null,
    quoteId:       d.quoteId       ?? null,
    status:          d.status          ?? 'pending_chat',
    paymentStatus:   d.paymentStatus   ?? 'unpaid',
    paymentRef:      d.paymentRef      ?? null,
    transactionId:   d.transactionId   ?? null,
    // Revealed after payment — phone numbers of both parties
    workerPhone:     d.workerPhone     ?? null,
    customerPhone:   d.customerPhone   ?? null,
    paidAt:          ts(d.paidAt),
    completionOtp:   d.completionOtp   ?? null,   // 6-digit OTP — never sent to worker directly
    otpVerified:     d.otpVerified     ?? false,  // true once worker enters correct OTP
    otpStatus:       d.otpStatus       ?? 'pending', // pending | verified | locked | dispute
    otpAttempts:     d.otpAttempts     ?? 0,
    // Chat → booking linkage
    readyForPayment: d.readyForPayment ?? false,
    confirmedPrice:  d.confirmedPrice  ?? null,
    cancelledBy:     d.cancelledBy     ?? null,
    completedAt:     ts(d.completedAt),
    createdAt:       ts(d.createdAt),
    updatedAt:       ts(d.updatedAt),
  };
}

export const useBookingStore = create((set, get) => ({
  customerBookings:        [],
  customerBookingsLoading: false,
  workerBookings:          [],
  workerBookingsLoading:   false,
  allBookings:             [],
  allBookingsLoading:      false,

  _unsubCustomer: null,
  _unsubWorker:   null,

  // ── Customer: subscribe to own bookings ───────────────────────────────────

  async subscribeCustomerBookings(customerId) {
    get()._unsubCustomer?.();
    set({ customerBookingsLoading: true });

    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, orderBy, onSnapshot, getDocs,
    } = await import('firebase/firestore');

    /**
     * BUG FIX (Bug 4):
     * The query `where('customerId','==',id) + orderBy('createdAt','desc')`
     * requires a composite index. If the index is missing, the onSnapshot
     * error callback fires silently and bookings never appear.
     *
     * Fix: try the full query first. On error, fall back to a simple
     * `where` only query and sort client-side. Bookings still appear
     * while the index is being built.
     */
    const safetyTimer = setTimeout(
      () => set({ customerBookingsLoading: false }),
      5000,
    );

    let usedFallback = false;

    const unsub = onSnapshot(
      query(
        collection(db, 'bookings'),
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        clearTimeout(safetyTimer);
        if (!usedFallback) {
          set({
            customerBookings:        snap.docs.map(normalizeBooking),
            customerBookingsLoading: false,
          });
        }
      },
      async (err) => {
        clearTimeout(safetyTimer);
        console.error(
          '[bookingStore] subscribeCustomerBookings — composite index missing.\n' +
          'Run: firebase deploy --only firestore:indexes\n',
          err.message,
        );
        usedFallback = true;
        try {
          const snap = await getDocs(
            query(
              collection(db, 'bookings'),
              where('customerId', '==', customerId),
            ),
          );
          const bookings = snap.docs
            .map(normalizeBooking)
            .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
          set({ customerBookings: bookings, customerBookingsLoading: false });
        } catch (fallbackErr) {
          console.error('[bookingStore] Customer fallback failed:', fallbackErr.message);
          set({ customerBookingsLoading: false });
        }
      },
    );

    set({ _unsubCustomer: () => { unsub(); clearTimeout(safetyTimer); } });
  },

  unsubscribeCustomerBookings() {
    get()._unsubCustomer?.();
    set({ _unsubCustomer: null });
  },

  // ── Worker: subscribe to incoming bookings ────────────────────────────────

  async subscribeWorkerBookings(workerId) {
    get()._unsubWorker?.();
    set({ workerBookingsLoading: true });

    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, orderBy, onSnapshot, getDocs,
    } = await import('firebase/firestore');

    const safetyTimer = setTimeout(
      () => set({ workerBookingsLoading: false }),
      5000,
    );

    let usedFallback = false;

    const unsub = onSnapshot(
      query(
        collection(db, 'bookings'),
        where('workerId', '==', workerId),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        clearTimeout(safetyTimer);
        if (!usedFallback) {
          set({
            workerBookings:        snap.docs.map(normalizeBooking),
            workerBookingsLoading: false,
          });
        }
      },
      async (err) => {
        clearTimeout(safetyTimer);
        console.error(
          '[bookingStore] subscribeWorkerBookings — composite index missing.\n' +
          'Run: firebase deploy --only firestore:indexes\n',
          err.message,
        );
        usedFallback = true;
        try {
          const snap = await getDocs(
            query(
              collection(db, 'bookings'),
              where('workerId', '==', workerId),
            ),
          );
          const bookings = snap.docs
            .map(normalizeBooking)
            .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
          set({ workerBookings: bookings, workerBookingsLoading: false });
        } catch (fallbackErr) {
          console.error('[bookingStore] Worker fallback failed:', fallbackErr.message);
          set({ workerBookingsLoading: false });
        }
      },
    );

    set({ _unsubWorker: () => { unsub(); clearTimeout(safetyTimer); } });
  },

  unsubscribeWorkerBookings() {
    get()._unsubWorker?.();
    set({ _unsubWorker: null });
  },

  // ── Admin: fetch all bookings ─────────────────────────────────────────────

  async fetchAllBookings() {
    set({ allBookingsLoading: true });
    try {
      const { db } = await import('@/lib/firebase/config');
      const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(
        query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
      );
      set({ allBookings: snap.docs.map(normalizeBooking) });
    } catch (err) {
      console.error('[bookingStore] fetchAllBookings:', err.message);
    } finally {
      set({ allBookingsLoading: false });
    }
  },

  // ── Fetch a single booking by ID ────────────────────────────────────────

  async getBooking(bookingId) {
    const { db }               = await import('@/lib/firebase/config');
    const { doc, getDoc }      = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'bookings', bookingId));
    if (!snap.exists()) return null;
    return normalizeBooking(snap);
  },

  // ── Create booking ────────────────────────────────────────────────────────

  async createBooking(data) {
    const { db }                      = await import('@/lib/firebase/config');
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');

    const now    = Timestamp.now();
    const docRef = await addDoc(collection(db, 'bookings'), {
      customerId:    data.customerId   ?? '',
      customerName:  data.customerName ?? '',
      workerId:      data.workerId     ?? '',
      workerName:    data.workerName   ?? '',
      // ← Some booking entry points (My Chats list, "Chat" button on an
      // existing booking) pass a chat-peer object that only ever carries
      // categoryName, never categoryId — Firestore rejects `undefined`
      // outright, so these fallbacks are required, not just defensive.
      categoryId:    data.categoryId   ?? '',
      categoryName:  data.categoryName ?? '',
      description:   data.description ?? '',
      scheduledAt:   Timestamp.fromDate(new Date(data.scheduledAt)),
      address:       data.address      ?? '',
      notes:         data.notes        ?? '',
      priceQuoted:   data.priceQuoted   ?? 0,
      basePrice:     data.basePrice     ?? data.priceQuoted ?? 0,
      platformFee:   data.platformFee   ?? 0,
      gstAmount:     data.gstAmount     ?? 0,
      jobRequestId:  data.jobRequestId  ?? null,
      quoteId:       data.quoteId       ?? null,
      status:        'pending_chat',
      paymentStatus: 'unpaid',
      paymentRef:    null,
      createdAt:     now,
      updatedAt:     now,
    });

    // Notify the worker
    await createNotification(
      data.workerId,
      'booking_new',
      { customerName: data.customerName, categoryName: data.categoryName },
      docRef.id,
    );

    // Bootstrap chat so it appears in both parties' My Chats immediately
    await useChatStore.getState().initBookingChat({
      customerId:            data.customerId   ?? '',
      customerName:          data.customerName ?? '',
      workerId:              data.workerId     ?? '',
      workerName:            data.workerName   ?? '',
      workerCategoryName:    data.categoryName    ?? '',
      workerProfileImageUrl: data.workerProfileImageUrl ?? '',
      bookingId:             docRef.id,
      description:           data.description ?? '',
      scheduledAt:           data.scheduledAt instanceof Date
        ? data.scheduledAt.toISOString()
        : data.scheduledAt,
      address:               data.address ?? '',
    });

    return docRef.id;
  },

  // ── Accept (worker) — blocked if worker has an active paid job ─────────────
  //
  // A worker can only have ONE active paid booking at a time.
  // If they have an accepted+paid booking that is not yet OTP-completed,
  // they cannot accept a new one.

  async acceptBooking(bookingId, booking) {
    const { db } = await import('@/lib/firebase/config');
    const {
      doc, updateDoc, collection, query, where, getDocs, Timestamp,
    } = await import('firebase/firestore');

    // Check for active paid booking awaiting OTP completion.
    // Only status='paid' can have paymentStatus='paid' — other statuses
    // (discussing, final_price_pending, ready_for_payment) haven't been paid yet.
    const activeSnap = await getDocs(
      query(
        collection(db, 'bookings'),
        where('workerId', '==', booking.workerId),
        where('status',   '==', 'paid'),
      ),
    );

    const hasActiveJob = activeSnap.docs.some(
      (d) => d.id !== bookingId && !d.data().otpVerified,
    );

    if (hasActiveJob) {
      throw new Error(
        'You have an active paid booking in progress. ' +
        "Complete your current job using the customer's OTP before accepting a new one.",
      );
    }

    await updateDoc(doc(db, 'bookings', bookingId), {
      status:    'discussing',
      updatedAt: Timestamp.now(),
    });

    await createNotification(
      booking.customerId,
      'booking_accepted',
      { workerName: booking.workerName },
      bookingId,
    );

    // Send system message to chat so customer knows booking was accepted
    await useChatStore.getState().notifyBookingAccepted({
      customerId: booking.customerId,
      workerId:   booking.workerId,
      workerName: booking.workerName,
    });
  },

  // ── Reject (worker) ───────────────────────────────────────────────────────

  async rejectBooking(bookingId, booking) {
    const { db }                        = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

    await updateDoc(doc(db, 'bookings', bookingId), {
      status:    'cancelled_before_payment',
      updatedAt: Timestamp.now(),
    });

    await createNotification(
      booking.customerId,
      'booking_cancelled',
      {
        workerName:        booking.workerName,
        categoryName:      booking.categoryName,
        cancelledByWorker: true,
      },
      bookingId,
    );

    // Part 1: mirror acceptBooking's chat notification — the customer sees
    // a clear system message, and the chat composer reflects the declined
    // state instead of sitting in "waiting for acceptance" forever.
    await useChatStore.getState().notifyBookingRejected({
      customerId: booking.customerId,
      workerId:   booking.workerId,
      workerName: booking.workerName,
    });
  },

  // ── completeBooking — DEPRECATED in favour of verifyOtpAndComplete ─────────
  // Kept to prevent crash if called from old cached code.
  // In production this is never called — OTP verification via
  // /api/bookings/verify-otp is the only way to mark a booking complete.
  async completeBooking(bookingId, booking) {
    throw new Error(
      'Direct completion is not allowed. ' +
      'The customer must provide the OTP to mark this booking as complete.',
    );
  },

  // ── Verify OTP and complete booking (worker) ─────────────────────────────
  //
  // Worker enters the OTP the customer received after payment.
  // Only if OTP matches does the booking get marked completed.
  // Unlocks the worker to accept new bookings.

  // ── Verify OTP via secure server-side API ─────────────────────────────────
  //
  // The OTP is NEVER read client-side — verification runs through
  // /api/bookings/verify-otp (Admin SDK). This prevents the worker from
  // extracting completionOtp from the Firestore doc via browser tools.
  // Rate-limited to MAX 5 attempts; locked thereafter.

  async verifyOtpAndComplete(bookingId, booking, enteredOtp) {
    if (!enteredOtp || !/^\d{6}$/.test(enteredOtp.toString().trim())) {
      throw new Error('Please enter a valid 6-digit OTP.');
    }

    // Get current user's ID token to authenticate the API call
    const { getAuth } = await import('firebase/auth');
    const currentUser = getAuth().currentUser;
    if (!currentUser) throw new Error('Session expired. Please log in again.');

    const idToken = await currentUser.getIdToken();

    const res = await fetch('/api/bookings/verify-otp', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ bookingId, otp: enteredOtp.toString().trim() }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Attach remaining attempts to error if present
      const msg = data.message ?? 'Verification failed.';
      const err = new Error(msg);
      err.remaining = data.remaining ?? null;
      throw err;
    }

    return data;
  },

  // ── Cancel (customer) — blocked after payment ────────────────────────────

  async cancelBooking(bookingId, booking) {
    if (booking.paymentStatus === 'paid' || booking.status === 'paid') {
      throw new Error('This booking cannot be cancelled after payment has been made.');
    }

    const { db }                        = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

    await updateDoc(doc(db, 'bookings', bookingId), {
      status:    'cancelled_before_payment',
      updatedAt: Timestamp.now(),
    });

    await createNotification(
      booking.workerId,
      'booking_cancelled',
      { categoryName: booking.categoryName, cancelledByWorker: false },
      bookingId,
    );
  },

  // ── Mark as paid ──────────────────────────────────────────────────────────
  //
  // After payment:
  //  1. Booking status → 'paid' (Part 13 status)
  //  2. Phone numbers revealed, OTP generated
  //  3. Worker earnings entry created (status: 'locked' until OTP)
  //  4. Transaction audit record written
  //  5. Notifications sent to both parties

  async markBookingPaid(bookingId, paymentRef) {
    const { db } = await import('@/lib/firebase/config');
    const {
      doc, getDoc, updateDoc, addDoc, collection, Timestamp,
    } = await import('firebase/firestore');

    const now         = Timestamp.now();
    const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
    if (!bookingSnap.exists()) return;

    const booking = bookingSnap.data();

    // PART 5 FIX (idempotency): if this booking is already marked paid,
    // do nothing further. Without this guard, a second call — from a
    // retry, a race between two tabs, or any other double-invocation —
    // would generate a brand-new completionOtp (invalidating the one
    // already shown to the customer) and create a second workerEarnings
    // entry and a second transactions record for the same payment.
    if (booking.paymentStatus === 'paid') {
      console.warn('[bookingStore] markBookingPaid: booking already paid, skipping', bookingId);
      return;
    }

    // Fetch phone numbers from users and workers collections
    let workerPhone   = null;
    let customerPhone = null;

    try {
      const [workerSnap, customerSnap] = await Promise.all([
        getDoc(doc(db, 'workers', booking.workerId)),
        getDoc(doc(db, 'users',   booking.customerId)),
      ]);
      workerPhone   = workerSnap.exists()   ? (workerSnap.data().phone   ?? null) : null;
      customerPhone = customerSnap.exists() ? (customerSnap.data().phone ?? null) : null;
    } catch (err) {
      console.warn('[bookingStore] markBookingPaid: failed to fetch phone numbers', err.message);
    }

    // Generate 6-digit OTP for service completion verification
    const completionOtp = String(Math.floor(100000 + Math.random() * 900000));

    // Update booking — mark paid, reveal phone numbers, save OTP
    await updateDoc(doc(db, 'bookings', bookingId), {
      paymentStatus: 'paid',
      paymentRef,
      status:        'paid',
      workerPhone,
      customerPhone,
      completionOtp,
      otpVerified:   false,
      paidAt:        now,
      updatedAt:     now,
    });

    // BUG FIX (chat composer permanently disabled after just opening the
    // payment sheet): markChatBooked() used to be called from ChatModal's
    // generic onClose handler on the BookingModal it renders — meaning it
    // fired whenever that modal was dismissed for ANY reason (X button,
    // clicking the backdrop, browser back), not only after a successful
    // payment. Once fired, the chat's status becomes 'booked' permanently,
    // which disables the message composer for the rest of that
    // conversation (see ChatModal's `isBooked` checks) — so a customer
    // who opened the payment sheet just to check something, then closed
    // it without paying, would find they could never type in that chat
    // again. Calling it here instead means it only ever fires once a
    // payment has actually gone through, regardless of which screen
    // initiated it.
    try {
      await useChatStore.getState().markChatBooked(
        getChatId(booking.customerId, booking.workerId),
      );
    } catch (err) {
      console.warn('[bookingStore] markBookingPaid: markChatBooked failed', err.message);
    }

    // PART 6: close out the paymentLogs entry (opened by create-order,
    // updated by verify) now that the booking is actually marked paid.
    // Reuses the orderId create-order already stored on the booking
    // (Part 5's pendingRazorpayOrderId) rather than adding orderId as a
    // new parameter to this function.
    await updatePaymentLog(booking.pendingRazorpayOrderId, {
      paymentId: paymentRef, paymentStatus: 'completed',
    });

    // Compute worker-earnings / transaction figures
    //
    // BUG FIX: this used to read booking.basePrice/platformFee/gstAmount
    // directly. For the chat-negotiated flow those stay at the 0 that
    // createBooking() defaults them to unless confirmFinalPrice() also
    // wrote the real breakdown (now fixed above it in chatStore.js) — any
    // booking that confirmed its price before that fix shipped would still
    // reach this point with basePrice/platformFee/gstAmount stuck at 0,
    // producing a workerEarnings entry and a transactions record with
    // baseAmount/platformFee/gstAmount all zero despite a real, correctly
    // charged payment. Recomputing from booking.confirmedPrice — the field
    // that's reliably set either way — fixes this regardless of when the
    // booking was created. Quote-based bookings never set confirmedPrice
    // (they set basePrice/platformFee/gstAmount directly from the accepted
    // quote instead), so those fall back to the stored fields correctly.
    let basePrice, platformFee, gstAmount;
    if (booking.confirmedPrice && booking.confirmedPrice > 0) {
      const { getPricingRates, calculateFinalPrice } = await import('@/lib/pricing');
      const rates   = await getPricingRates();
      const pricing = calculateFinalPrice(
        booking.confirmedPrice,
        rates.platformFeePercent,
        rates.gstPercent,
        rates.platformFeeType,
        rates.platformFixed,
      );
      basePrice   = pricing.basePrice;
      platformFee = pricing.platformFee;
      gstAmount   = pricing.gstAmount;
    } else {
      basePrice   = booking.basePrice   ?? booking.priceQuoted ?? 0;
      platformFee = booking.platformFee ?? 0;
      gstAmount   = booking.gstAmount   ?? 0;
    }
    const totalPaid = basePrice + platformFee + gstAmount;

    try {
      await addDoc(collection(db, 'workerEarnings'), {
        workerId:    booking.workerId,
        workerName:  booking.workerName,
        bookingId,
        customerId:  booking.customerId,
        customerName: booking.customerName,
        categoryName: booking.categoryName ?? '',
        baseAmount:  basePrice,       // what worker receives
        platformFee,
        gstAmount,
        totalPaid,
        paymentRef,
        status:      'locked',       // locked until OTP verified | available | pending_withdrawal | withdrawn
        paidAt:      now,
        createdAt:   now,
      });
    } catch (err) {
      console.warn('[bookingStore] markBookingPaid: failed to create earnings entry', err.message);
    }

    // Write transaction audit record
    try {
      const txnRef = await addDoc(collection(db, 'transactions'), {
        bookingId,
        customerId:   booking.customerId,
        customerName: booking.customerName,
        workerId:     booking.workerId,
        workerName:   booking.workerName,
        categoryName: booking.categoryName ?? '',
        amount:       totalPaid,          // total charged to customer
        workerAmount: basePrice,          // what worker earns
        platformFee,
        gstAmount,
        paymentRef,
        type:         'booking_payment',  // booking_payment | refund
        status:       'completed',
        createdAt:    now,
      });
      // Part 4: store the transaction's own doc id on the booking so the
      // post-payment UI can show a real Transaction ID, distinct from the
      // Razorpay Payment ID.
      await updateDoc(doc(db, 'bookings', bookingId), { transactionId: txnRef.id });
    } catch (err) {
      console.warn('[bookingStore] markBookingPaid: failed to write transaction', err.message);
    }

    // Part 6: update the payment log entry create-order already wrote for
    // this order, so it reflects the completed payment instead of staying
    // at 'order_created' forever.
    if (booking.pendingRazorpayOrderId) {
      const { updatePaymentLog } = await import('@/lib/pricing');
      await updatePaymentLog(booking.pendingRazorpayOrderId, {
        bookingId, paymentId: paymentRef,
        workerId: booking.workerId, customerId: booking.customerId,
        finalPrice: basePrice, platformFee, gstAmount, totalAmount: totalPaid,
        paymentStatus: 'paid', verificationStatus: 'verified',
      });
    }

    // Notify both parties
    try {
      await Promise.all([
        createNotification(
          booking.workerId,
          'booking_paid',
          { customerName: booking.customerName, amount: basePrice },
          bookingId,
        ),
        createNotification(
          booking.workerId,
          'booking_awaiting_otp',
          { customerName: booking.customerName },
          bookingId,
        ),
        createNotification(
          booking.customerId,
          'booking_paid_customer',
          { workerName: booking.workerName, workerPhone },
          bookingId,
        ),
        createNotification(
          booking.customerId,
          'booking_otp',
          { otp: completionOtp, workerName: booking.workerName },
          bookingId,
        ),
      ]);
    } catch (err) {
      console.warn('[bookingStore] markBookingPaid: notifications failed', err.message);
    }
  },
}));