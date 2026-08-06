export default function TextSection({ heading = '', body = '', badge = '' }) {
  return (
    <div className="section-padding bg-white">
      <div className="section-wrapper">
        <div className="max-w-3xl mx-auto">

          {badge && (
            <div className="flex justify-center mb-6">
              <span
                className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold
                           border text-brand"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-brand, #3b82f6) 10%, transparent)',
                  borderColor:     'color-mix(in srgb, var(--color-brand, #3b82f6) 30%, transparent)',
                }}
              >
                {badge}
              </span>
            </div>
          )}

          {heading && (
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900
                           leading-[1.15] tracking-tight mb-8 text-balance text-center sm:text-left">
              {heading}
            </h2>
          )}

          {/* Accent line */}
          {heading && (
            <div
              className="w-16 h-1.5 rounded-full mb-8 mx-auto sm:mx-0"
              style={{ backgroundColor: 'var(--color-brand, #3b82f6)' }}
            />
          )}

          {body && (
            <div className="space-y-5">
              {body.split('\n').map((paragraph, i) =>
                paragraph.trim() ? (
                  <p key={i} className="text-gray-600 leading-[1.85] text-lg">
                    {paragraph}
                  </p>
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}