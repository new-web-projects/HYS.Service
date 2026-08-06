export default function ContactSection({ email = '', phone = '', address = '' }) {
  const hasContent = email || phone || address;
  if (!hasContent) return null;

  const items = [
    email   && { icon: '✉', label: 'Email Us',    value: email,   href: `mailto:${email}`  },
    phone   && { icon: '📞', label: 'Call Us',     value: phone,   href: `tel:${phone}`     },
    address && { icon: '📍', label: 'Find Us',     value: address, href: null               },
  ].filter(Boolean);

  return (
    <div className="section-padding bg-white">
      <div className="section-wrapper">
        <div className="max-w-4xl mx-auto">

          {/* Heading */}
          <div className="text-center mb-14">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-4 text-brand"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-brand, #3b82f6) 10%, transparent)',
              }}
            >
              Get in Touch
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Contact Us
            </h2>
            <div
              className="w-16 h-1.5 rounded-full mx-auto mt-4"
              style={{ backgroundColor: 'var(--color-brand, #3b82f6)' }}
            />
          </div>

          {/* Contact cards */}
          <div className={`grid gap-5 ${items.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : items.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {items.map(({ icon, label, value, href }, i) => {
              const Tag = href ? 'a' : 'div';
              const tagProps = href ? { href, ...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } : {};

              return (
                <Tag
                  key={i}
                  {...tagProps}
                  className={`group flex flex-col items-center text-center p-8 rounded-2xl
                              border-2 border-gray-100 bg-white
                              transition-all duration-200
                              ${href ? 'hover:border-brand hover:shadow-lg hover:-translate-y-1 cursor-pointer' : ''}`}
                  style={href ? { '--hover-border': 'var(--color-brand, #3b82f6)' } : {}}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
                               text-white mb-5 shadow-md transition-transform duration-200
                               group-hover:scale-110"
                    style={{ backgroundColor: 'var(--color-brand, #3b82f6)' }}
                  >
                    {icon}
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {label}
                  </p>
                  <p className="text-gray-700 font-medium leading-relaxed whitespace-pre-line">
                    {value}
                  </p>
                  {href && (
                    <span
                      className="mt-4 text-sm font-semibold text-brand opacity-0
                                 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      {href.startsWith('mailto') ? 'Send email →' : href.startsWith('tel') ? 'Call now →' : 'View map →'}
                    </span>
                  )}
                </Tag>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}