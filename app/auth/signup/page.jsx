import { Suspense } from 'react';
import CustomerSignupForm from './CustomerSignupForm';

export const metadata = { title: 'Create Your Customer Account — HYS Services' };

export default function SignupPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #022c22 0%, #064e3b 40%, #065f46 100%)',
      }}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/20 border-t-white
                            rounded-full animate-spin" />
          </div>
        }
      >
        <CustomerSignupForm />
      </Suspense>
    </div>
  );
}