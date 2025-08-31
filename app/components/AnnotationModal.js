'use client';

import { useEffect, useCallback } from 'react';
import ImageAnnotator from './ImageAnnotator';

export default function AnnotationModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  onSave,
  imageName = 'image',
  isBlankCanvas = false,
  canvasAspectRatio = '4:3'
}) {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const handleSave = (annotatedImageBlob) => {
    try {
      // Validate blob before creating File
      if (!annotatedImageBlob) {
        throw new Error('No blob provided for saving');
      }
      
      if (!(annotatedImageBlob instanceof Blob)) {
        throw new Error('Invalid blob object provided');
      }
      
      if (annotatedImageBlob.size === 0) {
        throw new Error('Blob is empty');
      }
      
      console.log('Creating File from blob:', annotatedImageBlob.size, 'bytes');
      
      // Convert blob to File object for consistency with existing code
      const file = new File([annotatedImageBlob], `annotated-${imageName}.png`, {
        type: 'image/png',
        lastModified: Date.now()
      });
      
      // Validate the created file
      if (!file || file.size === 0) {
        throw new Error('Failed to create File object from blob');
      }
      
      console.log('Successfully created File object:', file.name, file.size, 'bytes');
      
      onSave(file);
      onClose();
    } catch (error) {
      console.error('Error in AnnotationModal handleSave:', error);
      alert(`Failed to save annotations: ${error.message}`);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-300">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {isBlankCanvas ? `Create Drawing (${canvasAspectRatio})` : 'Annotate Image'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {isBlankCanvas 
                ? 'Create a drawing using arrows, circles, rectangles, pen, or text as a reference image'
                : 'Draw arrows, circles, rectangles, or add text to highlight areas you want to modify'
              }
            </p>
          </div>
          
          <div className="text-sm text-gray-500">
            Use Save or Cancel buttons below to close
          </div>
        </div>

        {/* Modal Body - ImageAnnotator */}
        <div className="flex-1 min-h-0">
          <ImageAnnotator
            imageUrl={imageUrl}
            onSave={handleSave}
            onCancel={handleCancel}
            width={Math.min(window.innerWidth * 0.9, 1200)}
            height={window.innerHeight * 0.6}
            isBlankCanvas={isBlankCanvas}
            canvasAspectRatio={canvasAspectRatio}
          />
        </div>

        {/* Instructions Footer */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <span className="font-semibold">PEN:</span>
              <span>Freehand drawing</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold">ARROW:</span>
              <span>Point to specific areas</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold">CIRCLE:</span>
              <span>Highlight round areas</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold">RECTANGLE:</span>
              <span>Select rectangular regions</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold">TEXT:</span>
              <span>Add text instructions</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold">💾:</span>
              <span>Save your {isBlankCanvas ? 'drawing' : 'annotations'} before closing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}