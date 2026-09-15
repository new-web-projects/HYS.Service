import { getSettings } from "@/lib/settings";

export default async function MaintenancePage() {
  const settings = await getSettings();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">We&apos;ll be right back</h1>
      <p className="text-sm text-muted">
        {settings.maintenanceMessage || "HYS Services is undergoing scheduled maintenance. Please check back shortly."}
      </p>
    </main>
  );
}