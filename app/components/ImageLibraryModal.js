'use client';

import { useState, useEffect } from 'react';
import ImageLibrary from './ImageLibrary';

const ImageLibraryModal = ({ 
  isOpen, 
  onClose, 
  onSelectImage, 
  title = 'Select from Image Library',
  userId = 'anonymous',
  allowUpload = true
}) => {
  const [selectedTab, setSelectedTab] = useState('library');
  const [selectedImage, setSelectedImage] = useState(null);
  const [recentImages, setRecentImages] = useState([]);
  const [popularImages, setPopularImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load recent and popular images when modal opens
  useEffect(() => {
    if (isOpen) {
      loadQuickAccess();
    }
  }, [isOpen, userId]);

  const loadQuickAccess = async () => {
    try {
      setLoading(true);
      
      // Load recent images
      const recentResponse = await fetch('/api/image-library/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getRecent',
          userId: userId,
          limit: 6
        })
      });
      
      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        if (recentData.success) {
          setRecentImages(recentData.images || []);
        }
      }
      
      // Load popular images
      const popularResponse = await fetch('/api/image-library/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getPopular',
          userId: userId,
          limit: 6
        })
      });
      
      if (popularResponse.ok) {
        const popularData = await popularResponse.json();
        if (popularData.success) {
          setPopularImages(popularData.images || []);
        }
      }
      
    } catch (error) {
      console.error('Error loading quick access images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async (image) => {
    try {
      setSelectedImage(image);
      
      // Record usage of the selected image
      await fetch('/api/image-library/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordUsage',
          imageId: image.id
        })
      });
      
      // Call the parent callback
      if (onSelectImage) {
        onSelectImage(image);
      }
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('Error recording image usage:', error);
      // Still proceed with selection even if usage recording fails
      if (onSelectImage) {
        onSelectImage(image);
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 flex-shrink-0">
          <button
            onClick={() => setSelectedTab('quick')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'quick'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚡ Quick Access
          </button>
          <button
            onClick={() => setSelectedTab('library')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'library'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📚 Browse Library
          </button>
          {allowUpload && (
            <button
              onClick={() => setSelectedTab('upload')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📤 Upload New
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {selectedTab === 'quick' && (
            <div className="flex-1 overflow-y-auto p-6">
              <QuickAccessView
                recentImages={recentImages}
                popularImages={popularImages}
                loading={loading}
                onSelectImage={handleSelectImage}
              />
            </div>
          )}
          
          {selectedTab === 'library' && (
            <div className="flex-1 overflow-y-auto">
              <ImageLibrary
                userId={userId}
                onSelectImage={handleSelectImage}
                selectionMode={true}
                maxSelections={1}
              />
            </div>
          )}
          
          {selectedTab === 'upload' && allowUpload && (
            <div className="flex-1 overflow-y-auto">
              <UploadView
                userId={userId}
                onUploadComplete={(image) => {
                  // Refresh quick access after upload
                  loadQuickAccess();
                  // Auto-select the uploaded image
                  handleSelectImage(image);
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Quick Access View Component
const QuickAccessView = ({ recentImages, popularImages, loading, onSelectImage }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading images...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Recent Images */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          🕐 Recently Used
          <span className="ml-2 text-sm text-gray-500 font-normal">
            ({recentImages.length} images)
          </span>
        </h3>
        
        {recentImages.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No recent images found. Upload some images to get started!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentImages.map(image => (
              <ImageCard
                key={image.id}
                image={image}
                onSelect={() => onSelectImage(image)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Popular Images */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          🔥 Most Popular
          <span className="ml-2 text-sm text-gray-500 font-normal">
            ({popularImages.length} images)
          </span>
        </h3>
        
        {popularImages.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No popular images yet. Start using images to see them here!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {popularImages.map(image => (
              <ImageCard
                key={image.id}
                image={image}
                onSelect={() => onSelectImage(image)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-800">
              <strong>Quick Access</strong> shows your most recent and popular images for fast selection. 
              For more options, use the "Browse Library" tab to search, filter, and explore all your saved images.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Image Card Component
const ImageCard = ({ image, onSelect }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const formatDate = (date) => {
    const now = new Date();
    const imageDate = new Date(date);
    const diffTime = Math.abs(now - imageDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return imageDate.toLocaleDateString();
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };
  
  const handleImageError = () => {
    setImageLoaded(false);
    setImageError(true);
  };

  return (
    <div
      onClick={onSelect}
      className="group bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105"
    >
      <div className="aspect-square relative bg-gray-100">
        {!imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            <img
              src={image.thumbnailUrl || image.imageUrl}
              alt={image.name}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <div className="text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-gray-500">Image not available</p>
            </div>
          </div>
        )}
        
        {/* Usage Count Badge */}
        {image.useCount > 0 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full">
            {image.useCount}
          </div>
        )}
        
        {/* Selection Overlay - Only show on hover and when image is loaded */}
        {imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-20 transition-opacity duration-200 pointer-events-none">
          </div>
        )}
        
        {/* Check icon - Only show on hover and when image is loaded */}
        {imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="transform scale-0 group-hover:scale-100 transition-transform duration-200">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3">
        <h4 className="font-medium text-sm text-gray-900 truncate" title={image.name}>
          {image.name}
        </h4>
        
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-500">
            {formatDate(image.lastUsedAt)}
          </span>
          
          {image.tags && image.tags.length > 0 && (
            <div className="flex">
              <span className="inline-block w-2 h-2 bg-blue-400 rounded-full" title={`${image.tags.length} tags`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Upload View Component
const UploadView = ({ userId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (files, metadata = {}) => {
    if (!files || files.length === 0) return;
    
    try {
      setUploading(true);
      setUploadProgress(0);
      setError('');
      
      const file = files[0]; // Only handle first file for now
      
      const formData = new FormData();
      formData.append('image', file);
      formData.append('userId', userId);
      formData.append('name', metadata.name || file.name.replace(/\.[^/.]+$/, ""));
      formData.append('description', metadata.description || '');
      formData.append('tags', metadata.tags || '');
      
      setUploadProgress(50);
      
      const response = await fetch('/api/image-library/upload', {
        method: 'POST',
        body: formData
      });
      
      setUploadProgress(90);
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }
      
      setUploadProgress(100);
      
      // Create image object for callback
      const uploadedImage = {
        id: data.imageId,
        name: data.name,
        imageUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        tags: data.tags || [],
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        dimensions: data.dimensions
      };
      
      if (onUploadComplete) {
        onUploadComplete(uploadedImage);
      }
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload New Image</h3>
        <p className="text-sm text-gray-600">
          Upload an image to your library and use it immediately as a reference
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex-1 min-h-[300px] border-2 border-dashed rounded-lg transition-colors ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div className="h-full flex flex-col items-center justify-center p-8">
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Uploading image...</p>
              <div className="w-64 bg-gray-200 rounded-full h-2 mt-4">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Drop image here or click to upload
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Supports JPG, PNG, GIF up to 10MB
              </p>
              
              <label className="cursor-pointer">
                <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                  Choose File
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 border px-4 py-3 rounded-md bg-red-50 border-red-200 text-red-700">
          <p className="text-sm font-medium">Upload Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Upload Tips */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">💡 Upload Tips</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Use clear, high-quality images for better generation results</li>
          <li>• Add descriptive tags to make images easier to find later</li>
          <li>• Uploaded images are saved to your library for future use</li>
          <li>• Images will be automatically selected after upload</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageLibraryModal;