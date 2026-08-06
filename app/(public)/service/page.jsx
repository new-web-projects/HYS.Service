import { redirect } from 'next/navigation';

/**
 * /service → redirect to /services (canonical route)
 * Fixes the Quick Action "Browse Workers" crash in customer dashboard.
 */
export default function ServiceRedirectPage() {
  redirect('/services');
}