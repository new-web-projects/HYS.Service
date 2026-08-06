import PageEditorForm from '../[id]/edit/PageEditorForm';

export default function NewPagePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-admin-text mb-6">New Page</h1>
      <PageEditorForm page={null} />
    </div>
  );
}