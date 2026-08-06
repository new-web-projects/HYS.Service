'use client';

import { useState } from 'react';

function LightboxModal({ image, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm
                 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-xl glass text-white
                   hover:bg-white/20 transition-colors"
        aria-label="Close lightbox"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div
        className="max-w-5xl w-full animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.url}
          alt={image.caption || 'Gallery image'}
          className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
        />
        {image.caption && (
          <p className="text-white/70 text-center mt-4 text-sm">{image.caption}</p>
        )}
      </div>
    </div>
  );
}

export default function GallerySection({ images = [], heading = '' }) {
  const [lightboxImage, setLightboxImage] = useState(null);

  if (!images.length) return null;

  return (
    <div className="section-padding bg-gray-50">
      <div className="section-wrapper">

        {heading && (
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              {heading}
            </h2>
            <div
              className="w-16 h-1.5 rounded-full mx-auto"
              style={{ backgroundColor: 'var(--color-brand, #3b82f6)' }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {images.map((img, i) => (
            <figure
              key={i}
              className="group relative overflow-hidden rounded-2xl bg-gray-200
                         cursor-zoom-in shadow-sm hover:shadow-xl
                         transition-all duration-300 hover:-translate-y-1"
              onClick={() => setLightboxImage(img)}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={img.url}
                  alt={img.caption || `Gallery image ${i + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500
                             group-hover:scale-110"
                />
              </div>

              {/* Hover overlay with zoom icon */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30
                              transition-colors duration-300 flex items-center justify-center">
                <div className="w-12 h-12 rounded-xl glass text-white flex items-center justify-center
                                opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100
                                transition-all duration-200">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                  </svg>
                </div>
              </div>

              {img.caption && (
                <figcaption className="px-4 py-3 text-sm text-gray-500 bg-white
                                       font-medium text-center">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>

      {lightboxImage && (
        <LightboxModal
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}