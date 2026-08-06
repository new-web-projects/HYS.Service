'use client';

import { useState, useCallback, useId } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  LayoutIcon, TextIcon, MediaIcon, PhoneIcon, CodeIcon,
  InfoIcon, WarningIcon, MailIcon, LocationIcon,
} from '@/components/icons';

// ── Default field values ───────────────────────────────────────────────────

const TYPE_DEFAULTS = {
  hero:    { heading: '', subheading: '', backgroundImageUrl: '', ctaText: '', ctaLink: '' },
  text:    { heading: '', body: '' },
  gallery: { images: [] },
  contact: { email: '', phone: '', address: '' },
  custom:  { html: '' },
};

const TYPE_META = {
  hero:    { label: 'Hero Banner',    Icon: LayoutIcon, desc: 'Full-width banner with headline and CTA' },
  text:    { label: 'Text Block',     Icon: TextIcon,   desc: 'Heading with rich body content'          },
  gallery: { label: 'Image Gallery',  Icon: MediaIcon,  desc: 'Grid of images with captions'            },
  contact: { label: 'Contact Info',   Icon: PhoneIcon,  desc: 'Email, phone, and address'               },
  custom:  { label: 'Custom HTML',    Icon: CodeIcon,   desc: 'Raw HTML (script tags are stripped)'     },
};

// ── Shared styles ──────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-admin-bg border border-admin-border text-admin-text ' +
  'text-sm placeholder-admin-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
  'focus:border-transparent transition-colors';

const labelCls = 'block text-xs font-semibold text-admin-muted uppercase tracking-wider mb-1.5';

// ── Field components ───────────────────────────────────────────────────────

/**
 * BUG FIX (Bug 1): Every input is fully controlled (value + onChange).
 * onChange calls parent.onUpdate IMMEDIATELY on every keystroke.
 * This ensures the section state is always current when the form submits.
 */
function SectionFields({ section, onUpdate }) {
  // Helper that merges a single field change and notifies parent immediately
  const set = (field) => (e) => onUpdate({ ...section, [field]: e.target.value });

  switch (section.type) {
    case 'hero':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Heading *</label>
            <input
              className={inputCls}
              value={section.heading ?? ''}
              onChange={set('heading')}
              placeholder="Main headline"
            />
          </div>
          <div>
            <label className={labelCls}>Subheading</label>
            <input
              className={inputCls}
              value={section.subheading ?? ''}
              onChange={set('subheading')}
              placeholder="Supporting text"
            />
          </div>
          <div>
            <label className={labelCls}>Background Image URL</label>
            <input
              className={inputCls}
              value={section.backgroundImageUrl ?? ''}
              onChange={set('backgroundImageUrl')}
              placeholder="https://res.cloudinary.com/..."
            />
            {section.backgroundImageUrl && (
              <div className="mt-2 h-16 rounded-lg overflow-hidden bg-admin-border">
                <img
                  src={section.backgroundImageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>CTA Text</label>
              <input
                className={inputCls}
                value={section.ctaText ?? ''}
                onChange={set('ctaText')}
                placeholder="Get Started"
              />
            </div>
            <div>
              <label className={labelCls}>CTA Link</label>
              <input
                className={inputCls}
                value={section.ctaLink ?? ''}
                onChange={set('ctaLink')}
                placeholder="/contact"
              />
            </div>
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Heading *</label>
            <input
              className={inputCls}
              value={section.heading ?? ''}
              onChange={set('heading')}
              placeholder="Section heading"
            />
          </div>
          <div>
            <label className={labelCls}>Body Content *</label>
            <textarea
              className={`${inputCls} min-h-[100px] resize-y`}
              value={section.body ?? ''}
              onChange={set('body')}
              placeholder="Write your content here..."
              rows={4}
            />
            <p className="text-right text-xs text-admin-muted/50 mt-1">
              {(section.body ?? '').length} chars
            </p>
          </div>
        </div>
      );

    case 'gallery':
      return (
        <div className="space-y-3">
          {(section.images ?? []).map((img, i) => (
            <div
              key={i}
              className="flex gap-2 items-start bg-admin-bg border border-admin-border rounded-xl p-3"
            >
              <div className="flex-1 space-y-2">
                <input
                  className={inputCls}
                  value={img.url ?? ''}
                  placeholder="Image URL"
                  onChange={(e) => {
                    const imgs = section.images.map((im, j) =>
                      j === i ? { ...im, url: e.target.value } : im,
                    );
                    onUpdate({ ...section, images: imgs });
                  }}
                />
                <input
                  className={inputCls}
                  value={img.caption ?? ''}
                  placeholder="Caption (optional)"
                  onChange={(e) => {
                    const imgs = section.images.map((im, j) =>
                      j === i ? { ...im, caption: e.target.value } : im,
                    );
                    onUpdate({ ...section, images: imgs });
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdate({ ...section, images: section.images.filter((_, j) => j !== i) })
                }
                className="mt-1 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10
                           rounded-lg transition-colors"
                aria-label="Remove image"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onUpdate({
                ...section,
                images: [...(section.images ?? []), { url: '', caption: '' }],
              })
            }
            className="flex items-center gap-2 text-brand-400 hover:text-brand-300 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Image
          </button>
        </div>
      );

    case 'contact':
      return (
        <div className="space-y-3">
          {[
            { field: 'email',   label: 'Email',   placeholder: 'hello@example.com' },
            { field: 'phone',   label: 'Phone',   placeholder: '+1 555 000 0000'   },
            { field: 'address', label: 'Address', placeholder: '123 Main St'        },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className={labelCls}>{label}</label>
              <input
                className={inputCls}
                value={section[field] ?? ''}
                onChange={set(field)}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
      );

    case 'custom':
      return (
        <div className="space-y-2">
          <label className={labelCls}>
            Custom HTML
            <span className="ml-2 text-amber-400 font-normal normal-case inline-flex items-center gap-1">
              <WarningIcon className="w-3.5 h-3.5" />
              Script tags are stripped on render
            </span>
          </label>
          <textarea
            className={`${inputCls} min-h-[140px] resize-y font-mono text-xs`}
            value={section.html ?? ''}
            onChange={set('html')}
            placeholder="<div>Your HTML here</div>"
            spellCheck={false}
          />
          <p className="text-right text-xs text-admin-muted/50">
            {(section.html ?? '').length} chars
          </p>
        </div>
      );

    default:
      return (
        <p className="text-admin-muted text-sm">
          Unknown section type: <code className="bg-admin-bg px-1 rounded">{section.type}</code>
        </p>
      );
  }
}

// ── Live preview ───────────────────────────────────────────────────────────

function SectionPreview({ section }) {
  switch (section.type) {
    case 'hero':
      return (
        <div
          className="rounded-xl min-h-[80px] flex items-center justify-center p-4 text-center relative overflow-hidden"
          style={
            section.backgroundImageUrl
              ? { backgroundImage: `url(${section.backgroundImageUrl})`, backgroundSize: 'cover' }
              : { background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }
          }
        >
          {section.backgroundImageUrl && (
            <div className="absolute inset-0 bg-black/40" />
          )}
          <div className="relative z-10">
            <p className="font-bold text-white text-sm">{section.heading || 'Headline here'}</p>
            {section.subheading && (
              <p className="text-white/70 text-xs mt-1">{section.subheading}</p>
            )}
            {section.ctaText && (
              <span className="mt-2 inline-block px-3 py-1 bg-white text-gray-900
                               text-xs font-bold rounded-lg">
                {section.ctaText}
              </span>
            )}
          </div>
        </div>
      );
    case 'text':
      return (
        <div className="space-y-1.5">
          <p className="font-bold text-admin-text text-sm">{section.heading || 'Heading'}</p>
          <p className="text-admin-muted text-xs line-clamp-3 leading-relaxed">
            {section.body || 'Body content will appear here…'}
          </p>
        </div>
      );
    case 'gallery':
      return (
        <div className="flex flex-wrap gap-1.5">
          {(section.images ?? []).length === 0 ? (
            <p className="text-admin-muted text-xs">No images yet</p>
          ) : (
            (section.images ?? []).slice(0, 4).map((img, i) => (
              <div key={i} className="w-12 h-12 rounded bg-admin-border overflow-hidden">
                {img.url && (
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ))
          )}
        </div>
      );
    case 'contact':
      return (
        <div className="text-xs text-admin-muted space-y-0.5">
          {section.email   && (
            <p className="flex items-center gap-1.5">
              <MailIcon className="w-3.5 h-3.5 shrink-0" /> {section.email}
            </p>
          )}
          {section.phone   && (
            <p className="flex items-center gap-1.5">
              <PhoneIcon className="w-3.5 h-3.5 shrink-0" /> {section.phone}
            </p>
          )}
          {section.address && (
            <p className="flex items-center gap-1.5">
              <LocationIcon className="w-3.5 h-3.5 shrink-0" /> {section.address}
            </p>
          )}
          {!section.email && !section.phone && !section.address && (
            <p className="italic">No contact info yet</p>
          )}
        </div>
      );
    case 'custom':
      return (
        <p className="font-mono text-xs text-admin-muted truncate">
          {section.html || '<empty>'}
        </p>
      );
    default:
      return null;
  }
}

// ── Sortable section item ──────────────────────────────────────────────────

function SortableSection({ section, onUpdate, onRemove, expanded, onToggle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.4 : 1,
    zIndex:     isDragging ? 50 : 'auto',
  };

  const meta = TYPE_META[section.type] ?? { label: section.type, Icon: InfoIcon };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-admin-bg border rounded-xl overflow-hidden transition-all duration-150
                  ${isDragging ? 'border-brand-500 shadow-glow-brand' : 'border-admin-border'}`}
    >
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-admin-muted hover:text-admin-text
                     transition-colors touch-none"
          aria-label="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="7" cy="4"  r="1.5" />
            <circle cx="7" cy="10" r="1.5" />
            <circle cx="7" cy="16" r="1.5" />
            <circle cx="13" cy="4"  r="1.5" />
            <circle cx="13" cy="10" r="1.5" />
            <circle cx="13" cy="16" r="1.5" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <span className="flex items-center gap-2 text-sm font-semibold text-admin-text">
            <meta.Icon className="w-4 h-4 text-admin-muted shrink-0" />
            {meta.label}
          </span>
          {!expanded && (
            <p className="text-xs text-admin-muted truncate mt-0.5">
              {section.heading || section.html?.slice(0, 50) || meta.desc}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-lg text-admin-muted hover:text-admin-text
                     hover:bg-white/[0.05] transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onRemove(section.id)}
          className="p-1.5 rounded-lg text-admin-muted hover:text-red-400
                     hover:bg-red-500/10 transition-colors"
          aria-label="Remove section"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Expanded body: fields + preview */}
      {expanded && (
        <div className="border-t border-admin-border grid grid-cols-1 lg:grid-cols-2
                        divide-y lg:divide-y-0 lg:divide-x divide-admin-border">
          <div className="p-4">
            <p className="text-2xs font-bold text-admin-muted uppercase tracking-widest mb-3">
              Edit Content
            </p>
            <SectionFields section={section} onUpdate={onUpdate} />
          </div>
          <div className="p-4">
            <p className="text-2xs font-bold text-admin-muted uppercase tracking-widest mb-3">
              Live Preview
            </p>
            <SectionPreview section={section} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   sections: Array,
 *   onChange:  function(Array): void
 * }} props
 *
 * onChange is called IMMEDIATELY on every field change.
 * The parent (PageEditorForm) keeps the ref in sync via handleSectionsChange.
 */
export default function SectionEditor({ sections = [], onChange }) {
  const [expandedId, setExpandedId] = useState(null);
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      if (!over || active.id === over.id) return;
      const oldIdx = sections.findIndex((s) => s.id === active.id);
      const newIdx = sections.findIndex((s) => s.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        onChange(arrayMove(sections, oldIdx, newIdx));
      }
    },
    [sections, onChange],
  );

  function addSection(type) {
    const id         = crypto.randomUUID();
    const newSection = { id, type, ...TYPE_DEFAULTS[type] };
    onChange([...sections, newSection]);
    setExpandedId(id);
  }

  function updateSection(updated) {
    onChange(sections.map((s) => (s.id === updated.id ? updated : s)));
  }

  function removeSection(id) {
    onChange(sections.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  return (
    <div className="space-y-3">

      {/* Section list */}
      {sections.length > 0 ? (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  onUpdate={updateSection}
                  onRemove={removeSection}
                  expanded={expandedId === section.id}
                  onToggle={() =>
                    setExpandedId((id) => id === section.id ? null : section.id)
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="border-2 border-dashed border-admin-border rounded-xl p-10 text-center">
          <LayoutIcon className="w-10 h-10 mb-3 mx-auto text-admin-muted/40" />
          <p className="text-admin-muted font-medium">No sections yet</p>
          <p className="text-admin-muted/60 text-sm mt-1">Add a section below to build your page</p>
        </div>
      )}

      {/* Add section panel */}
      <div className="bg-admin-card border border-admin-border rounded-xl p-4">
        <p className="text-xs font-bold text-admin-muted uppercase tracking-widest mb-3">
          Add Section
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(TYPE_META).map(([type, { label, Icon, desc }]) => (
            <button
              key={type}
              type="button"
              onClick={() => addSection(type)}
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-admin-bg border border-admin-border
                         text-left hover:border-brand-500/50 hover:bg-brand-600/5
                         transition-all duration-150 group"
            >
              <span className="w-9 h-9 rounded-lg bg-brand-600/10 text-brand-400 shrink-0
                                flex items-center justify-center
                                group-hover:scale-110 group-hover:bg-brand-600/15 transition-all">
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-admin-text group-hover:text-brand-400 transition-colors">
                  {label}
                </p>
                <p className="text-xs text-admin-muted mt-0.5 line-clamp-1">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {sections.length > 0 && (
        <p className="text-xs text-admin-muted text-center">
          {sections.length} section{sections.length !== 1 ? 's' : ''} —
          drag using the handle to reorder
        </p>
      )}
    </div>
  );
}