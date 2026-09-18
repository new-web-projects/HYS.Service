/** File Path: app/error.tsx */

"use client";

import { ErrorDisplay } from "@/components/shared/ErrorDisplay";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorDisplay error={error} reset={reset} componentName="RootErrorBoundary" />;
}