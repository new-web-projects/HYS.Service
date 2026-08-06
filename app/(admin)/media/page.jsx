'use client';

import {
  useEffect, useState, useRef,
  useMemo, useCallback, memo,
}                                          from 'react';
import { useContentStore }                 from '@/store/contentStore';
import { useAuthStore }                    from '@/store/authStore';
import { useToast }                        from '@/components/shared/Toast';
import { useConfirm }                      from '@/components/shared/ConfirmDialog';
import LoadingSpinner, { MediaGridSkeleton } from '@/components/shared/LoadingSpinner';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
}                                          from '@/lib/validators/schemas';
import { MediaIcon, PageIcon, FolderIcon, CopyIcon, TrashIcon } from '@/components/icons';

const MEDIA_PAGE_SIZE = 30;

/**
 * PERFORMANCE: Individual media item is memoized.
 * When a new item is uploaded, only the new item renders — not the whole grid.
 */
const MediaItem = memo(function MediaItem({ item, onCopy, onDelete }) {
  const [imageLoaded, setImageLoaded]   = useState(false);
  const [imageError,  setImageError]    = useState(false);
  const isImage = item.mimeType?.startsWith('image/');

  return (
    <div className="group relative bg-admin-bg border border-admin-border rounded-xl
                     overflow-hidden aspect-square hover:border-brand-500/50 transition-colors">
      {/* Lazy-loaded image */}
      {isImage && !imageError ? (
        <>
          {!imageLoaded && (
            <div className="absolute inset-0 skeleton-dark" />
          )}
          <img
            src={item.url}
            alt={item.filename}
            loading="lazy"    // Browser-native lazy loading
            decoding="async"  // Non-blocking decode
            className={`w-full h-full object-cover transition-opacity duration-300
                        ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-admin-muted/50">
          {imageError
            ? <MediaIcon className="w-8 h-8" />
            : item.mimeType === 'application/pdf'
              ? <PageIcon className="w-8 h-8" />
              : <FolderIcon className="w-8 h-8" />}
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60
                       transition-colors duration-200 flex items-end justify-between
                       p-2 gap-2">
        <p className="text-white text-xs font-medium truncate opacity-0
                       group-hover:opacity-100 transition-opacity">
          {item.filename}
        </p>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onCopy(item.url)}
            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs
                       backdrop-blur-sm transition-colors"
            title="Copy URL"
          >
            <CopyIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg text-white text-xs
                       backdrop-blur-sm transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default function MediaPage() {
  const { media, mediaLoading, subscribeMedia, unsubscribeMedia, uploadMedia, deleteMedia } =
    useContentStore();
  const { user }   = useAuthStore();
  const toast      = useToast((s) => s.show);
  const confirm    = useConfirm((s) => s.confirm);

  const [uploading,    setUploading]    = useState(false);
  const [dragOver,     setDragOver]     = useState(false);
  const [search,       setSearch]       = useState('');
  const [visibleCount, setVisibleCount] = useState(MEDIA_PAGE_SIZE);

  const sentinelRef = useRef(null);

  useEffect(() => {
    subscribeMedia();
    return () => unsubscribeMedia();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * PERFORMANCE: IntersectionObserver-based infinite scroll.
   * Instead of loading all media items at once, we show MEDIA_PAGE_SIZE items
   * and load more as the user scrolls to the bottom.
   * This is much faster than pagination for media grids — no button to click.
   */
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + MEDIA_PAGE_SIZE);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  const filteredMedia = useMemo(() =>
    media.filter((m) =>
      !search || m.filename.toLowerCase().includes(search.toLowerCase()),
    ),
    [media, search],
  );

  const visibleMedia = useMemo(() =>
    filteredMedia.slice(0, visibleCount),
    [filteredMedia, visibleCount],
  );

  const hasMore = visibleCount < filteredMedia.length;

  const handleCopy = useCallback((url) => {
    navigator.clipboard.writeText(url).catch(() => {});
    toast('URL copied to clipboard!', 'success');
  }, [toast]);

  const handleDelete = useCallback(async (item) => {
    const ok = await confirm(
      `Delete "${item.filename}"?`,
      'This will permanently remove the file from Cloudinary.',
    );
    if (!ok) return;
    try {
      await deleteMedia(item.id, item.url);
      toast(`"${item.filename}" deleted.`, 'success');
    } catch (err) {
      toast(err.message ?? 'Delete failed.', 'error');
    }
  }, [confirm, deleteMedia, toast]);

  async function handleFiles(files) {
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      // Client-side validation before upload
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast(`"${file.name}" — unsupported file type.`, 'error');
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast(`"${file.name}" exceeds the 5 MB limit.`, 'error');
        continue;
      }

      setUploading(true);
      try {
        await uploadMedia(file, user?.uid ?? 'unknown');
        toast(`"${file.name}" uploaded.`, 'success');
      } catch (err) {
        toast(err.message ?? `Upload failed: ${file.name}`, 'error');
      } finally {
        setUploading(false);
      }
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Media Library</h1>
          <p className="text-admin-muted text-sm mt-0.5">
            {media.length} file{media.length !== 1 ? 's' : ''} uploaded
          </p>
        </div>
        <div className="relative">
          <input
            id="file-input"
            type="file"
            multiple
            accept={ALLOWED_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <label
            htmlFor="file-input"
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white
                       text-sm font-semibold rounded-xl cursor-pointer transition-colors
                       flex items-center gap-2"
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white
                                 rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload Files
              </>
            )}
          </label>
        </div>
      </div>

      {/* Drag and drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors
                    ${dragOver
                      ? 'border-brand-500 bg-brand-600/5'
                      : 'border-admin-border hover:border-admin-muted/50'}`}
      >
        <MediaIcon className="w-8 h-8 mb-2 mx-auto text-admin-muted/60" />
        <p className="text-admin-muted font-medium">
          Drag files here or{' '}
          <label htmlFor="file-input" className="text-brand-400 hover:text-brand-300
                                                  cursor-pointer underline">
            click to browse
          </label>
        </p>
        <p className="text-admin-muted/60 text-xs mt-1">
          JPG, PNG, GIF, WebP, SVG, PDF — max 5 MB each
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted"
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by filename…"
          className="w-full pl-9 pr-4 py-2.5 bg-admin-card border border-admin-border
                     rounded-xl text-admin-text text-sm placeholder-admin-muted/40
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Media grid */}
      {mediaLoading ? (
        <MediaGridSkeleton count={15} />
      ) : filteredMedia.length === 0 ? (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
          <MediaIcon className="w-12 h-12 mb-4 mx-auto text-admin-muted/40" />
          <p className="text-admin-muted font-medium">
            {search ? `No files matching "${search}"` : 'No files uploaded yet'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {visibleMedia.map((item) => (
              <MediaItem
                key={item.id}
                item={item}
                onCopy={handleCopy}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Sentinel element for IntersectionObserver infinite scroll */}
          <div ref={sentinelRef} className="h-10 flex items-center justify-center">
            {hasMore && (
              <LoadingSpinner size="sm" label={`Loading more…`} />
            )}
          </div>

          <p className="text-center text-admin-muted text-sm">
            Showing {visibleMedia.length} of {filteredMedia.length} files
          </p>
        </>
      )}
    </div>
  );
}