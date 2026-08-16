import Link from "next/link";

/**
 * A real, if intentionally small, homepage now that /services exists to
 * send people to — Part 2's placeholder is gone. Kept to one job (get a
 * customer into the search) rather than building out a full marketing
 * page: header/footer/nav chrome across the whole site is Part 16's job,
 * and building a rich homepage now, then redoing its surrounding chrome
 * later, would mean redesigning it twice.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <span className="text-xs font-medium uppercase tracking-widest text-muted">
        HYS Services
      </span>
      <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Book a verified local professional
      </h1>
      <p className="max-w-md text-sm text-muted">
        Plumbers, electricians, and other home-service workers near you —
        starting prices shown up front, price may increase based on the
        work.
      </p>
      <Link
        href="/services"
        className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Find a worker
      </Link>
    </main>
  );
}
