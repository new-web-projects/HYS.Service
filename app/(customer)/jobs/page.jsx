import { redirect } from 'next/navigation';

/**
 * /jobs → redirect to /job-requests (canonical route)
 * Fixes the Quick Action "My Job Requests" crash in customer dashboard.
 */
export default function JobsRedirectPage() {
  redirect('/job-requests');
}