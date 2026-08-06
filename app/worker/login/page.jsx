import { Suspense }    from 'react';
import WorkerLoginForm from './WorkerLoginForm';

export const metadata = { title: 'Worker Login — HYS Services' };

export default function WorkerLoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
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
        <WorkerLoginForm />
      </Suspense>
    </div>
  );
}