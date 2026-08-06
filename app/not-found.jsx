import Link from 'next/link';

export const metadata = {
  title: '404 — Page Not Found',
};

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-lg">
        {/* Large 404 */}
        <p className="text-[120px] font-black text-gray-200 leading-none select-none mb-2">
          404
        </p>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h1>

        <p className="text-gray-500 text-lg leading-relaxed mb-8">
          The page you're looking for doesn't exist, has been moved, or hasn't
          been published yet.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-xl text-white font-semibold btn-brand transition-all"
            style={{ backgroundColor: 'var(--color-brand, #3B82F6)' }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}