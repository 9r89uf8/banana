'use client';

import { useState, useRef, useEffect } from 'react';
import { storage } from '@/app/utils/firebaseClient';
import { ref, getBlob } from 'firebase/storage';

export default function ImageEditor({ initialImage }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editedImage, setEditedImage] = useState(null);
  const [error, setError] = useState('');
  const [isRefusal, setIsRefusal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialImage) {
      loadInitialImage(initialImage);
    }
  }, [initialImage]);

  const loadInitialImage = async (image) => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch(image.url);
      const blob = await response.blob();
      
      const file = new File([blob], image.name, { type: blob.type });
      
      setSelectedImage(file);
      setImagePreview(image.url);
      setEditedImage(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error loading initial image:', error);
      setError('Failed to load image from gallery');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      setSelectedImage(file);
      setEditedImage(null);
      setError('');

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = async () => {
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    if (!editPrompt.trim()) {
      setError('Please enter editing instructions');
      return;
    }

    setIsLoading(true);
    setError('');
    setIsRefusal(false);
    setEditedImage(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('editPrompt', editPrompt);

      const response = await fetch('/api/edit-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isRefusal) {
          setIsRefusal(true);
          setError(data.error || 'Image editing was refused');
        } else {
          setError(data.error || 'Failed to edit image');
        }
        return;
      }

      setEditedImage(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const resetEditor = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setEditPrompt('');
    setEditedImage(null);
    setError('');
    setIsRefusal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Image</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={isLoading}
            />
          </div>

          {imagePreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Original Image
              </label>
              <img
                src={imagePreview}
                alt="Original"
                className="max-w-xs rounded-lg shadow-md"
              />
            </div>
          )}

          <div>
            <label htmlFor="editPrompt" className="block text-sm font-medium text-gray-700 mb-2">
              How would you like to edit this image?
            </label>
            <textarea
              id="editPrompt"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="Add a sunset in the background, change the color to blue, remove the background..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] resize-none"
              disabled={isLoading}
            />
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleEdit}
              disabled={isLoading || !selectedImage || !editPrompt.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-md transition-colors duration-200"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Editing...
                </div>
              ) : (
                'Edit Image'
              )}
            </button>
            
            <button
              onClick={resetEditor}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-50 transition-colors duration-200"
            >
              Reset
            </button>
          </div>

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
                    {isRefusal ? 'Edit Refused' : 'Error'}
                  </p>
                  <p className="text-sm mt-1">{error}</p>
                  {isRefusal && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium">Try a different editing approach:</p>
                      <ul className="mt-1 ml-4 list-disc space-y-1">
                        <li>Use descriptive editing instructions</li>
                        <li>Focus on color, style, or background changes</li>
                        <li>Avoid requesting inappropriate content</li>
                        <li>Try simpler modifications like "make it brighter" or "add blue sky"</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {editedImage && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Edited Image</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <img
                  src={editedImage.imageUrl}
                  alt="Edited image"
                  className="w-full max-w-lg rounded-lg shadow-md"
                />
                <p className="text-sm text-gray-600 mt-3">
                  <span className="font-semibold">Edit instructions:</span> {editedImage.editPrompt}
                </p>
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Download Options</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => downloadOriginal(editedImage)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Original Size
                    </button>
                    
                    <button
                      onClick={() => download916AspectRatio(editedImage)}
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