import { Suspense } from 'react';
import WorkerSignupForm from './WorkerSignupForm';

export const metadata = {
  title: 'Join as a Service Professional — HYS Services',
  description:
    'Connect with customers, receive service requests, manage bookings, and build your professional reputation.',
};

export default function WorkerSignupPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #1c0f00 0%, #431407 40%, #78350f 100%)',
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
        <WorkerSignupForm />
      </Suspense>
    </div>
  );
}
