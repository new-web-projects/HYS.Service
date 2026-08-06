import Link from 'next/link';

export const metadata = { title: '404 — Page Not Found' };

export default function PublicNotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-lg">
        <p className="text-[120px] font-black text-gray-200 leading-none select-none mb-2">
          404
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h1>
        <p className="text-gray-500 text-lg leading-relaxed mb-8">
          The page you're looking for doesn't exist, has been moved, or hasn't been published yet.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl text-white font-semibold transition-all btn-brand"
          style={{ backgroundColor: 'var(--color-brand, #3B82F6)' }}
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}