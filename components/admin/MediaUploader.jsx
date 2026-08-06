'use client';

import { useState, useRef, useCallback } from 'react';
import { useContentStore }               from '@/store/contentStore';
import { useAuthStore }                  from '@/store/authStore';
import { useToast }                      from '@/components/shared/Toast';
import { useConfirm }                    from '@/components/shared/ConfirmDialog';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/validators/schemas';
import { FolderIcon, PageIcon, CheckIcon } from '@/components/icons';

function formatBytes(bytes) {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaUploader({ onSelect }) {
  const user       = useAuthStore((s) => s.user);
  const { media, mediaLoading, uploadMedia, deleteMedia } = useContentStore();
  const toast      = useToast((s) => s.show);
  const confirm    = useConfirm((s) => s.confirm);

  const [dragging,       setDragging]       = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState(null);
  const [retryFile,      setRetryFile]      = useState(null);
  const [copiedId,       setCopiedId]       = useState(null);
  const inputRef = useRef(null);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateFile(file) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return `File type "${file.type}" is not allowed. Allowed: images and PDF.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `"${file.name}" exceeds the 5 MB limit (${formatBytes(file.size)}).`;
    }
    return null;
  }

  // ── Upload logic ───────────────────────────────────────────────────────────

  const doUpload = useCallback(async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast(validationError, 'error');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setRetryFile(null);

    try {
      await uploadMedia(file, user?.uid ?? 'unknown');
      toast('File uploaded successfully.', 'success');
    } catch (err) {
      // Upload failed — media record was NOT created (store contract guarantees this)
      setUploadError(err.message ?? 'Upload failed. Check your connection and try again.');
      setRetryFile(file);
      toast(err.message ?? 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  }, [uploadMedia, user, toast]);

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  }

  function onDragOver(e) { e.preventDefault(); setDragging(true); }
  function onDragLeave()  { setDragging(false); }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = '';
  }

  // ── Copy URL ───────────────────────────────────────────────────────────────

  async function copyUrl(id, url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast('Copy failed — clipboard access denied.', 'error');
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(item) {
    const ok = await confirm(
      `Delete "${item.filename}"?`,
      'This removes the media record and attempts to delete the underlying file.',
    );
    if (!ok) return;
    try {
      await deleteMedia(item.id, item.url);
      toast('Media deleted.', 'success');
    } catch (err) {
      toast(err.message ?? 'Delete failed.', 'error');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Upload zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors
                    ${dragging
                      ? 'border-brand-500 bg-brand-500/5'
                      : 'border-admin-border hover:border-brand-500/40 hover:bg-admin-card'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          className="hidden"
          onChange={onFileChange}
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-admin-muted text-sm">Uploading…</p>
          </div>
        ) : (
          <>
            <FolderIcon className="w-10 h-10 mb-3 mx-auto text-admin-muted/60" />
            <p className="text-admin-text font-medium">Drop a file here or click to browse</p>
            <p className="text-admin-muted text-xs mt-1">Images and PDFs — max 5 MB</p>
          </>
        )}
      </div>

      {/* Upload failure recovery */}
      {uploadError && retryFile && (
        <div className="flex items-center gap-4 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">Upload failed</p>
            <p className="text-red-300/70 text-xs mt-0.5">{uploadError}</p>
          </div>
          <button
            onClick={() => doUpload(retryFile)}
            disabled={uploading}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30
                       text-red-300 text-xs font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => { setUploadError(null); setRetryFile(null); }}
            className="text-red-400/60 hover:text-red-400 transition-colors text-lg leading-none"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Media grid */}
      {mediaLoading && (
        <div className="text-center py-8 text-admin-muted">Loading media…</div>
      )}

      {!mediaLoading && media.length === 0 && (
        <p className="text-admin-muted text-sm text-center py-8">No media uploaded yet.</p>
      )}

      {!mediaLoading && media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {media.map((item) => {
            const isImage = item.mimeType?.startsWith('image/');
            return (
              <div
                key={item.id}
                className="group relative bg-admin-bg border border-admin-border rounded-xl overflow-hidden aspect-square"
              >
                {/* Thumbnail */}
                {isImage ? (
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                    <PageIcon className="w-7 h-7 text-admin-muted/60" />
                    <span className="text-xs text-admin-muted text-center truncate w-full">
                      {item.filename}
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity
                                flex flex-col items-center justify-center gap-2 p-2">
                  {onSelect && (
                    <button
                      onClick={() => onSelect(item.url)}
                      className="w-full px-2 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Select
                    </button>
                  )}
                  <button
                    onClick={() => copyUrl(item.id, item.url)}
                    className="w-full px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg
                               flex items-center justify-center gap-1.5"
                  >
                    {copiedId === item.id ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5" />
                        Copied!
                      </>
                    ) : 'Copy URL'}
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="w-full px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium rounded-lg"
                  >
                    Delete
                  </button>
                </div>

                {/* File size badge */}
                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {formatBytes(item.sizeBytes)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}