'use client';

import { useState } from 'react';
import { storage } from '@/app/utils/firebaseClient';
import { ref, getBlob } from 'firebase/storage';

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState('');
  const [isRefusal, setIsRefusal] = useState(false);

  const downloadOriginal = async (image) => {
    try {
      const imageRef = ref(storage, image.fileName);
      const blob = await getBlob(imageRef);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = image.fileName.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      setError('Failed to download image');
    }
  };

  const download916AspectRatio = async (image) => {
    try {
      const imageRef = ref(storage, image.fileName);
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
          const fileName = image.fileName.split('/').pop().replace(/\.[^/.]+$/, '') + '_9x16.jpg';
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
      setError('Failed to create 9:16 aspect ratio image');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError('');
    setIsRefusal(false);
    setGeneratedImage(null);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isRefusal) {
          setIsRefusal(true);
          setError(data.error || 'Image generation was refused');
        } else {
          setError(data.error || 'Failed to generate image');
        }
        return;
      }

      setGeneratedImage(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Generate Image</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Describe the image you want to generate
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A beautiful sunset over mountains with a lake in the foreground..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] resize-none"
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-md transition-colors duration-200"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Generating...
              </div>
            ) : (
              'Generate Image'
            )}
          </button>

          {error && (
            <div className={`border px-4 py-3 rounded-md ${
              isRefusal 
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {isRefusal ? (
                    <svg className="h-5 w-5 text-orange-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">
                    {isRefusal ? 'Generation Refused' : 'Error'}
                  </p>
                  <p className="text-sm mt-1">{error}</p>
                  {isRefusal && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium">Try modifying your prompt:</p>
                      <ul className="mt-1 ml-4 list-disc space-y-1">
                        <li>Use more general, descriptive language</li>
                        <li>Avoid specific people, brands, or copyrighted content</li>
                        <li>Focus on artistic style and visual elements</li>
                        <li>Keep content appropriate and family-friendly</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {generatedImage && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Generated Image</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <img
                  src={generatedImage.imageUrl}
                  alt={generatedImage.prompt}
                  className="w-full rounded-lg shadow-md"
                />
                <p className="text-sm text-gray-600 mt-3">
                  <span className="font-semibold">Prompt:</span> {generatedImage.prompt}
                </p>
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Download Options</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => downloadOriginal(generatedImage)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Original Size
                    </button>
                    
                    <button
                      onClick={() => download916AspectRatio(generatedImage)}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      9:16 Aspect Ratio
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    9:16 format is optimized for mobile and social media vertical displays
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}