'use client';

import { useState, useEffect, useCallback } from 'react';
import { validateImageFile } from '@/app/utils/imageUtils';

const ImageLibrary = ({ 
  userId = 'anonymous', 
  onSelectImage = null,
  selectionMode = false,
  maxSelections = 1
}) => {
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [selectedImages, setSelectedImages] = useState([]);
  
  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Stats
  const [stats, setStats] = useState(null);
  
  // Edit state
  const [editingImage, setEditingImage] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', tags: '' });

  const showMessage = useCallback((message, isError = false) => {
    if (isError) {
      setError(message);
      setSuccessMessage('');
    } else {
      setSuccessMessage(message);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccessMessage('');
    }, 3000);
  }, []);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        userId: userId,
        limit: '100',
        sortBy: sortBy
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
      }
      
      const response = await fetch(`/api/image-library/list?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load images');
      }
      
      setImages(data.images || []);
      setFilteredImages(data.images || []);
    } catch (err) {
      console.error('Error loading images:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, sortBy, searchTerm, selectedTags]);

  const loadTags = useCallback(async () => {
    try {
      const response = await fetch('/api/image-library/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTags',
          userId: userId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setAvailableTags(data.tags || []);
      }
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  }, [userId]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/image-library/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getStats',
          userId: userId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadImages();
    loadTags();
    loadStats();
  }, [loadImages, loadTags, loadStats]);

  const handleUpload = async (file, metadata) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Validate file
      validateImageFile(file);
      
      const formData = new FormData();
      formData.append('image', file);
      formData.append('userId', userId);
      if (metadata.name) formData.append('name', metadata.name);
      if (metadata.description) formData.append('description', metadata.description);
      if (metadata.tags) formData.append('tags', metadata.tags);
      
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
      showMessage('Image uploaded successfully!');
      loadImages();
      loadTags();
      loadStats();
      setShowUpload(false);
      
    } catch (err) {
      console.error('Upload error:', err);
      showMessage(err.message, true);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (imageId) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/image-library/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteSingle',
          imageId: imageId
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Delete failed');
      }
      
      showMessage('Image deleted successfully!');
      loadImages();
      loadStats();
    } catch (err) {
      console.error('Delete error:', err);
      showMessage(err.message, true);
    }
  };

  const handleSelectImage = (image) => {
    if (!selectionMode) return;
    
    if (maxSelections === 1) {
      setSelectedImages([image]);
      if (onSelectImage) {
        onSelectImage(image);
      }
    } else {
      setSelectedImages(prev => {
        const isSelected = prev.find(img => img.id === image.id);
        if (isSelected) {
          return prev.filter(img => img.id !== image.id);
        } else if (prev.length < maxSelections) {
          return [...prev, image];
        }
        return prev;
      });
    }
  };

  const handleEditImage = async (imageId, updates) => {
    try {
      const response = await fetch('/api/image-library/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateImage',
          imageId: imageId,
          ...updates
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Update failed');
      }
      
      showMessage('Image updated successfully!');
      loadImages();
      loadTags();
      setEditingImage(null);
    } catch (err) {
      console.error('Update error:', err);
      showMessage(err.message, true);
    }
  };

  const startEdit = (image) => {
    setEditingImage(image.id);
    setEditForm({
      name: image.name || '',
      description: image.description || '',
      tags: image.tags ? image.tags.join(', ') : ''
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading image library...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Image Library</h2>
          {stats && (
            <p className="text-sm text-gray-600">
              {stats.totalImages} images • {formatFileSize(stats.totalSize)} total
            </p>
          )}
        </div>
        
        {!selectionMode && (
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            📤 Upload Images
          </button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Tags Filter */}
          <div>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !selectedTags.includes(e.target.value)) {
                  setSelectedTags([...selectedTags, e.target.value]);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Add tag filter...</option>
              {availableTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Sort */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="recent">Recently Used</option>
              <option value="popular">Most Popular</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
          
          {/* View Mode */}
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              🔳 Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-md ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              📋 List
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 border px-4 py-3 rounded-md bg-red-50 border-red-200 text-red-700">
          <p className="text-sm font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 border px-4 py-3 rounded-md bg-green-50 border-green-200 text-green-700">
          <p className="text-sm font-medium">Success</p>
          <p className="text-sm mt-1">{successMessage}</p>
        </div>
      )}

      {/* Images Grid/List */}
      {filteredImages.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No images found</p>
          <p className="text-gray-400 text-sm mt-2">
            {searchTerm || selectedTags.length > 0 
              ? 'Try adjusting your filters' 
              : 'Upload some images to get started'}
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
          : 'space-y-4'
        }>
          {filteredImages.map(image => (
            <div
              key={image.id}
              className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${
                selectionMode ? 'cursor-pointer' : ''
              } ${
                selectedImages.find(img => img.id === image.id) ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleSelectImage(image)}
            >
              {viewMode === 'grid' ? (
                // Grid View
                <>
                  <div className="aspect-square relative">
                    <img
                      src={image.thumbnailUrl}
                      alt={image.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {selectionMode && selectedImages.find(img => img.id === image.id) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3">
                    {editingImage === image.id ? (
                      // Edit Mode
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Image name"
                        />
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Description"
                          rows="2"
                        />
                        <input
                          type="text"
                          value={editForm.tags}
                          onChange={(e) => setEditForm({...editForm, tags: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Tags (comma separated)"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditImage(image.id, {
                              name: editForm.name,
                              description: editForm.description,
                              tags: editForm.tags.split(',').map(t => t.trim()).filter(t => t)
                            })}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingImage(null)}
                            className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <>
                        <h3 className="font-medium text-sm text-gray-900 truncate" title={image.name}>
                          {image.name}
                        </h3>
                        
                        {image.tags && image.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {image.tags.slice(0, 2).map(tag => (
                              <span
                                key={tag}
                                className="inline-block px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
                              >
                                {tag}
                              </span>
                            ))}
                            {image.tags.length > 2 && (
                              <span className="text-xs text-gray-500">+{image.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-500">
                            Used {image.useCount || 0} times
                          </span>
                          
                          {!selectionMode && (
                            <div className="flex space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(image);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(image.id);
                                }}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                // List View
                <div className="flex items-center p-4 space-x-4">
                  <div className="w-16 h-16 flex-shrink-0">
                    <img
                      src={image.thumbnailUrl}
                      alt={image.name}
                      className="w-full h-full object-cover rounded"
                      loading="lazy"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{image.name}</h3>
                    {image.description && (
                      <p className="text-sm text-gray-600 truncate">{image.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                      <span>{formatFileSize(image.fileSize)}</span>
                      <span>Used {image.useCount || 0} times</span>
                      <span>{formatDate(image.lastUsedAt)}</span>
                    </div>
                    
                    {image.tags && image.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {image.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-block px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {!selectionMode && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(image)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(image.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUpload={handleUpload}
          uploading={uploading}
          uploadProgress={uploadProgress}
        />
      )}

      {/* Selection Actions */}
      {selectionMode && selectedImages.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 border">
          <p className="text-sm text-gray-600 mb-2">
            {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''} selected
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (onSelectImage) {
                  onSelectImage(selectedImages.length === 1 ? selectedImages[0] : selectedImages);
                }
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Use Selected
            </button>
            <button
              onClick={() => setSelectedImages([])}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Upload Modal Component
const UploadModal = ({ onClose, onUpload, uploading, uploadProgress }) => {
  const [files, setFiles] = useState([]);
  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    tags: ''
  });

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
    
    if (selectedFiles.length === 1) {
      setMetadata({
        ...metadata,
        name: selectedFiles[0].name.replace(/\.[^/.]+$/, "")
      });
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    for (const file of files) {
      await onUpload(file, metadata);
    }
    
    setFiles([]);
    setMetadata({ name: '', description: '', tags: '' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Images</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Images
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          
          {files.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={metadata.name}
                  onChange={(e) => setMetadata({...metadata, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Image name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata({...metadata, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description (optional)"
                  rows="3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={metadata.tags}
                  onChange={(e) => setMetadata({...metadata, tags: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Comma-separated tags (optional)"
                />
              </div>
            </>
          )}
          
          {uploading && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
        
        <div className="flex space-x-3 mt-6">
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} image${files.length > 1 ? 's' : ''}`}
          </button>

          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageLibrary;