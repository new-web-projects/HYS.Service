'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm, Controller }                       from 'react-hook-form';
import { zodResolver }                               from '@hookform/resolvers/zod';
import { useRouter }                                 from 'next/navigation';
import { useContentStore }                           from '@/store/contentStore';
import { useToast }                                  from '@/components/shared/Toast';
import SectionEditor                                 from '@/components/admin/SectionEditor';
import { pageSchema, slugRegex }                     from '@/lib/validators/schemas';
import { WarningIcon }                               from '@/components/icons';

function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

/**
 * @param {{ page: Object | null }} props
 * page = null for new page creation
 */
export default function PageEditorForm({ page }) {
  const router = useRouter();
  const toast  = useToast((s) => s.show);
  const { pages, createPage, updatePage, getPageById } = useContentStore();

  const [saving,          setSaving]          = useState(false);
  const [slugManual,      setSlugManual]       = useState(!!page?.slug);
  const [staleWarning,    setStaleWarning]     = useState(false);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState(page?.updatedAt ?? null);

  /**
   * BUG FIX (Bug 1): The root cause of "sections not saving" is a React
   * stale closure. When react-hook-form calls onSubmit, it captures the
   * sections value from the time the form was initialized — not the current
   * value after the user has added/edited sections.
   *
   * Fix: Store sections in BOTH useState (for rendering) and useRef (for
   * the submit handler). The ref is always current regardless of closures.
   */
  const [sections,    setSections]    = useState(page?.sections ?? []);
  const sectionsRef                   = useRef(page?.sections ?? []);

  // Keep ref synchronized with state on every change
  const handleSectionsChange = useCallback((newSections) => {
    setSections(newSections);
    sectionsRef.current = newSections; // Ref update is synchronous — no stale closure
  }, []);

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } =
    useForm({
      resolver: zodResolver(pageSchema),
      defaultValues: {
        title:           page?.title           ?? '',
        slug:            page?.slug            ?? '',
        metaDescription: page?.metaDescription ?? '',
        sections:        [],      // Sections are managed via sectionsRef, not RHF
        isPublished:     page?.isPublished      ?? false,
      },
    });

  const titleValue = watch('title');
  const slugValue  = watch('slug');

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && titleValue) {
      setValue('slug', generateSlug(titleValue), { shouldValidate: true });
    }
  }, [titleValue, slugManual, setValue]);

  // Client-side slug uniqueness check
  const slugConflict = (() => {
    if (!slugValue || errors.slug) return null;
    const conflict = pages.find(
      (p) =>
        p.slug === slugValue &&
        p.deletedAt == null &&
        (!page || p.id !== page.id),
    );
    return conflict ? `Slug "${slugValue}" is already in use.` : null;
  })();

  async function checkFreshness() {
    if (!page?.id) return true;
    try {
      const fresh = await getPageById(page.id);
      if (fresh.updatedAt !== loadedUpdatedAt) {
        setStaleWarning(true);
        return false;
      }
    } catch {
      // Non-blocking — allow save if freshness check fails
    }
    return true;
  }

  /**
   * BUG FIX (Bug 1): Read from sectionsRef.current — NOT from the sections
   * state variable. The state variable is stale inside this callback due to
   * how React closures work with react-hook-form's handleSubmit wrapper.
   * sectionsRef.current is always the latest value.
   *
   * BUG FIX (Bug 3): Toast is called immediately after await resolves —
   * no additional async operations between the save and the toast.
   */
  async function onSubmit(formData) {
    if (slugConflict) {
      toast(slugConflict, 'error');
      return;
    }

    setSaving(true);

    // Read from ref — always current, never stale
    const currentSections = sectionsRef.current;

    const payload = {
      title:           formData.title,
      slug:            formData.slug,
      metaDescription: formData.metaDescription ?? '',
      isPublished:     formData.isPublished,
      sections:        currentSections,
    };

    try {
      if (page?.id) {
        const isFresh = await checkFreshness();
        if (!isFresh) {
          // Toast immediately on conflict detection
          toast('Page was modified by another user. Reload before saving.', 'warning', 0);
          setSaving(false);
          return;
        }
        await updatePage(page.id, { ...payload, _loadedUpdatedAt: loadedUpdatedAt });
        setLoadedUpdatedAt(new Date().toISOString());
        // Toast fires immediately after the save completes (Bug 3 fix)
        toast('Page saved successfully!', 'success');
      } else {
        const newPage = await createPage(payload);
        toast('Page created!', 'success');
        router.replace(`/pages/${newPage.id}/edit`);
      }
    } catch (err) {
      if (err.message?.toLowerCase().includes('stale') ||
          err.message?.toLowerCase().includes('another user')) {
        setStaleWarning(true);
        toast('Conflict: reload the page before saving.', 'error', 0);
      } else {
        toast(err.message ?? 'Failed to save page.', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-lg bg-admin-bg border border-admin-border text-admin-text ' +
    'text-sm placeholder-admin-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
    'focus:border-transparent disabled:opacity-40 transition-colors';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

      {/* Stale warning banner */}
      {staleWarning && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30
                        rounded-xl px-4 py-3 animate-fade-in">
          <WarningIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300">Page modified by another user</p>
            <p className="text-amber-300/70 text-xs mt-0.5">
              Your changes were not saved. Reload to see the latest version.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30
                       text-amber-300 text-xs font-semibold rounded-lg transition-colors"
          >
            Reload
          </button>
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-admin-muted mb-1.5">
          Page Title *
        </label>
        <input
          id="title"
          {...register('title')}
          placeholder="My Page Title"
          className={inputCls}
        />
        {errors.title && (
          <p className="mt-1.5 text-xs text-red-400">{errors.title.message}</p>
        )}
      </div>

      {/* Slug */}
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-admin-muted mb-1.5">
          URL Slug *
          <span className="ml-2 text-admin-muted/50 font-normal text-xs">
            auto-generated from title
          </span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-admin-muted text-sm shrink-0">/</span>
          <input
            id="slug"
            {...register('slug')}
            placeholder="my-page-title"
            className={`${inputCls} flex-1`}
            onChange={(e) => {
              setSlugManual(true);
              register('slug').onChange(e);
            }}
          />
        </div>
        {errors.slug && (
          <p className="mt-1.5 text-xs text-red-400">{errors.slug.message}</p>
        )}
        {slugConflict && !errors.slug && (
          <p className="mt-1.5 text-xs text-red-400">{slugConflict}</p>
        )}
      </div>

      {/* Meta description */}
      <div>
        <label htmlFor="metaDescription" className="block text-sm font-medium text-admin-muted mb-1.5">
          Meta Description
          <span className="ml-2 text-admin-muted/50 font-normal text-xs">max 160 chars</span>
        </label>
        <textarea
          id="metaDescription"
          {...register('metaDescription')}
          placeholder="Brief description for search engines…"
          className={`${inputCls} resize-none`}
          rows={2}
        />
        {errors.metaDescription && (
          <p className="mt-1.5 text-xs text-red-400">{errors.metaDescription.message}</p>
        )}
      </div>

      {/* Sections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-admin-muted">
            Page Sections
          </label>
          <span className="text-xs text-admin-muted">
            {sections.length} section{sections.length !== 1 ? 's' : ''}
          </span>
        </div>
        {/*
          SectionEditor calls onChange with the updated sections array.
          We pass handleSectionsChange which updates BOTH state (for render)
          and ref (for the submit handler). This is the core Bug 1 fix.
        */}
        <SectionEditor sections={sections} onChange={handleSectionsChange} />
      </div>

      {/* Publish toggle + Save */}
      <div className="flex items-center justify-between pt-4 border-t border-admin-border">
        <Controller
          name="isPublished"
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors duration-200
                            ${field.value ? 'bg-brand-600' : 'bg-admin-border'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm
                              transition-transform duration-200
                              ${field.value ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </div>
              <div>
                <span className="text-sm font-semibold text-admin-text">
                  {field.value ? 'Published' : 'Draft'}
                </span>
                <p className="text-xs text-admin-muted">
                  {field.value ? 'Visible on public site' : 'Only visible to admins'}
                </p>
              </div>
            </label>
          )}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/pages')}
            className="px-4 py-2.5 text-admin-muted hover:text-admin-text text-sm
                       font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm
                       font-semibold rounded-xl transition-colors disabled:opacity-40
                       disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white
                               rounded-full animate-spin" />
            )}
            {saving ? 'Saving…' : page?.id ? 'Save Changes' : 'Create Page'}
          </button>
        </div>
      </div>
    </form>
  );
}