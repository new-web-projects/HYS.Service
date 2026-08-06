'use client';

import { useState } from 'react';
import { ChevronDownIcon, InfoIcon } from '@/components/icons';
import { formatPrice, getFeeRows }    from '@/lib/pricing';

/**
 * Displays pricing in two modes:
 * - Collapsed: shows FINAL_PRICE prominently
 * - Expanded:  shows full breakdown (worker fee + platform fee [+ GST] = final)
 *
 * @param {{
 *   basePrice:        number,
 *   platformFee:      number,
 *   platformPercent:  number,
 *   platformFeeType?: 'percent' | 'fixed',  — Part 8: drives the fee label
 *   platformFixed?:   number,               — Part 8: shown when type is 'fixed'
 *   gstAmount:        number,
 *   gstPercent:       number,
 *   finalPrice:       number,
 *   gstModeEnabled?:  boolean,   — Part 6: show GST breakdown rows + wording
 *   showExpanded?:    boolean,   — start expanded
 *   compact?:         boolean,   — smaller layout
 * }} props
 */
export default function PriceBreakdown({
  basePrice,
  platformFee,
  platformPercent,
  platformFeeType,
  platformFixed,
  gstAmount,
  gstPercent,
  finalPrice,
  gstModeEnabled = false,
  showExpanded   = false,
  compact        = false,
}) {
  const [expanded, setExpanded] = useState(showExpanded);

  // Part 6: fee row(s) adapt to GST Mode — see lib/pricing.js getFeeRows()
  // PART 8 FIX: platformFeeType/platformFixed are now forwarded so the
  // label correctly reads "Platform fee (fixed ₹X)" instead of always
  // assuming percentage mode when the admin has configured a fixed fee.
  const feeRows = getFeeRows(
    { platformFee, platformPercent, platformFeeType, platformFixed, gstAmount, gstPercent },
    gstModeEnabled,
  );

  const rows = [
    {
      label: 'Worker fee',
      value: formatPrice(basePrice),
      hint:  'Base amount the worker receives',
      cls:   'text-gray-700',
    },
    ...feeRows.map(({ label, value, hint }) => ({
      label,
      value: `+${formatPrice(value)}`,
      hint,
      cls: 'text-gray-500',
    })),
  ];

  if (compact) {
    return (
      <div className="space-y-1">
        {/* Compact: final price + expand toggle inline */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-gray-900">
              {formatPrice(finalPrice)}
            </span>
            <span className="text-gray-400 text-sm ml-1">total</span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800
                       font-medium transition-colors"
          >
            {expanded ? 'Hide' : 'View'} breakdown
            <ChevronDownIcon
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {expanded && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5
                          animate-fade-in">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-gray-500">{label}</span>
                <span className="text-gray-700 font-medium">{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold text-gray-900
                            pt-2 border-t border-gray-200">
              <span>You pay</span>
              <span className="text-blue-600">{formatPrice(finalPrice)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
      {/* Summary row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-100
                   transition-colors group"
      >
        <div className="flex items-center gap-2 text-left">
          <InfoIcon className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total Amount (incl. all charges)
            </p>
            <p className="text-2xl font-extrabold text-gray-900">
              {formatPrice(finalPrice)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-600 font-semibold">
            {expanded ? 'Hide' : 'See'} breakdown
          </span>
          <ChevronDownIcon
            className={`w-4 h-4 text-gray-400 transition-transform duration-200
                        ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="border-t border-gray-200 px-5 py-4 space-y-3 animate-fade-in">
          {rows.map(({ label, value, hint, cls }) => (
            <div key={label}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
                </div>
                <span className={`text-sm font-semibold ${cls}`}>{value}</span>
              </div>
            </div>
          ))}

          {/* Total rule */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-200">
            <div>
              <p className="font-bold text-gray-900">Customer pays</p>
              <p className="text-xs text-gray-400">
                {gstModeEnabled ? 'Inclusive of all taxes and fees' : 'Inclusive of all charges'}
              </p>
            </div>
            <p className="text-2xl font-extrabold text-blue-600">
              {formatPrice(finalPrice)}
            </p>
          </div>

          {/* Worker receives note */}
          <div className="flex items-center gap-2 pt-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <p className="text-xs text-gray-400">
              Worker receives <strong className="text-gray-600">{formatPrice(basePrice)}</strong> directly.
              {gstModeEnabled
                ? ' Platform fee + GST on platform fee are collected by the platform.'
                : ' A platform fee is collected by the platform.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}