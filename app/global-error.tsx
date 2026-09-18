/** File Path: app/global-error.tsx */

"use client";

import { ErrorDisplay } from "@/components/shared/ErrorDisplay";

// Next.js requires global-error.tsx to render its own <html>/<body> since
// it replaces the root layout entirely — this only fires when the root
// layout itself throws, which app/error.tsx can't catch.
export default function GlobalErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <ErrorDisplay error={error} reset={reset} componentName="GlobalErrorBoundary" />
      </body>
    </html>
  );
}