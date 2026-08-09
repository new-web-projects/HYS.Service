export default function Home() {
  const env = process.env.NODE_ENV;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-xs font-medium uppercase tracking-widest text-muted">
        Version 2 — Part 2: Foundation
      </span>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        HYS Services
      </h1>
      <p className="max-w-md text-sm text-muted">
        The project foundation is running ({env}). Marketplace pages arrive
        in later Parts.
      </p>
    </main>
  );
}
