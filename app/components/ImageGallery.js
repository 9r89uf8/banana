'use client';

import { useState, useEffect } from 'react';
import { storage } from '@/app/utils/firebaseClient';
import { ref, listAll, getDownloadURL, getBlob, getMetadata } from 'firebase/storage';

export default function ImageGallery({ onEditImage }) {
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
        const [url, metadata] = await Promise.all([
          getDownloadURL(item),
          getMetadata(item)
        ]);
        
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
          createdTime: metadata.timeCreated
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

  const downloadOriginal = async (image) => {
    try {
      const imageRef = ref(storage, image.path);
      const blob = await getBlob(imageRef);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = image.name;
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
      const imageRef = ref(storage, image.path);
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
          link.download = image.name.replace(/\.[^/.]+$/, '') + '_9x16.jpg';
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
              
              {onEditImage && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Edit Options</h4>
                  <button
                    onClick={() => {
                      onEditImage(selectedImage);
                      closeModal();
                    }}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Image
                  </button>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Download Options</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => downloadOriginal(selectedImage)}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Original Size
                  </button>
                  
                  <button
                    onClick={() => download916AspectRatio(selectedImage)}
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
        </div>
      )}
    </>
  );
}