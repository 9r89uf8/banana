'use client';

import { useEffect, useRef, useState } from 'react';
import { storage } from '@/app/utils/firebaseClient';
import { ref, getBlob } from 'firebase/storage';
import { useImageGenerationQueueContext } from '@/app/contexts/ImageGenerationQueueContext';
import { useImageGeneratorContext } from '@/app/contexts/ImageGeneratorContext';
import FullscreenImageViewer from './FullscreenImageViewer';

export default function ImageGenerationModal({ generation, isOpen, onClose }) {
  const modalRef = useRef();
  const { runAgain } = useImageGenerationQueueContext();
  const { setGeneratedAsReference1, setGeneratedAsReference2 } = useImageGeneratorContext();
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
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

  // Handle click outside
  const handleBackdropClick = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      onClose();
    }
  };

  const downloadOriginal = async () => {
    try {
      const imageRef = ref(storage, generation.result.fileName);
      const blob = await getBlob(imageRef);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generation.result.fileName.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const download916AspectRatio = async () => {
    try {
      const imageRef = ref(storage, generation.result.fileName);
      const blob = await getBlob(imageRef);
      const objectUrl = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const targetRatio = 9 / 16;
      const imgRatio = img.width / img.height;

      let sx, sy, sw, sh;
      if (imgRatio > targetRatio) {
        sh = img.height;
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = img.width / targetRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }

      const targetHeight = 1600;
      const targetWidth = Math.round(targetHeight * targetRatio);
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

      await new Promise((resolve, reject) => {
        canvas.toBlob((outputBlob) => {
          if (!outputBlob) return reject(new Error('toBlob failed'));
          const outputUrl = URL.createObjectURL(outputBlob);
          const link = document.createElement('a');
          link.href = outputUrl;
          const fileName = generation.result.fileName.split('/').pop().replace(/\.[^/.]+$/, '') + '_9x16.jpg';
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(outputUrl);
          resolve();
        }, 'image/jpeg', 0.9);
      });

      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error downloading 9:16 image:', error);
    }
  };

  const handleRunAgain = () => {
    runAgain(generation);
    onClose(); // Close modal after starting new generation
  };

  const handleImageClick = () => {
    setFullscreenOpen(true);
  };

  const handleFullscreenClose = () => {
    setFullscreenOpen(false);
  };

  const handleUseAsReference1 = async () => {
    try {
      await setGeneratedAsReference1(generation);
      onClose(); // Close modal after setting reference
    } catch (err) {
      console.error('Failed to set as reference 1:', err);
    }
  };

  const handleUseAsReference2 = async () => {
    try {
      await setGeneratedAsReference2(generation);
      onClose(); // Close modal after setting reference
    } catch (err) {
      console.error('Failed to set as reference 2:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-400 rounded-full" />
            <h3 className="text-lg font-semibold text-gray-900">
              Generated Image
            </h3>
            <span className="text-sm text-gray-500">
              {generation.timestamp.toLocaleString()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto">
          {/* Image Display */}
          <div className="p-6">
            <div className="text-center mb-4">
              <img
                src={generation.result.imageUrl}
                alt="Generated image"
                className="max-w-full max-h-96 mx-auto rounded-lg shadow-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                style={{ maxHeight: '70vh' }}
                onClick={handleImageClick}
                title="Click to view fullscreen"
              />
              <p className="text-xs text-gray-500 mt-2">Click image to view fullscreen</p>
            </div>

            {/* Generation Details */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Prompt</h4>
                <p className="text-gray-600 bg-gray-50 p-3 rounded-md">
                  {generation.prompt}
                </p>
              </div>

              {/* Reference Images Preview */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Reference Images</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <img
                      src={generation.thumbnails.image1}
                      alt="Reference image 1"
                      className="w-full h-24 object-cover rounded-md mb-2"
                    />
                    <p className="text-xs text-gray-500">Reference Image 1</p>
                  </div>
                  <div className="text-center">
                    <img
                      src={generation.thumbnails.image2}
                      alt="Reference image 2"
                      className="w-full h-24 object-cover rounded-md mb-2"
                    />
                    <p className="text-xs text-gray-500">Reference Image 2</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex flex-col gap-3">
            {/* First row: Download buttons */}
            <div className="flex gap-3">
              <button
                onClick={downloadOriginal}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Original
              </button>
              
              <button
                onClick={download916AspectRatio}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Download 9:16
              </button>
            </div>

            {/* Second row: Use as Reference buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleUseAsReference1}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Use as Reference 1
              </button>
              
              <button
                onClick={handleUseAsReference2}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Use as Reference 2
              </button>
            </div>

            {/* Third row: Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleRunAgain}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Run Again
              </button>

              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            9:16 format is optimized for mobile and social media vertical displays
          </p>
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      <FullscreenImageViewer
        imageUrl={generation.result.imageUrl}
        prompt={generation.prompt}
        isOpen={fullscreenOpen}
        onClose={handleFullscreenClose}
        onDownload={downloadOriginal}
      />
    </div>
  );
}