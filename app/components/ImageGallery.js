'use client';

import { useState, useEffect } from 'react';
import { storage } from '@/app/utils/firebaseClient';
import { ref, listAll, getDownloadURL } from 'firebase/storage';

export default function ImageGallery() {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setIsLoading(true);
    setError('');

    try {
      const generatedRef = ref(storage, 'generated-images');
      const editedRef = ref(storage, 'edited-images');
      const compositeRef = ref(storage, 'composite-images');
      
      const [generatedList, editedList, compositeList] = await Promise.all([
        listAll(generatedRef),
        listAll(editedRef),
        listAll(compositeRef)
      ]);

      const allItems = [...generatedList.items, ...editedList.items, ...compositeList.items];
      
      const imagePromises = allItems.map(async (item) => {
        const url = await getDownloadURL(item);
        let type = 'generated';
        if (item.fullPath.includes('edited-images')) {
          type = 'edited';
        } else if (item.fullPath.includes('composite-images')) {
          type = 'composite';
        }
        
        return {
          name: item.name,
          url,
          path: item.fullPath,
          type,
          createdTime: item.timeCreated || new Date()
        };
      });

      const imageData = await Promise.all(imagePromises);
      
      imageData.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
      
      setImages(imageData);
    } catch (err) {
      console.error('Error fetching images:', err);
      setError('Failed to load images from gallery');
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (image) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Image Gallery</h2>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Image Gallery</h2>
            <button
              onClick={fetchImages}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}

          {images.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🖼️</div>
              <p className="text-gray-500 text-lg">No images in your gallery yet</p>
              <p className="text-gray-400 mt-2">Generate or edit some images to see them here!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {images.map((image, index) => (
                <div
                  key={index}
                  className="relative group cursor-pointer"
                  onClick={() => openModal(image)}
                >
                  <div className="aspect-square overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${
                      image.type === 'generated' ? 'bg-green-500' : 
                      image.type === 'edited' ? 'bg-blue-500' : 'bg-purple-500'
                    }`}>
                      {image.type === 'generated' ? 'Generated' : 
                       image.type === 'edited' ? 'Edited' : 'Composite'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {selectedImage.type === 'generated' ? 'Generated Image' : 
                   selectedImage.type === 'edited' ? 'Edited Image' : 'Composite Image'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <img
                src={selectedImage.url}
                alt={selectedImage.name}
                className="w-full rounded-lg"
              />
              <div className="mt-4 text-sm text-gray-600">
                <p><span className="font-semibold">File:</span> {selectedImage.name}</p>
                <p><span className="font-semibold">Type:</span> {selectedImage.type === 'generated' ? 'AI Generated' : 
                   selectedImage.type === 'edited' ? 'AI Edited' : 'AI Composite'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}