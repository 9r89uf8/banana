'use client';

import { useState, useEffect } from 'react';
import { validateImageFile } from '@/app/utils/imageUtils';
import { GenerationQueueProvider, useGenerationQueueContext } from '@/app/contexts/GenerationQueueContext';
import GenerationQueue from './GenerationQueue';

function PersonCompositorInner() {
  const [mainImage, setMainImage] = useState(null);
  const [personImage, setPersonImage] = useState(null);
  const [mainImagePreview, setMainImagePreview] = useState(null);
  const [personImagePreview, setPersonImagePreview] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');

  const { addToQueue, stats } = useGenerationQueueContext();

  const handleMainImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        validateImageFile(file);
        setMainImage(file);
        setError('');

        // Clean up previous URL if it exists
        if (mainImagePreview && mainImagePreview.startsWith('blob:')) {
          URL.revokeObjectURL(mainImagePreview);
        }

        // Create new object URL
        const objectURL = URL.createObjectURL(file);
        setMainImagePreview(objectURL);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handlePersonImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        validateImageFile(file);
        setPersonImage(file);
        setError('');

        // Clean up previous URL if it exists
        if (personImagePreview && personImagePreview.startsWith('blob:')) {
          URL.revokeObjectURL(personImagePreview);
        }

        // Create new object URL
        const objectURL = URL.createObjectURL(file);
        setPersonImagePreview(objectURL);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  // Cleanup object URLs on component unmount or when images change
  useEffect(() => {
    return () => {
      if (mainImagePreview && mainImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(mainImagePreview);
      }
    };
  }, [mainImagePreview]);

  useEffect(() => {
    return () => {
      if (personImagePreview && personImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(personImagePreview);
      }
    };
  }, [personImagePreview]);

  const handleAddToQueue = async () => {
    if (!mainImage || !personImage) {
      setError('Please select both main image and person image');
      return;
    }

    if (!prompt.trim()) {
      setError('Please describe how to add the person to the image');
      return;
    }

    try {
      await addToQueue(mainImage, personImage, prompt);
      setError(''); // Clear any previous errors
      // Optionally reset the form after adding to queue
      // resetForm();
    } catch (err) {
      setError(err.message || 'Failed to add to generation queue');
    }
  };

  const resetForm = () => {
    // Clean up object URLs before resetting
    if (mainImagePreview && mainImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(mainImagePreview);
    }
    if (personImagePreview && personImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(personImagePreview);
    }

    setMainImage(null);
    setPersonImage(null);
    setMainImagePreview(null);
    setPersonImagePreview(null);
    setPrompt('');
    setError('');
  };


  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Compose People Together</h2>

        <div className="space-y-6">
          {/* Image Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Main Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleMainImageSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {mainImagePreview && (
                <div className="mt-3">
                  <img
                    src={mainImagePreview}
                    alt="Main image"
                    className="w-full max-w-sm rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Person to Add
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePersonImageSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
              {personImagePreview && (
                <div className="mt-3">
                  <img
                    src={personImagePreview}
                    alt="Person to add"
                    className="w-full max-w-sm rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Prompt Field */}
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              How should the person be added?
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Place the person standing beside them on the right, with their arm around their shoulder, like close friends at a party"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="4"
            />
            <p className="mt-2 text-xs text-gray-500">
              Describe the position, pose, interaction, and any other details about how the person should be integrated into the main image.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleAddToQueue}
              disabled={!mainImage || !personImage || !prompt.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-md transition-colors duration-200"
            >
              Add to Queue
              {stats.active > 0 && (
                <span className="ml-2 bg-white bg-opacity-20 text-white text-sm px-2 py-1 rounded-full">
                  {stats.active} active
                </span>
              )}
            </button>

            <button
              onClick={resetForm}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-50 transition-colors duration-200"
            >
              Clear Form
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="border px-4 py-3 rounded-md bg-red-50 border-red-200 text-red-700">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generation Queue */}
      <div className="mt-6">
        <GenerationQueue />
      </div>
    </div>
  );
}

// Main component that provides the queue context
export default function PersonCompositor() {
  return (
    <GenerationQueueProvider>
      <PersonCompositorInner />
    </GenerationQueueProvider>
  );
}