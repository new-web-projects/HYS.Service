import { auth, db } from '@/lib/firebase/config';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection as col,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

const IS_PROD      = process.env.NODE_ENV === 'production';
const CLOUD_URL    = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_URL;
const CLOUD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const CLOUD_FOLDER = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER;

// Collections that use soft delete (deletedAt field)
const SOFT_DELETE_COLS = new Set(['pages', 'media']);

// ─── Data cleaning ─────────────────────────────────────────────────────────
/**
 * BUG FIX (Bug 1): Sections from @dnd-kit contain internal Symbol keys,
 * undefined values, and non-plain objects that Firestore rejects.
 * This function recursively strips everything Firestore cannot store.
 */
function cleanForFirestore(value) {
  // Preserve Firestore Timestamps
  if (value instanceof Timestamp) return value;
  if (value === null)             return null;
  if (value === undefined)        return null;

  if (Array.isArray(value)) {
    return value
      .map(cleanForFirestore)
      .filter((v) => v !== undefined);
  }

  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      // Skip Symbol keys, functions, class instances (only plain objects)
      if (typeof key !== 'string') continue;
      const cleaned = cleanForFirestore(value[key]);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result;
  }

  // Numbers: Firestore rejects Infinity and NaN
  if (typeof value === 'number') {
    return isFinite(value) ? value : null;
  }

  // Strings, booleans pass through
  return value;
}

/**
 * BUG FIX (Bug 1): Serializes the sections array into plain Firestore-safe
 * objects. This is the core fix for "section content not saving" —
 * it strips dnd-kit internals and ensures every field is a plain primitive.
 */
function serializeSections(sections) {
  if (!Array.isArray(sections)) return [];

  return sections.map((section) => {
    if (!section || typeof section !== 'object') return null;

    // Every section must have id and type as strings
    const base = {
      id:   String(section.id   ?? crypto.randomUUID()),
      type: String(section.type ?? 'text'),
    };

    switch (base.type) {
      case 'hero':
        return {
          ...base,
          heading:            String(section.heading            ?? ''),
          subheading:         String(section.subheading         ?? ''),
          backgroundImageUrl: String(section.backgroundImageUrl ?? ''),
          ctaText:            String(section.ctaText            ?? ''),
          ctaLink:            String(section.ctaLink            ?? ''),
        };

      case 'text':
        return {
          ...base,
          heading: String(section.heading ?? ''),
          body:    String(section.body    ?? ''),
        };

      case 'gallery':
        return {
          ...base,
          images: Array.isArray(section.images)
            ? section.images.map((img) => ({
                url:     String(img?.url     ?? ''),
                caption: String(img?.caption ?? ''),
              }))
            : [],
        };

      case 'contact':
        return {
          ...base,
          email:   String(section.email   ?? ''),
          phone:   String(section.phone   ?? ''),
          address: String(section.address ?? ''),
        };

      case 'custom':
        return {
          ...base,
          html: String(section.html ?? ''),
        };

      default:
        // Unknown type — clean generically
        return cleanForFirestore({ ...base, ...section });
    }
  }).filter(Boolean); // Remove any null entries
}

// ─── Internal helpers ──────────────────────────────────────────────────────

function setSessionCookie(token) {
  if (typeof document === 'undefined') return;
  const secure = IS_PROD ? '; Secure' : '';
  if (token) {
    document.cookie = `firebase_session=${token}; Max-Age=3600; path=/; SameSite=Lax${secure}`;
  } else {
    document.cookie = 'firebase_session=; Max-Age=0; path=/';
  }
}

async function requireAdminDoc(uid) {
  const snap = await getDoc(doc(db, 'admins', uid));
  if (!snap.exists()) {
    throw new Error('Unauthorized: no admin record for this account.');
  }
  return snap.data();
}

function tsToISO(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return value ?? null;
}

function normalizeDates(data) {
  if (!data || typeof data !== 'object') return data;
  const result = {};
  for (const [k, v] of Object.entries(data)) {
    result[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  }
  return result;
}

function snapToItem(snap) {
  return { id: snap.id, ...normalizeDates(snap.data() ?? {}) };
}

async function writeAuditLog(action, collectionName, documentId, before, after) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(col(db, 'audit_logs'), {
      adminId:    user.uid,
      action,
      collection: collectionName,
      documentId,
      before:     before ?? null,
      after:      after  ?? null,
      timestamp:  Timestamp.now(),
    });
  } catch (err) {
    // Audit logs are non-blocking
    console.warn('[firebase-adapter] audit log write failed:', err.message);
  }
}

function buildQuery(collectionName) {
  if (SOFT_DELETE_COLS.has(collectionName)) {
    return query(col(db, collectionName), where('deletedAt', '==', null));
  }
  return col(db, collectionName);
}

function sortDesc(items) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0),
  );
}

// ─── Adapter ───────────────────────────────────────────────────────────────

export const firebaseAdapter = {

  // ── AUTH ──────────────────────────────────────────────────────────────────

  async login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const adminData = await requireAdminDoc(cred.user.uid);
    await updateDoc(doc(db, 'admins', cred.user.uid), { lastLogin: Timestamp.now() });
    const accessToken = await cred.user.getIdToken();
    setSessionCookie(accessToken);
    return {
      uid:   cred.user.uid,
      email: adminData.email,
      name:  adminData.name,
      role:  adminData.role,
      accessToken,
    };
  },

  async logout() {
    setSessionCookie(null);
    await signOut(auth);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  },

  async getSession() {
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, async (user) => {
        unsub();
        if (!user) { resolve(null); return; }
        try {
          const adminData = await requireAdminDoc(user.uid);
          resolve({
            uid:   user.uid,
            email: adminData.email,
            name:  adminData.name,
            role:  adminData.role,
          });
        } catch {
          resolve(null);
        }
      });
    });
  },

  // ── CONTENT ───────────────────────────────────────────────────────────────

  async getAll(collectionName) {
    if (collectionName === 'settings') {
      const snap = await getDoc(doc(db, 'settings', 'global'));
      return snap.exists() ? [snapToItem(snap)] : [];
    }

    if (collectionName === 'categories') {
      const snap = await getDocs(
        query(col(db, 'categories'), orderBy('name', 'asc')),
      );
      return snap.docs.map(snapToItem);
    }

    const q    = buildQuery(collectionName);
    const snap = await getDocs(q);
    return sortDesc(snap.docs.map(snapToItem));
  },

  async getById(collectionName, id) {
    const realId = collectionName === 'settings' ? 'global' : id;
    const snap   = await getDoc(doc(db, collectionName, realId));
    if (!snap.exists()) {
      throw new Error(`${collectionName}/${realId} not found.`);
    }
    return snapToItem(snap);
  },

  async create(collectionName, data) {
    const now = Timestamp.now();

    if (collectionName === 'settings') {
      const payload = cleanForFirestore({
        ...data,
        updatedAt:    now,
        _backendMode: process.env.NEXT_PUBLIC_BACKEND_MODE,
      });
      await setDoc(doc(db, 'settings', 'global'), payload);
      return { id: 'global', ...normalizeDates(payload) };
    }

    // ── BUG FIX (Bug 1): Serialize sections before every write ────────────
    const cleanData = { ...data };
    if (Array.isArray(cleanData.sections)) {
      cleanData.sections = serializeSections(cleanData.sections);
    }

    const payload = cleanForFirestore({
      ...cleanData,
      createdAt: now,
      updatedAt: now,
      ...(SOFT_DELETE_COLS.has(collectionName) ? { deletedAt: null } : {}),
    });

    const ref = await addDoc(col(db, collectionName), payload);
    await writeAuditLog('create', collectionName, ref.id, null, cleanData);
    return { id: ref.id, ...normalizeDates(payload) };
  },

  async update(collectionName, id, data) {
    const realId = collectionName === 'settings' ? 'global' : id;
    const ref    = doc(db, collectionName, realId);

    const beforeSnap = await getDoc(ref);
    const before     = beforeSnap.exists() ? beforeSnap.data() : null;

    // ── BUG FIX (Bug 1): Serialize sections, remove internal fields ───────
    const { _loadedUpdatedAt, ...updateData } = data;
    if (Array.isArray(updateData.sections)) {
      updateData.sections = serializeSections(updateData.sections);
    }

    const now     = Timestamp.now();
    const payload = cleanForFirestore({
      ...updateData,
      updatedAt: now,
      ...(collectionName === 'settings'
        ? { _backendMode: process.env.NEXT_PUBLIC_BACKEND_MODE }
        : {}),
    });

    if (beforeSnap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }

    await writeAuditLog('update', collectionName, realId, before, updateData);
    const afterSnap = await getDoc(ref);
    return snapToItem(afterSnap);
  },

  async softDelete(collectionName, id) {
    const ref        = doc(db, collectionName, id);
    const beforeSnap = await getDoc(ref);
    const before     = beforeSnap.exists() ? beforeSnap.data() : null;
    await updateDoc(ref, {
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await writeAuditLog('delete', collectionName, id, before, null);
  },

  // Hard delete for categories (no trash)
  async hardDelete(collectionName, id) {
    await deleteDoc(doc(db, collectionName, id));
    await writeAuditLog('hard_delete', collectionName, id, null, null);
  },

  // ── MEDIA ─────────────────────────────────────────────────────────────────

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file',          file);
    formData.append('upload_preset', CLOUD_PRESET);
    formData.append('folder',        CLOUD_FOLDER);

    let res;
    try {
      res = await fetch(CLOUD_URL, { method: 'POST', body: formData });
    } catch (err) {
      throw new Error(`Network error during upload: ${err.message}`);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body?.error?.message ?? `Cloudinary upload failed (HTTP ${res.status})`,
      );
    }

    const data = await res.json();
    return {
      url:       data.secure_url,
      filename:  file.name,
      mimeType:  file.type,
      sizeBytes: file.size,
    };
  },

  async deleteFile(url) {
    try {
      const user  = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      await fetch(
        `/api/media?deleteUrl=${encodeURIComponent(url)}`,
        {
          method:      'DELETE',
          credentials: 'include',
          headers:     token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
    } catch (err) {
      console.warn('[firebase-adapter] deleteFile failed (non-fatal):', err.message);
    }
  },

  // ── REAL-TIME ─────────────────────────────────────────────────────────────

  subscribe(collectionName, callback) {
    if (collectionName === 'settings') {
      return onSnapshot(doc(db, 'settings', 'global'), (snap) => {
        callback(snap.exists() ? [snapToItem(snap)] : []);
      });
    }

    if (collectionName === 'categories') {
      const q = query(col(db, 'categories'), orderBy('name', 'asc'));
      return onSnapshot(q, (snap) => {
        callback(snap.docs.map(snapToItem));
      });
    }

    const q = buildQuery(collectionName);
    return onSnapshot(q, (snap) => {
      callback(sortDesc(snap.docs.map(snapToItem)));
    });
  },
};