'use client';

import { useState, useEffect } from 'react';
import { validateImageFile } from '@/app/utils/imageUtils';
import { ImageGenerationQueueProvider, useImageGenerationQueueContext } from '@/app/contexts/ImageGenerationQueueContext';
import { ImageGeneratorProvider } from '@/app/contexts/ImageGeneratorContext';
import ImageGenerationQueue from './ImageGenerationQueue';
import AnnotationModal from './AnnotationModal';

function ImageGeneratorInner() {
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [image1Preview, setImage1Preview] = useState(null);
  const [image2Preview, setImage2Preview] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Annotation modal state
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [annotatingImage, setAnnotatingImage] = useState(null); // 'image1' or 'image2'
  const [isDrawingBlank, setIsDrawingBlank] = useState(false);
  const [canvasAspectRatio, setCanvasAspectRatio] = useState('4:3');

  const { addToQueue, stats } = useImageGenerationQueueContext();

  // Helper function to convert generated image URL to File object
  const convertUrlToFile = async (imageUrl, fileName = 'generated-image.jpg') => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new File([blob], fileName, { type: blob.type });
    } catch (err) {
      throw new Error('Failed to convert image URL to file');
    }
  };

  // Method to set generated image as reference 1
  const setGeneratedAsReference1 = async (generation) => {
    try {
      if (!generation?.result?.imageUrl) {
        throw new Error('Invalid generation or missing image URL');
      }

      // Clean up previous preview
      if (image1Preview && image1Preview.startsWith('blob:')) {
        URL.revokeObjectURL(image1Preview);
      }

      const file = await convertUrlToFile(
        generation.result.imageUrl,
        `gen-ref1-${generation.id}.jpg`
      );

      setImage1(file);
      setImage1Preview(generation.result.imageUrl);
      setError('');
      setSuccessMessage('Generated image set as Reference 1!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(`Failed to set reference image 1: ${err.message}`);
    }
  };

  // Method to set generated image as reference 2
  const setGeneratedAsReference2 = async (generation) => {
    try {
      if (!generation?.result?.imageUrl) {
        throw new Error('Invalid generation or missing image URL');
      }

      // Clean up previous preview
      if (image2Preview && image2Preview.startsWith('blob:')) {
        URL.revokeObjectURL(image2Preview);
      }

      const file = await convertUrlToFile(
        generation.result.imageUrl,
        `gen-ref2-${generation.id}.jpg`
      );

      setImage2(file);
      setImage2Preview(generation.result.imageUrl);
      setError('');
      setSuccessMessage('Generated image set as Reference 2!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(`Failed to set reference image 2: ${err.message}`);
    }
  };

  // Annotation functions
  const handleAnnotateImage = (imageNumber) => {
    setAnnotatingImage(imageNumber);
    setIsDrawingBlank(false);
    setShowAnnotationModal(true);
  };

  // Blank canvas drawing function
  const handleCreateBlankDrawing = () => {
    setAnnotatingImage('image2');
    setIsDrawingBlank(true);
    setShowAnnotationModal(true);
  };

  const handleAnnotationSave = (annotatedImageFile) => {
    try {
      // Validate the annotated image file
      if (!annotatedImageFile) {
        throw new Error('No annotated image file provided');
      }
      
      if (!(annotatedImageFile instanceof File) && !(annotatedImageFile instanceof Blob)) {
        throw new Error('Invalid file type provided - expected File or Blob');
      }
      
      if (annotatedImageFile.size === 0) {
        throw new Error('Annotated image file is empty');
      }
      
      console.log('Processing annotated image:', annotatedImageFile.name || 'blob', annotatedImageFile.size, 'bytes');
      
      // Validate the file using existing validation
      validateImageFile(annotatedImageFile);
      
      if (annotatingImage === 'image1') {
        setImage1(annotatedImageFile);
        
        // Clean up previous preview
        if (image1Preview && image1Preview.startsWith('blob:')) {
          URL.revokeObjectURL(image1Preview);
        }
        
        // Create object URL with validation
        try {
          const objectURL = URL.createObjectURL(annotatedImageFile);
          setImage1Preview(objectURL);
          setSuccessMessage('Image 1 annotations saved successfully!');
          console.log('Created object URL for image 1:', objectURL);
        } catch (urlError) {
          throw new Error(`Failed to create preview URL for image 1: ${urlError.message}`);
        }
        
      } else if (annotatingImage === 'image2') {
        setImage2(annotatedImageFile);
        
        // Clean up previous preview
        if (image2Preview && image2Preview.startsWith('blob:')) {
          URL.revokeObjectURL(image2Preview);
        }
        
        // Create object URL with validation
        try {
          const objectURL = URL.createObjectURL(annotatedImageFile);
          setImage2Preview(objectURL);
          setSuccessMessage('Image 2 annotations saved successfully!');
          console.log('Created object URL for image 2:', objectURL);
        } catch (urlError) {
          throw new Error(`Failed to create preview URL for image 2: ${urlError.message}`);
        }
      } else {
        throw new Error('Invalid annotating image identifier');
      }
      
      setError('');
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error in handleAnnotationSave:', err);
      setError(`Failed to save annotated image: ${err.message}`);
    }
    
    setAnnotatingImage(null);
    setIsDrawingBlank(false);
  };

  const handleAnnotationCancel = () => {
    setShowAnnotationModal(false);
    setAnnotatingImage(null);
    setIsDrawingBlank(false);
  };

  const handleImage1Select = (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        validateImageFile(file);
        setImage1(file);
        setError('');
        setSuccessMessage('');

        if (image1Preview && image1Preview.startsWith('blob:')) {
          URL.revokeObjectURL(image1Preview);
        }

        const objectURL = URL.createObjectURL(file);
        setImage1Preview(objectURL);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleImage2Select = (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        validateImageFile(file);
        setImage2(file);
        setError('');
        setSuccessMessage('');

        if (image2Preview && image2Preview.startsWith('blob:')) {
          URL.revokeObjectURL(image2Preview);
        }

        const objectURL = URL.createObjectURL(file);
        setImage2Preview(objectURL);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (image1Preview && image1Preview.startsWith('blob:')) {
        URL.revokeObjectURL(image1Preview);
      }
    };
  }, [image1Preview]);

  useEffect(() => {
    return () => {
      if (image2Preview && image2Preview.startsWith('blob:')) {
        URL.revokeObjectURL(image2Preview);
      }
    };
  }, [image2Preview]);

  const handleAddToQueue = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt for image generation');
      return;
    }

    try {
      await addToQueue(image1, image2, prompt);
      setPrompt('');
      setError(''); // Clear any previous errors
      // Optionally reset the form after adding to queue
      // resetForm();
    } catch (err) {
      setError(err.message || 'Failed to add to generation queue');
    }
  };

  const resetForm = () => {
    if (image1Preview && image1Preview.startsWith('blob:')) {
      URL.revokeObjectURL(image1Preview);
    }
    if (image2Preview && image2Preview.startsWith('blob:')) {
      URL.revokeObjectURL(image2Preview);
    }

    setImage1(null);
    setImage2(null);
    setImage1Preview(null);
    setImage2Preview(null);
    setPrompt('');
    setError('');
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Generate Image</h2>
        
        <div className="space-y-6">
          {/* Image Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Image 1
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImage1Select}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {image1Preview && (
                <div className="mt-3">
                  <img
                    src={image1Preview}
                    alt="Reference image 1"
                    className="w-full max-w-sm rounded-lg shadow-md"
                  />
                  <button
                    onClick={() => handleAnnotateImage('image1')}
                    className="mt-2 w-full px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 transition-colors"
                  >
                    ✏️ Annotate Image
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Image 2
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImage2Select}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
              
              {!image2Preview && (
                <div className="mt-3">
                  <div className="flex items-center justify-center text-gray-500 text-sm mb-2">
                    <span className="bg-gray-200 px-2 py-1 rounded">OR</span>
                  </div>
                  
                  {/* Canvas size selection */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Canvas Size:
                    </label>
                    <select 
                      value={canvasAspectRatio}
                      onChange={(e) => setCanvasAspectRatio(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="4:3">📱 Normal (4:3) - 800×600</option>
                      <option value="16:9">🖥️ Widescreen (16:9) - 960×540</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleCreateBlankDrawing}
                    className="w-full px-3 py-2 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                  >
                    🎨 Draw on Blank Canvas
                  </button>
                </div>
              )}
              
              {image2Preview && (
                <div className="mt-3">
                  <img
                    src={image2Preview}
                    alt="Reference image 2"
                    className="w-full max-w-sm rounded-lg shadow-md"
                  />
                  <button
                    onClick={() => handleAnnotateImage('image2')}
                    className="mt-2 w-full px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 transition-colors"
                  >
                    ✏️ Annotate Image
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Describe the image you want to generate
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (successMessage) setSuccessMessage('');
              }}
              placeholder="Example: A fantasy landscape with mountains and dragons, or combine elements from reference images if provided, or modify specific parts of an uploaded image..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] resize-none"
            />
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleAddToQueue}
              disabled={!prompt.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-md transition-colors duration-200"
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

          {successMessage && (
            <div className="border px-4 py-3 rounded-md bg-green-50 border-green-200 text-green-700">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">Success</p>
                  <p className="text-sm mt-1">{successMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generation Queue */}
      <div className="mt-6">
        <ImageGeneratorProvider 
          setGeneratedAsReference1={setGeneratedAsReference1}
          setGeneratedAsReference2={setGeneratedAsReference2}
        >
          <ImageGenerationQueue />
        </ImageGeneratorProvider>
      </div>

      {/* Annotation Modal */}
      <AnnotationModal
        isOpen={showAnnotationModal}
        onClose={handleAnnotationCancel}
        imageUrl={isDrawingBlank ? null : (annotatingImage === 'image1' ? image1Preview : image2Preview)}
        onSave={handleAnnotationSave}
        imageName={annotatingImage === 'image1' ? 'reference-1' : 'reference-2'}
        isBlankCanvas={isDrawingBlank}
        canvasAspectRatio={canvasAspectRatio}
      />
    </div>
  );
}

// Main component that provides the queue context
export default function ImageGenerator() {
  return (
    <ImageGenerationQueueProvider>
      <ImageGeneratorInner />
    </ImageGenerationQueueProvider>
  );
}