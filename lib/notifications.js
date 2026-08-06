/**
 * Notification System
 *
 * createNotification() is called internally by stores whenever a relevant
 * event occurs. It writes to Firestore notifications/{id}.
 *
 * The NotificationBell component subscribes to the user's notifications
 * via notificationStore.js which reads the same collection.
 *
 * Notification types:
 *   welcome, booking_new, booking_accepted, booking_completed,
 *   booking_cancelled, booking_paid, booking_paid_customer,
 *   review_received, category_approved,
 *   worker_verified, payment_received, system
 *
 * @typedef {'welcome'|'booking_new'|'booking_accepted'|'booking_completed'|
 *           'booking_cancelled'|'booking_paid'|'booking_paid_customer'|'booking_otp'|'booking_awaiting_otp'|'booking_completed_worker'|'chat_request'|
 *           'review_received'|'category_approved'|
 *           'worker_verified'|'payment_received'|'system'} NotificationType
 */

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = {
  welcome: (d) => ({
    title: 'Welcome to HYS Services!',
    body:  `Hi ${d.name ?? 'there'}, your account is ready. Start exploring services.`,
    link:  null,
  }),

  booking_new: (d) => ({
    title: 'New Booking Request',
    body:  `${d.customerName ?? 'A customer'} requested ${d.categoryName ?? 'a service'}.`,
    link:  '/worker-dashboard',
  }),

  booking_accepted: (d) => ({
    title: 'Booking Accepted!',
    body:  `${d.workerName ?? 'The worker'} accepted your booking.`,
    link:  '/customer-bookings',
  }),

  booking_completed: (d) => ({
    title: 'Job Completed',
    body:  `${d.workerName ?? 'The worker'} marked the job as complete. Please leave a review.`,
    link:  '/customer-bookings',
  }),

  booking_cancelled: (d) => ({
    title: 'Booking Cancelled',
    body:  d.cancelledByWorker
      ? `${d.workerName ?? 'The worker'} cancelled the booking for ${d.categoryName ?? 'your service'}.`
      : `Your booking for ${d.categoryName ?? 'a service'} was cancelled.`,
    link:  d.cancelledByWorker ? '/customer-dashboard' : '/worker-dashboard',
  }),

  // Fired to the peer when a new chat is started (no prior booking)
  chat_request: (d) => ({
    title: 'New Chat Request',
    body:  `${d.senderName ?? 'Someone'} wants to discuss a ${
              d.categoryName ? d.categoryName + ' ' : ''
            }job with you.`,
    link:  '/worker-chats',
  }),

  // Fired to customer after payment — contains OTP for service completion
  booking_otp: (d) => ({
    title: 'Your Booking OTP',
    body:  `Your completion OTP is ${d.otp}. Share this with ${
              d.workerName ?? 'the worker'
            } ONLY after the work is done. Do not share before.`,
    link:  '/customer-bookings',
  }),

  // Fired to worker after OTP verification + booking completion
  booking_completed_worker: (d) => ({
    title: 'Job Completed!',
    body:  `Your job (${d.categoryName ?? 'Service'}) has been completed. ` +
           `₹${d.basePrice?.toLocaleString('en-IN') ?? '—'} is now available for withdrawal.`,
    link:  '/worker-dashboard',
  }),

  // Fired to worker after payment — tells them to await OTP from customer
  booking_awaiting_otp: (d) => ({
    title: 'Payment Received — Awaiting Job Completion',
    body:  `${d.customerName ?? 'A customer'} has paid. Complete the job, ` +
           `then ask them for the 6-digit OTP to mark the booking as done.`,
    link:  '/worker-dashboard',
  }),

  // Fired to worker when customer completes payment
  booking_paid: (d) => ({
    title: 'Payment Received!',
    body:  `${d.customerName ?? 'A customer'} completed payment of ₹${
              d.amount?.toLocaleString('en-IN') ?? '—'
            }. Their contact details are now visible in your dashboard.`,
    link:  '/worker-dashboard',
  }),

  // Fired to customer when payment is successful (phone number revealed)
  booking_paid_customer: (d) => ({
    title: 'Booking Confirmed & Paid!',
    body:  `Payment successful. ${d.workerName ?? 'The worker'}'s mobile number is now visible in My Bookings.`,
    link:  '/customer-bookings',
  }),

  review_received: (d) => ({
    title: 'New Review Received',
    body:  `${d.customerName ?? 'A customer'} gave you a ${d.rating ?? 5}-star review.`,
    link:  `/worker/${d.workerId ?? ''}`,
  }),

  category_approved: (d) => ({
    title: 'Category Approved',
    body:  `Your category "${d.categoryName ?? 'submission'}" has been approved.`,
    link:  '/worker-profile',
  }),

  worker_verified: () => ({
    title: 'You are now Verified!',
    body:  'Your profile now shows a verified badge to customers. This builds trust and gets more bookings.',
    link:  '/worker-profile',
  }),

  payment_received: (d) => ({
    title: 'Payment Received',
    body:  `Payment of ₹${d.amount?.toLocaleString('en-IN') ?? '—'} has been confirmed.`,
    link:  '/worker-dashboard',
  }),

  system: (d) => ({
    title: d.title ?? 'System Notification',
    body:  d.body  ?? '',
    link:  d.link  ?? null,
  }),
};

// ─── createNotification ───────────────────────────────────────────────────────

/**
 * Writes a notification document to Firestore.
 * Non-blocking — errors are logged but never thrown to the caller.
 *
 * @param {string} userId      — recipient UID
 * @param {string} type        — one of the TEMPLATES keys
 * @param {object} data        — template-specific variables
 * @param {string} [relatedId] — booking/review/quote ID for deep-linking
 */
export async function createNotification(userId, type, data = {}, relatedId = null) {
  if (!userId || !type) return;

  try {
    const template = TEMPLATES[type] ?? TEMPLATES.system;
    const { title, body, link } = template(data);

    const { db }                      = await import('@/lib/firebase/config');
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');

    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      body,
      link:      link ?? null,
      relatedId: relatedId ?? null,
      isRead:    false,
      createdAt: Timestamp.now(),
    });
  } catch (err) {
    // Notifications are non-critical — log but never crash the caller
    console.warn('[notifications] createNotification failed:', err.message);
  }
}

// ─── Real-time subscription ────────────────────────────────────────────────────

/**
 * Subscribes to a user's notifications in real-time.
 * Fires callback immediately with existing notifications, then on every change.
 * Returns an unsubscribe function.
 *
 * @param {string}   userId
 * @param {function} callback  — Receives an array of notification objects
 * @param {number}   [maxItems=30]
 * @returns {function} unsubscribe
 */
export function subscribeNotifications(userId, callback, maxItems = 30) {
  let cleanup = () => {};

  import('@/lib/firebase/config').then(({ db }) => {
    import('firebase/firestore').then(({
      collection, query, where, orderBy, limit, onSnapshot, Timestamp,
    }) => {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(maxItems),
      );

      const unsub = onSnapshot(q, (snap) => {
        const notifications = snap.docs.map((d) => {
          const data = d.data();
          return {
            id:        d.id,
            userId:    data.userId,
            type:      data.type,
            title:     data.title,
            body:      data.body,
            isRead:    data.isRead    ?? false,
            link:      data.link      ?? null,
            relatedId: data.relatedId ?? null,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt ?? null,
          };
        });
        callback(notifications);
      });

      cleanup = unsub;
    });
  });

  return () => cleanup();
}

// ─── Mark as read ──────────────────────────────────────────────────────────────

/**
 * Marks a single notification as read.
 * @param {string} notificationId
 */
export async function markAsRead(notificationId) {
  try {
    const { db }             = await import('@/lib/firebase/config');
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  } catch (err) {
    console.warn('[notifications] markAsRead failed:', err.message);
  }
}

/**
 * Marks ALL unread notifications as read for a user.
 * Uses a batch write for efficiency — one round-trip regardless of count.
 * @param {string} userId
 */
export async function markAllAsRead(userId) {
  try {
    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, getDocs, writeBatch, doc,
    } = await import('firebase/firestore');

    const q    = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((d) =>
      batch.update(doc(db, 'notifications', d.id), { isRead: true }),
    );
    await batch.commit();
  } catch (err) {
    console.warn('[notifications] markAllAsRead failed:', err.message);
  }
}