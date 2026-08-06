import './globals.css';
import OfflineDetector from '@/components/shared/OfflineDetector';
import ErrorProvider   from '@/components/shared/ErrorProvider';
import { ToastContainer } from '@/components/shared/Toast';

export const metadata = {
  title: 'Dynamic CMS',
  description: 'Multi-tenant dynamic website system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/*
          ErrorProvider wraps the entire app.
          • Intercepts window.onerror + unhandledrejection
          • Listens for hys:error custom events from React boundaries & stores
          • Shows floating ErrorPanel when errors are detected
          • Toggle: localStorage.setItem('hys_error_reveal', 'false') to hide details
        */}
        <ErrorProvider>
          <OfflineDetector />
          {children}
          {/*
            PART 9 FIX: previously only mounted inside (admin)/layout.jsx, so
            every toast('...') call from customer/worker/public components
            (BookingModal, ChatModal, JobRequestModal, ReviewModal, dashboards,
            job-board, etc.) updated the toast store but had nothing rendering
            it — toasts were silently invisible outside /admin. Mounted once
            here so it covers every route; removed the duplicate from the
            admin layout to avoid double-rendering.
          */}
          <ToastContainer />
        </ErrorProvider>
      </body>
    </html>
  );
}