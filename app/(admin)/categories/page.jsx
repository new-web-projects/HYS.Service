'use client';

import { useEffect, useState }  from 'react';
import { useForm }              from 'react-hook-form';
import { zodResolver }          from '@hookform/resolvers/zod';
import { useContentStore }      from '@/store/contentStore';
import { useToast }             from '@/components/shared/Toast';
import { useConfirm }           from '@/components/shared/ConfirmDialog';
import LoadingSpinner           from '@/components/shared/LoadingSpinner';
import { categorySchema }       from '@/lib/validators/schemas';
import { CATEGORY_ICON_OPTIONS, getCategoryIcon, normalizeIconKey } from '@/lib/categoryIcons';
import { CheckIcon, CategoryIcon }  from '@/components/icons';

const STATUS_STYLES = {
  active:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending:  'bg-amber-500/10   text-amber-400   border-amber-500/20',
  disabled: 'bg-gray-500/10   text-gray-400    border-gray-500/20',
};

// ── Category form (used for both add and edit) ─────────────────────────────

function CategoryForm({ initial, onSave, onCancel, saving }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(
      categorySchema.pick({ name: true, description: true, icon: true, status: true }),
    ),
    defaultValues: {
      name:        initial?.name        ?? '',
      description: initial?.description ?? '',
      icon:        normalizeIconKey(initial?.icon),
      status:      initial?.status      ?? 'active',
    },
  });

  const selectedIcon = watch('icon');

  const inputCls =
    'w-full px-4 py-3 rounded-lg bg-admin-bg border border-admin-border text-admin-text ' +
    'text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      {/* Icon picker */}
      <div>
        <label className="block text-sm font-medium text-admin-muted mb-2">Icon</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ICON_OPTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setValue('icon', key, { shouldValidate: true })}
              title={label}
              aria-label={label}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border-2
                          transition-colors
                          ${selectedIcon === key
                            ? 'border-brand-500 bg-brand-600/15 text-brand-400'
                            : 'border-admin-border text-admin-muted hover:border-brand-500/50 hover:text-brand-400'}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-admin-muted mb-1.5">
          Category Name *
        </label>
        <input {...register('name')} placeholder="e.g. Plumbing" className={inputCls} />
        {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-admin-muted mb-1.5">
          Description
        </label>
        <textarea
          {...register('description')}
          placeholder="Brief description of this service category…"
          className={`${inputCls} resize-none`}
          rows={2}
        />
      </div>

      {/* Status (only shown in edit mode) */}
      {initial && (
        <div>
          <label className="block text-sm font-medium text-admin-muted mb-1.5">Status</label>
          <select {...register('status')} className={inputCls}>
            <option value="active">Active</option>
            <option value="pending">Pending Approval</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm
                     font-semibold rounded-xl transition-colors disabled:opacity-40
                     flex items-center justify-center gap-2"
        >
          {saving && (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {initial ? 'Update Category' : 'Add Category'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-admin-muted hover:text-admin-text text-sm
                     font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const {
    categories,
    categoriesLoading,
    subscribeCategories,
    unsubscribeCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    approveCategory,
  } = useContentStore();

  const toast   = useToast((s) => s.show);
  const confirm = useConfirm((s) => s.confirm);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId,   setEditingId]   = useState(null);
  const [formSaving,  setFormSaving]  = useState(false);
  const [activeTab,   setActiveTab]   = useState('active');

  useEffect(() => {
    subscribeCategories();
    return () => unsubscribeCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount  = categories.filter((c) => c.status === 'pending').length;

  const filtered = categories.filter((c) => {
    if (activeTab === 'all')     return true;
    if (activeTab === 'pending') return c.status === 'pending';
    return c.status === 'active';
  });

  async function handleAdd(data) {
    setFormSaving(true);
    try {
      await createCategory({ ...data, status: 'active' });
      toast(`Category "${data.name}" added.`, 'success');
      setShowAddForm(false);
    } catch (err) {
      toast(err.message ?? 'Failed to add category.', 'error');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleEdit(id, data) {
    setFormSaving(true);
    try {
      await updateCategory(id, data);
      toast('Category updated.', 'success');
      setEditingId(null);
    } catch (err) {
      toast(err.message ?? 'Update failed.', 'error');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(category) {
    const ok = await confirm(
      `Delete "${category.name}"?`,
      'This is permanent and cannot be undone.',
    );
    if (!ok) return;
    try {
      await deleteCategory(category.id);
      toast(`"${category.name}" deleted.`, 'success');
    } catch (err) {
      toast(err.message ?? 'Delete failed.', 'error');
    }
  }

  async function handleApprove(category) {
    try {
      await approveCategory(category.id);
      toast(`"${category.name}" approved and is now active.`, 'success');
    } catch (err) {
      toast(err.message ?? 'Approval failed.', 'error');
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Categories</h1>
          <p className="text-admin-muted text-sm mt-0.5">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} total
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
                               bg-amber-500/20 text-amber-400 border border-amber-500/20">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm
                       font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Category
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-admin-text mb-4">New Category</h2>
          <CategoryForm
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saving={formSaving}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-admin-bg border border-admin-border rounded-xl p-1 w-fit">
        {[
          { id: 'active',  label: 'Active'  },
          { id: 'pending', label: pendingCount > 0 ? `Pending (${pendingCount})` : 'Pending' },
          { id: 'all',     label: 'All'     },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${activeTab === id
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-admin-muted hover:text-admin-text'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {categoriesLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading categories…" />
        </div>
      )}

      {/* Empty state */}
      {!categoriesLoading && filtered.length === 0 && (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
          <CategoryIcon className="w-12 h-12 mb-4 mx-auto text-admin-muted/40" />
          <p className="text-admin-muted font-medium">
            {activeTab === 'pending' ? 'No pending categories' : 'No categories yet'}
          </p>
          {activeTab === 'active' && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white
                         text-sm font-semibold rounded-xl transition-colors"
            >
              Add your first category
            </button>
          )}
        </div>
      )}

      {/* Category grid */}
      {!categoriesLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((category) => (
            <div key={category.id}>
              {editingId === category.id ? (
                /* Inline edit form */
                <div className="bg-admin-card border border-brand-500/30 rounded-2xl p-5 animate-fade-in">
                  <h3 className="text-sm font-semibold text-admin-text mb-4">
                    Edit: {category.name}
                  </h3>
                  <CategoryForm
                    initial={category}
                    onSave={(data) => handleEdit(category.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={formSaving}
                  />
                </div>
              ) : (
                /* Category card */
                <div className="group bg-admin-card border border-admin-border rounded-2xl p-5
                                hover:border-white/10 hover:shadow-card-hover
                                transition-all duration-200">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-600/15 border border-brand-500/20
                                    flex items-center justify-center text-brand-400 shrink-0">
                      {(() => {
                        const Icon = getCategoryIcon(category.icon);
                        return <Icon className="w-6 h-6" />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-admin-text truncate">{category.name}</h3>
                      {category.description && (
                        <p className="text-admin-muted text-xs mt-0.5 line-clamp-2">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border
                                      ${STATUS_STYLES[category.status] ?? STATUS_STYLES.active}`}>
                      {category.status === 'active'   ? 'Active'            : ''}
                      {category.status === 'pending'  ? 'Pending Approval'  : ''}
                      {category.status === 'disabled' ? 'Disabled'          : ''}
                    </span>
                    {category.submittedBy && category.status === 'pending' && (
                      <span className="text-xs text-admin-muted">Worker suggestion</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {category.status === 'pending' && (
                      <button
                        onClick={() => handleApprove(category)}
                        className="flex-1 py-2 text-xs font-semibold rounded-xl
                                   bg-emerald-500/15 border border-emerald-500/30 text-emerald-400
                                   hover:bg-emerald-500/25 transition-colors
                                   flex items-center justify-center gap-1.5"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => setEditingId(category.id)}
                      className="flex-1 py-2 text-xs font-medium rounded-xl bg-admin-bg
                                 border border-admin-border text-admin-muted
                                 hover:border-brand-500/50 hover:text-brand-400 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="py-2 px-3 text-xs font-medium rounded-xl bg-admin-bg
                                 border border-admin-border text-red-400/70
                                 hover:border-red-500/50 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}