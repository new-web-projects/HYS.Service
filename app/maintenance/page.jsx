'use client';

import { useEffect, useState } from 'react';

function MaintenanceIllustration() {
  return (
    <div className="relative w-48 h-48 mx-auto mb-8">
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="95" fill="#1e293b" stroke="#334155" strokeWidth="2" />

        {/* Large gear */}
        <g transform="translate(60, 55)">
          <circle cx="25" cy="25" r="15" fill="#2563eb" opacity="0.8" />
          <circle cx="25" cy="25" r="8" fill="#1e293b" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <rect key={i} x="22" y="-2" width="6" height="10" rx="2"
                  fill="#2563eb" opacity="0.8"
                  transform={`rotate(${angle} 25 25)`} />
          ))}
        </g>

        {/* Small gear */}
        <g transform="translate(108, 88)">
          <circle cx="16" cy="16" r="10" fill="#3b82f6" opacity="0.7" />
          <circle cx="16" cy="16" r="5" fill="#1e293b" />
          {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <rect key={i} x="13.5" y="-1" width="5" height="8" rx="1.5"
                  fill="#3b82f6" opacity="0.7"
                  transform={`rotate(${angle} 16 16)`} />
          ))}
        </g>

        {/* Wrench */}
        <g transform="translate(95, 110) rotate(-35)">
          <rect x="0" y="0" width="8" height="40" rx="4" fill="#64748b" />
          <rect x="-6" y="0" width="20" height="12" rx="3" fill="#64748b" />
          <circle cx="7" cy="6" r="4" fill="#1e293b" />
        </g>

        {/* Screwdriver */}
        <g transform="translate(115, 58) rotate(30)">
          <rect x="2" y="0" width="6" height="35" rx="3" fill="#475569" />
          <rect x="0" y="0" width="10" height="14" rx="3" fill="#60a5fa" />
          <rect x="3.5" y="35" width="3" height="10" rx="1" fill="#94a3b8" />
        </g>

        {/* Decorative dots */}
        <circle cx="45" cy="40" r="3" fill="#60a5fa" opacity="0.6" />
        <circle cx="155" cy="50" r="2" fill="#93c5fd" opacity="0.5" />
        <circle cx="160" cy="145" r="3" fill="#60a5fa" opacity="0.4" />
        <circle cx="40" cy="155" r="2" fill="#93c5fd" opacity="0.5" />
      </svg>

      {/* Animated ping dot */}
      <div className="absolute top-4 right-6">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full
                           bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
        </span>
      </div>
    </div>
  );
}

function Countdown({ targetTime }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!targetTime) return;
    const target = new Date(targetTime).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining('Any moment now'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(
        h > 0
          ? `${h}h ${String(m).padStart(2, '0')}m remaining`
          : `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s remaining`,
      );
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [targetTime]);

  if (!remaining) return null;

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                    bg-blue-500/10 border border-blue-500/20 text-blue-300
                    text-sm font-mono">
      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
      {remaining}
    </div>
  );
}

export default function MaintenancePage() {
  const [message,    setMessage]    = useState('We are performing scheduled maintenance.');
  const [returnTime, setReturnTime] = useState(null);
  const [loaded,     setLoaded]     = useState(false);

  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => r.json())
      .then((data) => {
        setMessage(data.maintenanceMessage || 'We are performing scheduled maintenance.');
        setReturnTime(data.estimatedReturn  || null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      }}
    >
      <div className="w-full max-w-lg text-center">

        <MaintenanceIllustration />

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
          Under Maintenance
        </h1>

        <p className="text-xl text-slate-400 font-medium mb-4">
          We're working on something great. Check back soon!
        </p>

        {loaded && (
          <p className="text-slate-300 text-base leading-relaxed mb-6 max-w-md mx-auto">
            {message}
          </p>
        )}

        {returnTime && (
          <div className="mb-8">
            <Countdown targetTime={returnTime} />
          </div>
        )}

        {/*
          PART 6 FIX: Removed Admin Login button and system status row.
          Neither was requested in the final UI spec.
        */}

        <p className="mt-10 text-slate-600 text-sm">
          HYS Services — we'll be back shortly.
        </p>
      </div>
    </div>
  );
}