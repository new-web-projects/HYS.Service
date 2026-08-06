import { Suspense } from 'react';
import AdminLoginForm from './AdminLoginForm';

export const metadata = { title: 'Admin Login — HYS Services' };

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-admin-bg flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500
                            rounded-full animate-spin" />
          </div>
        }
      >
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}