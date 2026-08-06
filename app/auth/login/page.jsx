import { Suspense } from 'react';
import LoginForm    from './LoginForm';

export const metadata = { title: 'Sign In — HYS Services' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600
                            rounded-full animate-spin" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}