import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z
  .object({
    name:            z.string().min(2, 'Name must be at least 2 characters').max(80),
    email:           z.string().email('Enter a valid email address'),
    password:        z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8),
    role:            z.enum(['customer', 'worker'], { required_error: 'Select a role' }),
    // New in Parts 2/3: collected at signup, synced straight to Firestore so
    // the profile page shows them immediately without requiring a second save.
    phone:           z
      .string()
      .min(10, 'Enter a valid mobile number (minimum 10 digits)')
      .max(20)
      .regex(/^\+?[\d\s\-()·]{10,20}$/, 'Enter a valid mobile number')
      .or(z.literal('')),
    gender:          z.enum(
      ['', 'male', 'female', 'non-binary', 'prefer-not-to-say'],
      { errorMap: () => ({ message: 'Please select a gender' }) },
    ).optional(),
    categoryId:      z.string().optional(),
    categoryName:    z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path:    ['confirmPassword'],
  })
  .refine(
    (d) => d.role !== 'worker' || (!!d.categoryId && d.categoryId.length > 0),
    {
      message: 'Workers must select a service category',
      path:    ['categoryId'],
    },
  );

// ─── Section types ────────────────────────────────────────────────────────────

export const heroSectionSchema = z.object({
  id:                 z.string().uuid('Section id must be a valid UUID'),
  type:               z.literal('hero'),
  heading:            z.string().max(200).default(''),
  subheading:         z.string().max(400).default(''),
  backgroundImageUrl: z.string().url().or(z.literal('')).default(''),
  ctaText:            z.string().max(60).default(''),
  ctaLink:            z.string().max(500).default(''),
});

export const textSectionSchema = z.object({
  id:      z.string().uuid('Section id must be a valid UUID'),
  type:    z.literal('text'),
  heading: z.string().max(200).default(''),
  body:    z.string().max(10_000).default(''),
});

export const galleryImageSchema = z.object({
  url:     z.string().url().or(z.literal('')).default(''),
  caption: z.string().max(200).default(''),
});

export const gallerySectionSchema = z.object({
  id:      z.string().uuid('Section id must be a valid UUID'),
  type:    z.literal('gallery'),
  heading: z.string().max(200).optional().default(''),
  images:  z.array(galleryImageSchema).max(50).default([]),
});

export const contactSectionSchema = z.object({
  id:      z.string().uuid('Section id must be a valid UUID'),
  type:    z.literal('contact'),
  email:   z.string().email().or(z.literal('')).default(''),
  phone:   z.string().max(30).default(''),
  address: z.string().max(500).default(''),
});

export const customSectionSchema = z.object({
  id:   z.string().uuid('Section id must be a valid UUID'),
  type: z.literal('custom'),
  html: z.string().max(50_000).default(''),
});

export const anySectionSchema = z.discriminatedUnion('type', [
  heroSectionSchema,
  textSectionSchema,
  gallerySectionSchema,
  contactSectionSchema,
  customSectionSchema,
]);

export const sectionsArraySchema = z
  .array(z.any())
  .transform((items) => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        const result = anySectionSchema.safeParse(item);
        if (result.success) return result.data;
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[sectionsArraySchema] Invalid section stripped:', item);
        }
        return null;
      })
      .filter(Boolean);
  });

// ─── Page ─────────────────────────────────────────────────────────────────────

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const pageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(slugRegex, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  metaDescription: z.string().max(160).optional().default(''),
  isPublished:     z.boolean().default(false),
  sections:        sectionsArraySchema,
});

// ─── Category ─────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(60)
    .regex(/^[a-zA-Z0-9\s&'\-]+$/, 'Invalid characters in name'),
  description: z.string().max(200).optional().default(''),
  icon:        z.string().max(10).optional().default('wrench'),
  status:      z.enum(['active', 'pending', 'disabled']).default('active'),
  submittedBy: z.string().optional().default(''),
});

// ─── Worker profile ───────────────────────────────────────────────────────────

/**
 * Document verification schema — one entry per document type.
 * url: Cloudinary secure_url
 * status: pending | verified | rejected (set by admin)
 */
const documentSchema = z.object({
  url:        z.string().url().or(z.literal('')).default(''),
  status:     z.enum(['pending', 'verified', 'rejected']).default('pending'),
  uploadedAt: z.string().optional().default(''),
});

export const workerProfileSchema = z.object({
  name:            z.string().min(2, 'Name is required').max(80),
  bio:             z.string().max(500, 'Bio must be 500 characters or fewer').default(''),
  categoryId:      z.string().min(1, 'Please select a service category'),
  categoryName:    z.string().optional().default(''),

  // Required — worker must set a starting price > 0
  pricePerHour:    z
    .number({ invalid_type_error: 'Enter a valid starting amount' })
    .min(1, 'Starting amount is required (must be greater than 0)')
    .max(100_000),

  isAvailable:     z.boolean().default(false),
  profileImageUrl: z.string().url().or(z.literal('')).optional().default(''),

  // Required — mobile number with basic validation
  phone: z
    .string()
    .min(10, 'Mobile number is required')
    .regex(
      /^\+?[\d\s\-()]{10,20}$/,
      'Enter a valid mobile number (10 digits minimum)',
    ),

  // ── Experience — required fields ──────────────────────────────────────────
  experienceYears: z
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(1, 'Experience is required (enter at least 1 year, or 1 if less than a year)')
    .max(50),
  experienceDesc: z
    .string()
    .max(400, 'Keep experience description under 400 characters')
    .optional()
    .default(''),

  // ── Document verification — single doc type ───────────────────────────────
  // Only one document is stored; selectedDocType indicates which one.
  selectedDocType: z
    .enum(['pan', 'aadhaar', 'workId'], {
      errorMap: () => ({ message: 'Please select a document type' }),
    })
    .optional(),
  documents: z
    .object({
      pan:     documentSchema.optional(),
      aadhaar: documentSchema.optional(),
      workId:  documentSchema.optional(),
    })
    .optional()
    .default({}),
});

// ─── Booking ──────────────────────────────────────────────────────────────────
//
// PART 9 FIX: workerId/categoryId removed from this schema. They were bound to
// hidden <input> fields with NO visible error UI, yet confirmBooking() always
// reads worker.id / worker.categoryId directly from the `worker` prop — never
// from form state. So validating them here served no purpose except creating
// a silent dead-end: if a worker record happened to have an empty categoryId
// (e.g. profile created before categories existed, or never assigned one),
// the whole "Review Booking" button would appear to do nothing, with no error
// shown anywhere. The actual worker identity is validated structurally by
// `if (!worker) return null;` further down in BookingModal instead.

export const bookingSchema = z.object({
  description: z
    .string()
    .min(10, 'Please describe what you need (at least 10 characters)')
    .max(500),
  scheduledAt: z.string().min(1, 'Please select a date and time'),
  address:     z.string().min(5, 'Please enter a full address'),
  notes:       z.string().max(300).optional().default(''),
});

// ─── Review ───────────────────────────────────────────────────────────────────

export const reviewSchema = z.object({
  rating: z
    .number({ invalid_type_error: 'Please select a rating' })
    .int()
    .min(1, 'Rating must be at least 1 star')
    .max(5),
  comment: z.string().max(500).optional().default(''),
});

// ─── Media ────────────────────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  siteName:     z.string().min(1, 'Site name is required').max(100),
  logoUrl:      z.string().url().or(z.literal('')).optional().default(''),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid hex color')
    .default('#3B82F6'),
  socialLinks: z
    .object({
      facebook:  z.string().url().or(z.literal('')).optional().default(''),
      twitter:   z.string().url().or(z.literal('')).optional().default(''),
      instagram: z.string().url().or(z.literal('')).optional().default(''),
    })
    .default({}),
  contactEmail:         z.string().email().or(z.literal('')).optional().default(''),
  footerText:           z.string().max(500).optional().default(''),
  razorpayKeyId:        z.string().optional().default(''),
  razorpayKeySecret:    z.string().optional().default(''),
  razorpayMerchantName: z.string().optional().default(''),
  razorpaySupportEmail: z.string().email().or(z.literal('')).optional().default(''),
  platformFeePercent: z
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0).max(50).default(10),

  platformFeeType: z
    .enum(['percent', 'fixed'])
    .default('percent'),

  platformFixed: z
    .number({ invalid_type_error: 'Enter a valid amount' })
    .min(0).max(10000).default(0),
  gstPercent: z
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0).max(30).default(18),

  // Part 6 — Admin GST Mode System.
  // Controls whether GST/CGST/SGST/IGST terminology is shown to
  // customers/workers across the platform. Default OFF (simplified labels).
  // The gstPercent rate above is ALWAYS stored/used in calculations
  // regardless of this toggle — only display labels change.
  gstModeEnabled: z.boolean().default(false),

  withdrawalFee: z
    .number({ invalid_type_error: 'Withdrawal fee must be a number' })
    .min(0).max(30).default(11),
  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z
    .string().max(300).optional()
    .default('We are performing scheduled maintenance. Please check back soon.'),
  estimatedReturn: z.string().optional().default(''),
});

// ─── Job Request ──────────────────────────────────────────────────────────────

export const jobRequestSchema = z.object({
  categoryId:    z.string().min(1, 'Please select a service category'),
  categoryName:  z.string().optional(),
  description:   z.string().min(20).max(500),
  address:       z.string().min(10),
  preferredDate: z.string().min(1, 'Please select your preferred date'),
  budget:        z.string().optional(),
});

// ─── Quote ────────────────────────────────────────────────────────────────────

export const quoteSchema = z.object({
  basePrice: z
    .number({ invalid_type_error: 'Enter a valid price' })
    .min(1).max(500_000),
  message: z.string().max(300).optional().default(''),
});