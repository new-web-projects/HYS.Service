import React, { memo, Suspense } from 'react';
import HeroSection    from '@/components/public/sections/HeroSection';
import TextSection    from '@/components/public/sections/TextSection';
import GallerySection from '@/components/public/sections/GallerySection';
import ContactSection from '@/components/public/sections/ContactSection';

/**
 * PERFORMANCE: Dynamic import for CustomSection.
 * Custom HTML sections are rare and include a DOMPurify sanitizer (~30KB).
 * By lazy-loading it, the main bundle is smaller and the sanitizer
 * only downloads when a page actually has a custom HTML section.
 */
const CustomSection = React.lazy(() =>
  import('@/components/public/sections/CustomSection')
);

/**
 * PERFORMANCE: memo() with a custom comparison.
 * Only re-renders a section if its content has changed.
 * When an admin edits section #3, only section #3 re-renders —
 * not sections #1 and #2.
 */
const SectionRenderer = memo(function SectionRenderer({ section }) {
  switch (section.type) {
    case 'hero':
      return (
        <div className="cv-auto">
          <HeroSection
            heading={section.heading}
            subheading={section.subheading}
            backgroundImageUrl={section.backgroundImageUrl}
            ctaText={section.ctaText}
            ctaLink={section.ctaLink}
          />
        </div>
      );
    case 'text':
      return (
        <div className="cv-auto">
          <TextSection
            heading={section.heading}
            body={section.body}
          />
        </div>
      );
    case 'gallery':
      return (
        <div className="cv-auto">
          <GallerySection
            images={section.images ?? []}
            heading={section.heading}
          />
        </div>
      );
    case 'contact':
      return (
        <div className="cv-auto">
          <ContactSection
            email={section.email}
            phone={section.phone}
            address={section.address}
          />
        </div>
      );
    case 'custom':
      return (
        <div className="cv-auto">
          <Suspense fallback={
            <div className="section-padding">
              <div className="section-wrapper">
                <div className="h-32 skeleton rounded-xl" />
              </div>
            </div>
          }>
            <CustomSection html={section.html} />
          </Suspense>
        </div>
      );
    default:
      return (
        <div className="cv-auto">
          <div className="section-padding">
            <div className="section-wrapper text-center text-gray-400">
              Unknown section type: <code>{section.type}</code>
            </div>
          </div>
        </div>
      );
  }
}, (prev, next) => {
  // Deep compare the section object.
  // JSON.stringify is acceptable here because sections are small plain objects.
  return JSON.stringify(prev.section) === JSON.stringify(next.section);
});

export default SectionRenderer;