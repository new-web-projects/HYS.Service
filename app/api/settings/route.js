export const dynamic = 'force-dynamic';

import { NextResponse }                                            from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin, getAuthPayload } from '@/lib/auth/middleware';

// BUG FIX: this used to omit every marketplace-specific field (Razorpay
// keys, platform fee, GST, withdrawal fee, maintenance mode/message,
// estimatedReturn). The Prisma Settings model didn't have columns for them
// either, so the settings admin page — which has always collected and sent
// all of these — would report "Settings saved successfully" while server
// mode silently discarded everything except the basic site-branding fields.
// Now that lib/prisma/schema.prisma has columns for them, this route reads
// and writes the full set.
function normalizeSettings(s) {
  return {
    id:                   s.id,
    siteName:             s.siteName,
    logoUrl:              s.logoUrl ?? '',
    primaryColor:         s.primaryColor,
    socialLinks:          s.socialLinksJson,
    contactEmail:         s.contactEmail ?? '',
    footerText:           s.footerText   ?? '',
    razorpayKeyId:        s.razorpayKeyId,
    razorpayKeySecret:    s.razorpayKeySecret,
    razorpayMerchantName: s.razorpayMerchantName,
    razorpaySupportEmail: s.razorpaySupportEmail,
    platformFeePercent:   s.platformFeePercent,
    platformFeeType:      s.platformFeeType,
    platformFixed:        s.platformFixed,
    gstPercent:           s.gstPercent,
    gstModeEnabled:       s.gstModeEnabled,
    withdrawalFee:        s.withdrawalFee,
    maintenanceMode:      s.maintenanceMode,
    maintenanceMessage:   s.maintenanceMessage,
    estimatedReturn:      s.estimatedReturn,
    updatedAt:            s.updatedAt.toISOString(),
    _backendMode:         process.env.NEXT_PUBLIC_BACKEND_MODE,
  };
}

export async function GET(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const { default: prisma } = await import('@/lib/prisma/client');

  // Upsert: create the default settings row if it doesn't exist yet
  // (all marketplace fields fall back to their Prisma @default() values
  // when omitted here, same as before this fix).
  const settings = await prisma.settings.upsert({
    where:  { id: 1 },
    create: {
      id:             1,
      siteName:       'My Site',
      primaryColor:   '#3B82F6',
      socialLinksJson: {},
    },
    update: {},
  });

  return NextResponse.json(normalizeSettings(settings));
}

export async function PUT(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const payload = await getAuthPayload(req);

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 }); }

  const { default: prisma } = await import('@/lib/prisma/client');

  const before = await prisma.settings.findUnique({ where: { id: 1 } });

  // Shared field set for both the create and update branches — mirrors the
  // defaults in lib/validators/schemas.js's settingsSchema so behaviour
  // matches what the settings form already validates client-side.
  const fields = {
    siteName:             body.siteName             ?? 'My Site',
    logoUrl:              body.logoUrl              ?? null,
    primaryColor:         body.primaryColor         ?? '#3B82F6',
    socialLinksJson:      body.socialLinks          ?? {},
    contactEmail:         body.contactEmail         ?? null,
    footerText:           body.footerText           ?? null,
    razorpayKeyId:        body.razorpayKeyId        ?? '',
    razorpayKeySecret:    body.razorpayKeySecret    ?? '',
    razorpayMerchantName: body.razorpayMerchantName ?? '',
    razorpaySupportEmail: body.razorpaySupportEmail ?? '',
    platformFeePercent:   body.platformFeePercent   ?? 10,
    platformFeeType:      body.platformFeeType      ?? 'percent',
    platformFixed:        body.platformFixed        ?? 0,
    gstPercent:           body.gstPercent           ?? 18,
    gstModeEnabled:       body.gstModeEnabled       ?? false,
    withdrawalFee:        body.withdrawalFee        ?? 11,
    maintenanceMode:      body.maintenanceMode      ?? false,
    maintenanceMessage:   body.maintenanceMessage   ??
      'We are performing scheduled maintenance. Please check back soon.',
    estimatedReturn:      body.estimatedReturn      ?? '',
  };

  const updated = await prisma.settings.upsert({
    where:  { id: 1 },
    create: { id: 1, ...fields },
    update: fields,
  });

  await prisma.auditLog.create({
    data: {
      adminId:    payload.uid,
      action:     'update',
      collection: 'settings',
      documentId: '1',
      beforeJson: before ? { siteName: before.siteName } : null,
      afterJson:  { siteName: updated.siteName },
    },
  });

  return NextResponse.json(normalizeSettings(updated));
}