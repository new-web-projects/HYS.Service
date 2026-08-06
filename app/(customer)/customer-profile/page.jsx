'use client';

import { useState, useRef, useEffect }  from 'react';
import { useRouter }                    from 'next/navigation';
import Link                             from 'next/link';
import { usePublicAuthStore }           from '@/store/publicAuthStore';
import { useToast }                     from '@/components/shared/Toast';
import { getCurrentPosition, detectCity } from '@/lib/location';
import LoadingSpinner                   from '@/components/shared/LoadingSpinner';
import {
  CheckIcon, SpinnerIcon, LocationIcon, UploadIcon,
}                                       from '@/components/icons';

// ─── Cloudinary ───────────────────────────────────────────────────────────────

const CLOUDINARY_URL    = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_URL;
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER ?? 'profiles';

async function uploadToCloudinary(file) {
  if (!CLOUDINARY_URL || !CLOUDINARY_PRESET)
    throw new Error('Cloudinary is not configured.');
  const body = new FormData();
  body.append('file',          file);
  body.append('upload_preset', CLOUDINARY_PRESET);
  body.append('folder',        CLOUDINARY_FOLDER);
  const res  = await fetch(CLOUDINARY_URL, { method: 'POST', body });
  if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
  return (await res.json()).secure_url;
}

// ─── Gender options ───────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: '',                  label: 'Select gender…'     },
  { value: 'male',              label: 'Male'               },
  { value: 'female',            label: 'Female'             },
  { value: 'non-binary',        label: 'Non-binary'         },
  { value: 'prefer-not-to-say', label: 'Prefer not to say'  },
];

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ url, name, uploading, onClick }) {
  return (
    <div
      onClick={onClick}
      className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-100
                 border-2 border-dashed border-gray-300 cursor-pointer
                 hover:border-blue-400 transition-colors shrink-0"
    >
      {url ? (
        <img src={url} alt={name}
             className="w-full h-full object-cover"
             onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center
                        text-gray-400 text-xs gap-1">
          <UploadIcon className="w-6 h-6" />
          <span>Photo</span>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
          <SpinnerIcon className="w-6 h-6 text-blue-500" />
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerProfilePage() {
  const router                                    = useRouter();
  const { user, updateUserLocation, refreshUser } = usePublicAuthStore();
  const toast                                     = useToast((s) => s.show);
  const fileRef                                   = useRef(null);

  const [saving,       setSaving]       = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [errors,       setErrors]       = useState({});

  const [form, setForm] = useState({
    name:            '',
    phone:           '',
    gender:          '',
    address:         '',
    profileImageUrl: '',
  });

  // Populate form from auth store once user is available
  useEffect(() => {
    if (user) {
      setForm({
        name:            user.name                  ?? '',
        phone:           user.phone                 ?? '',
        gender:          user.gender                ?? '',
        address:         user.location?.address     ?? '',
        profileImageUrl: user.profileImageUrl       ?? user.avatarUrl ?? '',
      });
    }
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    // Clear error for field as user types
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate() {
    const errs = {};

    if (!form.name.trim())
      errs.name = 'Full name is required.';

    if (!form.phone.trim())
      errs.phone = 'Mobile number is required.';
    else if (!/^\+?[\d\s\-()\u00B7]{10,20}$/.test(form.phone.trim()))
      errs.phone = 'Enter a valid mobile number (minimum 10 digits).';

    if (!form.gender)
      errs.gender = 'Please select a gender.';

    if (!form.address.trim())
      errs.address = 'Location is required.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Photo upload ──────────────────────────────────────────────────────────

  async function handleImageFile(file) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast('Please select a JPG, PNG, WebP, or GIF.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be smaller than 5 MB.', 'error');
      return;
    }
    setUploading(true);
    setForm((f) => ({ ...f, profileImageUrl: URL.createObjectURL(file) }));
    try {
      const url = await uploadToCloudinary(file);
      setForm((f) => ({ ...f, profileImageUrl: url }));
    } catch (err) {
      toast(err.message ?? 'Upload failed.', 'error');
      setForm((f) => ({ ...f, profileImageUrl: user?.profileImageUrl ?? '' }));
    } finally {
      setUploading(false);
    }
  }

  // ── GPS detection ─────────────────────────────────────────────────────────

  async function detectLocation() {
    setDetectingLoc(true);
    setErrors((e) => ({ ...e, address: '' }));
    try {
      const pos  = await getCurrentPosition();
      const city = detectCity(pos.lat, pos.lng);
      const addr = city ?? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
      setForm((f) => ({ ...f, address: addr }));
      await updateUserLocation(pos.lat, pos.lng, city ?? null);
      toast('Location updated!', 'success');
    } catch (err) {
      setErrors((e) => ({ ...e, address: err.message }));
    } finally {
      setDetectingLoc(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!user?.uid) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const { db }                        = await import('@/lib/firebase/config');
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

      await updateDoc(doc(db, 'users', user.uid), {
        name:            form.name.trim(),
        phone:           form.phone.trim(),
        gender:          form.gender,
        profileImageUrl: form.profileImageUrl,
        'location.address': form.address.trim(),
        updatedAt:       Timestamp.now(),
      });

      await refreshUser();
      toast('Profile saved!', 'success');
      router.push('/customer-dashboard');
    } catch (err) {
      toast(err.message ?? 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  function inputCls(field) {
    return (
      'w-full px-4 py-3 rounded-xl border text-gray-900 text-sm ' +
      'placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ' +
      'transition-colors bg-white ' +
      (errors[field]
        ? 'border-red-400 focus:ring-red-400'
        : 'border-gray-200 focus:ring-blue-500')
    );
  }

  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1.5';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div>
        <Link href="/customer-dashboard"
              className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          All fields marked <span className="text-red-500">*</span> are required.
        </p>
      </div>

      {/* Photo */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 mb-4">Profile Photo</h2>
        <div className="flex items-start gap-5">
          <Avatar
            url={form.profileImageUrl}
            name={form.name}
            uploading={uploading}
            onClick={() => fileRef.current?.click()}
          />
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-3 leading-relaxed">
              JPG, PNG or WebP · Max 5 MB.
            </p>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50
                         border border-blue-200 text-blue-700 text-sm font-semibold
                         hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <UploadIcon className="w-4 h-4" />
              {uploading ? 'Uploading…' : form.profileImageUrl ? 'Change' : 'Upload Photo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => handleImageFile(e.target.files?.[0])}
            />
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Personal Information</h2>

        {/* Full Name — required */}
        <div>
          <label className={labelCls}>
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Your full name"
            className={inputCls('name')}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Email — read-only */}
        <div>
          <label className={labelCls}>Email</label>
          <input
            value={user?.email ?? ''}
            disabled
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                       bg-gray-50 text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">
            Email cannot be changed here. Contact support if needed.
          </p>
        </div>

        {/* Mobile Number — required */}
        <div>
          <label className={labelCls}>
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            type="tel"
            placeholder="+91 9876 543210"
            className={inputCls('phone')}
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* Gender — required */}
        <div>
          <label className={labelCls}>
            Gender <span className="text-red-500">*</span>
          </label>
          <select
            value={form.gender}
            onChange={(e) => handleChange('gender', e.target.value)}
            className={inputCls('gender')}
          >
            {GENDER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value} disabled={value === ''}>
                {label}
              </option>
            ))}
          </select>
          {errors.gender && (
            <p className="mt-1 text-xs text-red-500">{errors.gender}</p>
          )}
        </div>
      </div>

      {/* Location — required */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <LocationIcon className="w-5 h-5 text-gray-400" />
            Your Location <span className="text-red-500">*</span>
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Used to show nearest workers to you.
          </p>
        </div>

        {user?.location?.lat && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border
                          border-green-200 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <p className="text-green-700 text-xs font-medium">
              GPS location saved
              {user.location.address ? ` — ${user.location.address}` : ''}
            </p>
          </div>
        )}

        <div>
          <label className={labelCls}>
            Area / City <span className="text-red-500">*</span>
          </label>
          <input
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="e.g. Indiranagar, Bangalore"
            className={inputCls('address')}
          />
          {errors.address && (
            <p className="mt-1 text-xs text-red-500">{errors.address}</p>
          )}
        </div>

        <button
          type="button"
          onClick={detectLocation}
          disabled={detectingLoc}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                     border-2 border-blue-200 bg-blue-50 text-blue-700 font-semibold
                     text-sm hover:bg-blue-100 transition-colors disabled:opacity-60"
        >
          <LocationIcon className="w-4 h-4" />
          {detectingLoc ? 'Detecting…' : 'Use My Current Location (GPS)'}
        </button>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold
                     rounded-xl transition-colors disabled:opacity-40
                     flex items-center justify-center gap-2"
        >
          {saving
            ? <><SpinnerIcon className="w-5 h-5" /> Saving…</>
            : <><CheckIcon   className="w-5 h-5" /> Save Profile</>}
        </button>
        <button
          onClick={() => router.push('/customer-dashboard')}
          className="px-6 py-4 border-2 border-gray-200 text-gray-600 font-semibold
                     rounded-xl hover:border-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>

    </div>
  );
}
