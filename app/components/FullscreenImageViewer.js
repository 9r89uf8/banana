'use client';

import { useEffect, useRef } from 'react';

export default function FullscreenImageViewer({ 
  imageUrl, 
  isOpen, 
  onClose
}) {
  const viewerRef = useRef();

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;
      
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (event) => {
    if (event.target === viewerRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={viewerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <img
        src={imageUrl}
        alt="Fullscreen view"
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
}