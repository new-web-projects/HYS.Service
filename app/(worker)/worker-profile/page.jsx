'use client';

import { useEffect, useState, useRef }    from 'react';
import { useForm }                        from 'react-hook-form';
import { zodResolver }                    from '@hookform/resolvers/zod';
import { useRouter }                      from 'next/navigation';
import Link                              from 'next/link';
import { usePublicAuthStore }             from '@/store/publicAuthStore';
import { useUserStore }                   from '@/store/userStore';
import { useContentStore }                from '@/store/contentStore';
import { useToast }                       from '@/components/shared/Toast';
import { getCurrentPosition }             from '@/lib/location';
import { workerProfileSchema }            from '@/lib/validators/schemas';
import LoadingSpinner                     from '@/components/shared/LoadingSpinner';
import {
  LocationIcon, UploadIcon, SpinnerIcon,
  CheckIcon,
}                                         from '@/components/icons';

// ─── Cloudinary config ────────────────────────────────────────────────────────

const CLOUDINARY_URL    = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_URL;
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER ?? 'site-images';

async function uploadToCloudinary(file, folder = CLOUDINARY_FOLDER) {
  if (!CLOUDINARY_URL || !CLOUDINARY_PRESET) {
    throw new Error(
      'Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_UPLOAD_URL and ' +
      'NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env.local',
    );
  }
  const body = new FormData();
  body.append('file',          file);
  body.append('upload_preset', CLOUDINARY_PRESET);
  body.append('folder',        folder);

  const res = await fetch(CLOUDINARY_URL, { method: 'POST', body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Upload failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.secure_url;
}

// ─── Common skills ────────────────────────────────────────────────────────────

const COMMON_SKILLS = [
  'Repair', 'Installation', 'Cleaning', 'Maintenance',
  'Inspection', 'Emergency Service', '24/7 Available', 'Free Estimate',
];

// ─── Document types ───────────────────────────────────────────────────────────

const DOC_TYPES = [
  {
    key:    'pan',
    label:  'PAN Card',
    hint:   'Clear photo or scan of your PAN card.',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    key:    'aadhaar',
    label:  'Aadhaar Card',
    hint:   'Both sides of your Aadhaar card.',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    key:    'workId',
    label:  'Work / Trade ID',
    hint:   'Any professional ID, licence, or trade certificate.',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
];

const GENDER_OPTIONS = [
  { value: '',                  label: 'Select gender…'    },
  { value: 'male',              label: 'Male'              },
  { value: 'female',            label: 'Female'            },
  { value: 'non-binary',        label: 'Non-binary'        },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const STATUS_BADGES = {
  pending:  { label: 'Under Review', cls: 'bg-amber-100  text-amber-700'  },
  verified: { label: 'Verified',     cls: 'bg-green-100  text-green-700'  },
  rejected: { label: 'Rejected',     cls: 'bg-red-100    text-red-600'    },
};

// ─── Profile image uploader ───────────────────────────────────────────────────

function ProfileImageUploader({ currentUrl, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState(currentUrl ?? '');
  const [error,     setError]     = useState('');
  const inputRef                  = useRef(null);

  useEffect(() => {
    if (currentUrl && !preview) setPreview(currentUrl);
  }, [currentUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(file) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('Please select a JPG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }
    setError('');
    setUploading(true);
    const local = URL.createObjectURL(file);
    setPreview(local);
    try {
      const url = await uploadToCloudinary(file, `${CLOUDINARY_FOLDER}/profiles`);
      setPreview(url);
      onUpload(url);
    } catch (err) {
      setError(err.message);
      setPreview(currentUrl ?? '');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-start gap-5">
      <div
        className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed
                   border-gray-300 overflow-hidden flex items-center justify-center
                   shrink-0 cursor-pointer hover:border-blue-400 transition-colors relative"
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Profile preview"
               className="w-full h-full object-cover"
               onError={() => setPreview('')} />
        ) : (
          <div className="text-center px-2">
            <UploadIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400 leading-tight">Click to upload</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <SpinnerIcon className="w-6 h-6 text-blue-500" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-700 text-sm mb-1">Profile Photo</p>
        <p className="text-gray-400 text-xs mb-3 leading-relaxed">
          JPG, PNG or WebP · Max 5 MB.
        </p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border
                     border-blue-200 text-blue-700 hover:bg-blue-100 text-sm
                     font-semibold transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <><SpinnerIcon className="w-4 h-4" /> Uploading…</>
          ) : (
            <><UploadIcon className="w-4 h-4" />{preview ? 'Change Photo' : 'Upload Photo'}</>
          )}
        </button>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

// ─── Single document uploader ─────────────────────────────────────────────────
//
// FIX: Replaced the 3-document upload system with a single-document selector.
// Worker selects ONE document type, then uploads only that document.
// This reduces confusion and makes the verification flow cleaner.

function SingleDocumentUploader({ documents, selectedDocType, onSelectType, onDocumentUpload }) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');
  const inputRef                  = useRef(null);

  const selectedConfig = DOC_TYPES.find((d) => d.key === selectedDocType);
  const existingDoc    = selectedDocType ? documents?.[selectedDocType] : null;
  const badge          = existingDoc?.status ? STATUS_BADGES[existingDoc.status] : null;

  async function handleFile(file) {
    if (!file || !selectedDocType) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select an image or PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be smaller than 10 MB.');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const url = await uploadToCloudinary(file, `${CLOUDINARY_FOLDER}/worker-documents`);
      onDocumentUpload(selectedDocType, {
        url,
        status:     'pending',
        uploadedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">

      {/* Step 1 — Select document type */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Choose Document Type <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DOC_TYPES.map(({ key, label, hint }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectType(key);
                setError('');
              }}
              className={`flex flex-col items-start gap-1 p-4 rounded-2xl border-2
                          text-left transition-all
                          ${selectedDocType === key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
            >
              {/* Radio indicator */}
              <div className="flex items-center gap-2 w-full">
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center
                               justify-center shrink-0 transition-colors
                               ${selectedDocType === key
                                 ? 'border-blue-500'
                                 : 'border-gray-400'}`}
                >
                  {selectedDocType === key && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </span>
                <span className={`font-semibold text-sm
                                  ${selectedDocType === key
                                    ? 'text-blue-700'
                                    : 'text-gray-700'}`}>
                  {label}
                </span>

                {/* Show verified badge if this doc was already uploaded & verified */}
                {documents?.[key]?.status && (
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px]
                                    font-bold shrink-0
                                    ${STATUS_BADGES[documents[key].status]?.cls}`}>
                    {STATUS_BADGES[documents[key].status]?.label}
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-xs pl-6 leading-snug">{hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Upload field (only shown after type is selected) */}
      {selectedDocType && selectedConfig && (
        <div className={`rounded-2xl border-2 p-4 transition-colors
                         ${existingDoc?.url
                           ? 'border-green-200 bg-green-50'
                           : 'border-blue-200 bg-blue-50/40'}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-800 text-sm">
                  Upload {selectedConfig.label}
                </p>
                {badge && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                    ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-xs mt-0.5">{selectedConfig.hint}</p>
              {existingDoc?.url && (
                <a
                  href={existingDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-xs font-medium hover:underline
                             mt-1 inline-block"
                >
                  View uploaded file ↗
                </a>
              )}
            </div>

            <div className="shrink-0">
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm
                            font-semibold transition-colors disabled:opacity-50
                            ${existingDoc?.url
                              ? 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                              : 'bg-blue-600 border border-blue-600 text-white hover:bg-blue-700'}`}
              >
                {uploading ? (
                  <><SpinnerIcon className="w-4 h-4" /> Uploading…</>
                ) : existingDoc?.url ? (
                  <><CheckIcon className="w-4 h-4" /> Replace</>
                ) : (
                  <><UploadIcon className="w-4 h-4" /> Upload</>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={selectedConfig.accept}
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs mt-2">{error}</p>
          )}
        </div>
      )}

      {/* Privacy notice */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border
                      border-amber-200 rounded-xl">
        <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none"
             viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25
               0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
               00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-amber-700 text-xs leading-relaxed">
          Documents are stored securely and only reviewed by platform admins for
          verification. They are never shared with customers.
        </p>
      </div>
    </div>
  );
}

// ─── Location section ─────────────────────────────────────────────────────────

function LocationSection({ currentLocation, onLocationSet }) {
  const [detecting,     setDetecting]     = useState(false);
  const [locationError, setLocationError] = useState('');
  const [manualAddress, setManualAddress] = useState(
    currentLocation?.address ?? '',
  );
  const [mode, setMode] = useState('auto');

  async function handleDetect() {
    setDetecting(true);
    setLocationError('');
    try {
      const pos = await getCurrentPosition();
      onLocationSet({ lat: pos.lat, lng: pos.lng, address: 'Location detected via GPS' });
      setManualAddress('Location detected via GPS');
    } catch (err) {
      setLocationError(err.message);
      setMode('manual');
    } finally {
      setDetecting(false);
    }
  }

  function handleManualSave() {
    if (!manualAddress.trim()) {
      setLocationError('Please enter your location.');
      return;
    }
    setLocationError('');
    onLocationSet({ lat: null, lng: null, address: manualAddress.trim() });
  }

  const hasLocation = currentLocation?.lat || currentLocation?.address;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div>
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <LocationIcon className="w-5 h-5 text-gray-400" />
          Your Location <span className="text-red-500 text-base">*</span>
        </h2>
        <p className="text-gray-400 text-sm mt-0.5">
          Required — used to show you to nearby customers. Your precise coordinates are never public.
        </p>
      </div>

      {hasLocation ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border
                        border-green-200 rounded-xl">
          <CheckIcon className="w-4 h-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-green-800 text-sm">Location Set</p>
            <p className="text-green-600 text-xs truncate mt-0.5">
              {currentLocation.address ||
                (currentLocation.lat
                  ? `${Number(currentLocation.lat).toFixed(4)}, ${Number(currentLocation.lng).toFixed(4)}`
                  : '—')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onLocationSet(null)}
            className="text-green-500 hover:text-green-700 text-sm font-medium
                       transition-colors shrink-0"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 text-sm font-medium">Location required</p>
          <p className="text-red-600 text-xs mt-0.5">
            Customers cannot find you until you add a location.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {['auto', 'manual'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2
                        transition-colors
                        ${mode === m
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            {m === 'auto' ? 'Use GPS' : 'Enter Manually'}
          </button>
        ))}
      </div>

      {mode === 'auto' && (
        <button
          type="button"
          onClick={handleDetect}
          disabled={detecting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                     border-2 border-blue-200 bg-blue-50 text-blue-700 font-semibold
                     text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          {detecting ? (
            <><SpinnerIcon className="w-4 h-4" /> Detecting…</>
          ) : (
            <><LocationIcon className="w-4 h-4" /> Use My Current Location (GPS)</>
          )}
        </button>
      )}

      {mode === 'manual' && (
        <div className="space-y-3">
          <input
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            placeholder="e.g. Indiranagar, Bangalore, Karnataka"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900
                       text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                       placeholder-gray-400"
          />
          <button
            type="button"
            onClick={handleManualSave}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold
                       text-sm rounded-xl transition-colors flex items-center
                       justify-center gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            Save Location
          </button>
        </div>
      )}

      {locationError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 text-sm">{locationError}</p>
        </div>
      )}
    </div>
  );
}

// ─── Profile completion progress ──────────────────────────────────────────────

function ProfileCompletion({ fields }) {
  const completed = fields.filter(Boolean).length;
  const total     = fields.length;
  const pct       = Math.round((completed / total) * 100);

  const color =
    pct === 100 ? 'bg-green-500' :
    pct >= 60   ? 'bg-blue-500'  :
    pct >= 30   ? 'bg-amber-500' :
                  'bg-red-500';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="font-bold text-gray-900 text-sm">Profile Completion</p>
        <span className={`text-sm font-bold ${
          pct === 100 ? 'text-green-600' :
          pct >= 60   ? 'text-blue-600'  :
          'text-amber-600'
        }`}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct < 100 && (
        <p className="text-gray-400 text-xs mt-2">
          Complete all required fields to appear in customer searches.
        </p>
      )}
      {pct === 100 && (
        <p className="text-green-600 text-xs mt-2 font-medium">
          ✓ Profile complete — you're visible to customers!
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkerProfilePage() {
  const router   = useRouter();
  const { user } = usePublicAuthStore();
  const { updateWorkerProfile, getWorkerProfile } = useUserStore();
  const {
    categories,
    categoriesLoading,
    subscribeCategories,
    unsubscribeCategories,
  }              = useContentStore();
  const toast    = useToast((s) => s.show);

  const [loading,           setLoading]           = useState(true);
  const [saving,            setSaving]            = useState(false);
  const [currentLocation,   setCurrentLocation]   = useState(null);
  const [selectedSkills,    setSelectedSkills]    = useState([]);
  const [profileImageUrl,   setProfileImageUrl]   = useState('');
  const [documents,         setDocuments]         = useState({});
  const [selectedDocType,   setSelectedDocType]   = useState(null);
  const [locationError,     setLocationError]     = useState('');
  const [gender,            setGender]            = useState('');
  const [genderError,       setGenderError]       = useState('');

  // See two-effect category pre-fill fix below
  const [loadedProfile, setLoadedProfile] = useState(null);

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(workerProfileSchema),
    defaultValues: {
      name:            '',
      bio:             '',
      categoryId:      '',
      categoryName:    '',
      startingPrice:   0,
      isAvailable:     false,
      phone:           '',
      experienceYears: 0,
      experienceDesc:  '',
      selectedDocType: undefined,
      gender:          '',
    },
  });

  const isAvailable    = watch('isAvailable');
  const categoryId     = watch('categoryId');
  const bio            = watch('bio');
  const experienceDesc = watch('experienceDesc');
  const watchPhone     = watch('phone');
  const watchPrice     = watch('startingPrice');
  const watchExp       = watch('experienceYears');

  // ── Profile completion inputs ──────────────────────────────────────────────
  const completionFields = [
    !!watchPhone,                                       // Mobile number
    !!categoryId,                                       // Category
    !!(currentLocation?.address || currentLocation?.lat), // Location
    !!(watchExp > 0),                                   // Experience
    !!(watchPrice > 0),                                 // Starting price
    !!gender,                                           // Gender
    !!(Object.values(documents).some((d) => d?.url)),   // At least 1 document
  ];

  // Subscribe to categories
  useEffect(() => {
    subscribeCategories();
    return () => unsubscribeCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load worker profile
  useEffect(() => {
    if (!user?.uid) return;
    getWorkerProfile(user.uid)
      .then((p) => {
        if (p) {
          setLoadedProfile(p);
          setCurrentLocation(p.location ?? null);
          setSelectedSkills(p.skills ?? []);
          setProfileImageUrl(p.profileImageUrl ?? '');
          setDocuments(p.documents ?? {});
          setGender(p.gender ?? '');

          // Restore selectedDocType from saved documents
          const savedDocType = Object.keys(p.documents ?? {}).find(
            (k) => p.documents[k]?.url,
          );
          if (savedDocType) setSelectedDocType(savedDocType);

          reset({
            name:            p.name            ?? user.name ?? '',
            bio:             p.bio             ?? '',
            categoryId:      p.categoryId      ?? '',
            categoryName:    p.categoryName    ?? '',
            startingPrice:   p.startingPrice   ?? p.pricePerHour ?? 0,
            isAvailable:     p.isAvailable     ?? false,
            phone:           p.phone           ?? '',
            experienceYears: p.experienceYears ?? 0,
            experienceDesc:  p.experienceDesc  ?? '',
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('[WorkerProfilePage]', err.message);
        setLoading(false);
      });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Category pre-fill: re-set once BOTH profile + categories are ready
  useEffect(() => {
    if (!loadedProfile || categoriesLoading || categories.length === 0) return;
    if (loadedProfile.categoryId) {
      setValue('categoryId',   loadedProfile.categoryId,   { shouldDirty: false });
      setValue('categoryName', loadedProfile.categoryName ?? '', { shouldDirty: false });
    }
  }, [loadedProfile, categories, categoriesLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCategoryChange(e) {
    const id  = e.target.value;
    const cat = activeCategories.find((c) => c.id === id);
    setValue('categoryId',   id,          { shouldValidate: true });
    setValue('categoryName', cat?.name ?? '');
  }

  function toggleSkill(skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  function handleDocumentUpload(docKey, docData) {
    // Clear other doc types when a new one is uploaded (single-doc system)
    setDocuments({ [docKey]: docData });
  }

  function handleSelectDocType(type) {
    setSelectedDocType(type);
  }

  async function onSubmit(data) {
    // Extra validation for fields not in react-hook-form
    if (!gender) {
      setGenderError('Please select a gender.');
      document.getElementById('gender-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setGenderError('');

    if (!currentLocation?.address && !currentLocation?.lat) {
      setLocationError('Location is required. Please set your location.');
      document.getElementById('location-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setLocationError('');

    setSaving(true);
    try {
      await updateWorkerProfile(user.uid, {
        ...data,
        gender:          gender,
        skills:          selectedSkills,
        location:        currentLocation ?? null,
        profileImageUrl: profileImageUrl,
        documents:       documents,
        selectedDocType: selectedDocType ?? null,
      });
      toast('Profile saved!', 'success');
      router.push('/worker-dashboard');
    } catch (err) {
      toast(err.message ?? 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm ' +
    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
    'focus:border-transparent transition-colors bg-white';

  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1.5';

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" label="Loading profile…" />
      </div>
    );
  }

  const activeCategories = categories.filter((c) => c.status === 'active');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <Link href="/worker-dashboard"
              className="text-gray-400 hover:text-gray-600 text-sm font-medium mb-3
                         inline-flex items-center gap-1 transition-colors">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Your Profile</h1>
        <p className="text-gray-500 mt-1">
          Complete all required fields to appear in customer searches.
        </p>
      </div>

      {/* Profile completion */}
      <div className="mb-6">
        <ProfileCompletion fields={completionFields} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

        {/* ── Profile Photo ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Profile Photo</h2>
          <ProfileImageUploader
            currentUrl={profileImageUrl}
            onUpload={(url) => setProfileImageUrl(url)}
          />
        </div>

        {/* ── Basic Information ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-900">Basic Information</h2>

          {/* Full Name */}
          <div>
            <label className={labelCls}>Full Name *</label>
            <input {...register('name')} placeholder="Your full name"
                   className={inputCls} />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Email — read-only from Firebase Auth */}
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={user?.email ?? ''}
              readOnly
              className={`${inputCls} bg-gray-50 text-gray-400 cursor-not-allowed`}
            />
            <p className="text-xs text-gray-400 mt-1">
              Email is linked to your account and cannot be changed here.
            </p>
          </div>

          {/* Mobile Number — required */}
          <div>
            <label className={labelCls}>
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              {...register('phone')}
              type="tel"
              placeholder="+91 98765 43210"
              className={`${inputCls} ${errors.phone ? 'border-red-400 ring-1 ring-red-400' : ''}`}
            />
            {errors.phone ? (
              <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                Used by customers to contact you directly.
              </p>
            )}
          </div>

          {/* Gender — required */}
          <div id="gender-section">
            <label className={labelCls}>
              Gender <span className="text-red-500">*</span>
            </label>
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                if (e.target.value) setGenderError('');
              }}
              className={`${inputCls} ${genderError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
            >
              {GENDER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value} disabled={value === ''}>
                  {label}
                </option>
              ))}
            </select>
            {genderError && (
              <p className="mt-1 text-xs text-red-500">{genderError}</p>
            )}
          </div>

          {/* Service Category — required */}
          <div>
            <label className={labelCls}>
              Service Category <span className="text-red-500">*</span>
            </label>
            {categoriesLoading ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border
                              border-gray-200 bg-gray-50">
                <SpinnerIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-sm">Loading categories…</span>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={handleCategoryChange}
                className={`${inputCls} ${errors.categoryId ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              >
                <option value="">Select your service category…</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-500">{errors.categoryId.message}</p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className={labelCls}>Bio</label>
            <textarea
              {...register('bio')}
              placeholder="Tell customers about your experience, skills, and work style…"
              className={`${inputCls} min-h-[90px] resize-y`}
              rows={3}
            />
            <p className="text-right text-xs text-gray-300 mt-1">
              {bio?.length ?? 0} / 500
            </p>
          </div>

          {/* Starting Price — required */}
          <div>
            <label className={labelCls}>
              Starting Price (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400
                               font-semibold text-sm">₹</span>
              <input
                {...register('startingPrice', { valueAsNumber: true })}
                type="number" min="1" step="50" placeholder="500"
                className={`${inputCls} pl-8 ${errors.startingPrice ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Shown as "Starting from ₹{watch('startingPrice') || 0}". Price may vary based on work.
            </p>
            {errors.startingPrice && (
              <p className="mt-1 text-xs text-red-500">{errors.startingPrice.message}</p>
            )}
          </div>
        </div>

        {/* ── Experience — required ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-bold text-gray-900">
              Experience <span className="text-red-500">*</span>
            </h2>
            <p className="text-gray-400 text-sm mt-0.5">
              Required — helps customers trust your profile.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Years of Experience <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  {...register('experienceYears', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="50"
                  placeholder="1"
                  className={`${inputCls} ${errors.experienceYears ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2
                                 text-gray-400 text-sm">yrs</span>
              </div>
              {errors.experienceYears && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.experienceYears.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Experience Description</label>
            <textarea
              {...register('experienceDesc')}
              placeholder="e.g. 5 years of residential plumbing in Bangalore. Specialised in bathroom fitting and pipe repairs."
              className={`${inputCls} min-h-[80px] resize-y`}
              rows={3}
            />
            <p className="text-right text-xs text-gray-300 mt-1">
              {experienceDesc?.length ?? 0} / 400
            </p>
            {errors.experienceDesc && (
              <p className="mt-1 text-xs text-red-500">
                {errors.experienceDesc.message}
              </p>
            )}
          </div>
        </div>

        {/* ── Skills ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-1">Skills</h2>
          <p className="text-sm text-gray-500 mb-4">Select all that apply:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_SKILLS.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-medium
                            transition-all
                            ${selectedSkills.includes(skill)
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {selectedSkills.includes(skill) && (
                  <CheckIcon className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                )}
                {skill}
              </button>
            ))}
          </div>
        </div>

        {/* ── Location — required ────────────────────────────────────── */}
        <div id="location-section">
          <LocationSection
            currentLocation={currentLocation}
            onLocationSet={(loc) => {
              setCurrentLocation(loc);
              if (loc) setLocationError('');
            }}
          />
          {locationError && (
            <p className="mt-2 text-xs text-red-500 px-1">{locationError}</p>
          )}
        </div>

        {/* ── Document Verification — single doc ────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-bold text-gray-900">Document Verification</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              Upload <strong>one</strong> document to verify your identity. Earn a
              verified badge and build customer trust.
              Admin reviews documents within 24–48 hours.
            </p>
          </div>
          <SingleDocumentUploader
            documents={documents}
            selectedDocType={selectedDocType}
            onSelectType={handleSelectDocType}
            onDocumentUpload={handleDocumentUpload}
          />
        </div>

        {/* ── Availability ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6
                        flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900">Available for Bookings</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isAvailable
                ? 'You are visible to customers right now.'
                : 'You are currently hidden from search results.'}
            </p>
          </div>
          <div
            role="switch"
            aria-checked={isAvailable}
            onClick={() => setValue('isAvailable', !isAvailable)}
            className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors
                        duration-200 shrink-0
                        ${isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md
                          transition-transform duration-200
                          ${isAvailable ? 'translate-x-8' : 'translate-x-1'}`}
            />
          </div>
        </div>

        {/* ── Save ──────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold
                       rounded-xl transition-colors disabled:opacity-40
                       flex items-center justify-center gap-2"
          >
            {saving ? (
              <><SpinnerIcon className="w-5 h-5" /> Saving…</>
            ) : (
              <><CheckIcon className="w-5 h-5" /> Save Profile</>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push('/worker-dashboard')}
            className="px-6 py-4 border-2 border-gray-200 text-gray-600 font-semibold
                       rounded-xl hover:border-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
