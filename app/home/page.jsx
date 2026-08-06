import { redirect } from 'next/navigation';

/**
 * /home → redirect to / (canonical home route)
 *
 * This exists so that 404 "Back to Home" buttons, external links,
 * and bookmarks pointing to /home continue to work correctly.
 * The real homepage is app/(public)/page.jsx at the / route.
 *
 * No redirect loop: / is served by (public)/page.jsx which does NOT
 * redirect anywhere. Only /home redirects to /.
 */
export default function HomeRedirectPage() {
  redirect('/');
}
