'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { validateImageFile } from '@/app/utils/imageUtils';
import { storage } from '@/app/utils/firebaseClient';
import { ref, getBlob } from 'firebase/storage';

export default function ObjectCompositor() {
  const [mainImage, setMainImage] = useState(null);
  const [objectImage, setObjectImage] = useState(null);
  const [mainImagePreview, setMainImagePreview] = useState(null);
  const [objectImagePreview, setObjectImagePreview] = useState(null);
  const [objectPosition, setObjectPosition] = useState({ x: 50, y: 50 }); // Percentage values
  const [sceneDescription, setSceneDescription] = useState('');
  const [objectDescription, setObjectDescription] = useState('');
  const [interactionIntent, setInteractionIntent] = useState('auto');
  const [customInteraction, setCustomInteraction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [compositeResult, setCompositeResult] = useState(null);
  const [error, setError] = useState('');
  const [isRefusal, setIsRefusal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const mainImageRef = useRef(null);
  const objectImageRef = useRef(null);
  const canvasRef = useRef(null);

  const handleMainImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        validateImageFile(file);
        setMainImage(file);
        setCompositeResult(null);
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

  const handleObjectImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        validateImageFile(file);
        setObjectImage(file);
        setCompositeResult(null);
        setError('');

        // Clean up previous URL if it exists
        if (objectImagePreview && objectImagePreview.startsWith('blob:')) {
          URL.revokeObjectURL(objectImagePreview);
        }

        // Create new object URL
        const objectURL = URL.createObjectURL(file);
        setObjectImagePreview(objectURL);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getCanvasPercent = useCallback((event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const xPct = ((event.clientX - rect.left) / rect.width) * 100;
    const yPct = ((event.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, xPct)),
      y: Math.max(0, Math.min(100, yPct))
    };
  }, []);

  const handlePointerDown = (event) => {
    event.target.setPointerCapture(event.pointerId);
    setIsDragging(true);
    setObjectPosition(getCanvasPercent(event));
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;
    setObjectPosition(getCanvasPercent(event));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Sync canvas size with image to ensure accurate hit testing
  useEffect(() => {
    if (!mainImageRef.current || !canvasRef.current) return;
    
    const img = mainImageRef.current;
    const canvas = canvasRef.current;
    
    const syncCanvasSize = () => {
      const w = img.clientWidth;
      const h = img.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    
    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(img);
    syncCanvasSize();
    
    return () => resizeObserver.disconnect();
  }, [mainImagePreview]);

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
      if (objectImagePreview && objectImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(objectImagePreview);
      }
    };
  }, [objectImagePreview]);

  const handleCompose = async () => {
    if (!mainImage || !objectImage) {
      setError('Please select both main image and object image');
      return;
    }

    setIsLoading(true);
    setError('');
    setIsRefusal(false);
    setCompositeResult(null);

    try {
      const formData = new FormData();
      formData.append('mainImage', mainImage);
      formData.append('objectImage', objectImage);
      formData.append('positionX', objectPosition.x);
      formData.append('positionY', objectPosition.y);
      formData.append('sceneDescription', sceneDescription);
      formData.append('objectDescription', objectDescription);
      formData.append('interactionIntent', interactionIntent);
      if (interactionIntent === 'custom' && customInteraction.trim()) {
        formData.append('interactionCustom', customInteraction.trim());
      }

      const response = await fetch('/api/compose-images', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isRefusal) {
          setIsRefusal(true);
          setError(data.error || 'Image composition was refused');
        } else {
          setError(data.error || 'Failed to compose images');
        }
        return;
      }

      setCompositeResult(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const resetCompositor = () => {
    // Clean up object URLs before resetting
    if (mainImagePreview && mainImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(mainImagePreview);
    }
    if (objectImagePreview && objectImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(objectImagePreview);
    }

    setMainImage(null);
    setObjectImage(null);
    setMainImagePreview(null);
    setObjectImagePreview(null);
    setObjectPosition({ x: 50, y: 50 });
    setSceneDescription('');
    setObjectDescription('');
    setInteractionIntent('auto');
    setCustomInteraction('');
    setCompositeResult(null);
    setError('');
    setIsRefusal(false);
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
    <div className="w-full max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Compose Objects into Images</h2>

        <div className="space-y-6">
          {/* Image Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Main Image (Scene)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleMainImageSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={isLoading}
              />
              {mainImagePreview && (
                <div className="mt-3">
                  <img
                    ref={mainImageRef}
                    src={mainImagePreview}
                    alt="Main scene"
                    className="w-full max-w-xs rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Object Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleObjectImageSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                disabled={isLoading}
              />
              {objectImagePreview && (
                <div className="mt-3">
                  <img
                    ref={objectImageRef}
                    src={objectImagePreview}
                    alt="Object to add"
                    className="w-full max-w-xs rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Position Selection Canvas */}
          {mainImagePreview && objectImagePreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Click to Position Object (Position: {objectPosition.x.toFixed(1)}%, {objectPosition.y.toFixed(1)}%)
              </label>
              <div className="relative inline-block border-2 border-dashed border-gray-300 rounded-lg">
                <img
                  src={mainImagePreview}
                  alt="Position preview"
                  className="max-w-md rounded-lg"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full cursor-crosshair rounded-lg"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.1)',
                    touchAction: 'none'
                  }}
                />
                {/* Position Marker */}
                <div
                  className="absolute w-4 h-4 bg-red-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    left: `${objectPosition.x}%`,
                    top: `${objectPosition.y}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Description Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="sceneDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Scene Description (Optional)
              </label>
              <textarea
                id="sceneDescription"
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                placeholder="A person standing in a park, a living room interior..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="3"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="objectDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Object Description (Optional)
              </label>
              <textarea
                id="objectDescription"
                value={objectDescription}
                onChange={(e) => setObjectDescription(e.target.value)}
                placeholder="Red flowers, a coffee cup, a book..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="3"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Interaction Intent Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interaction (how should the object interact?)
            </label>
            <select
              value={interactionIntent}
              onChange={(e) => setInteractionIntent(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="auto">Auto (let the model infer)</option>
              <option value="hold_grasp">Hold / Grasp (in hand)</option>
              <option value="place_on_surface">Place on surface</option>
              <option value="wear">Wear (on head/face/body)</option>
              <option value="hang">Hang (hook/ear/neck/edge)</option>
              <option value="lean">Lean against something</option>
              <option value="float">Float (in the air)</option>
              <option value="custom">Custom...</option>
            </select>

            {interactionIntent === 'custom' && (
              <textarea
                value={customInteraction}
                onChange={(e) => setCustomInteraction(e.target.value)}
                placeholder='e.g., "grasp with RIGHT hand, thumb over label, fingers wrapping the back"'
                rows={2}
                disabled={isLoading}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            )}

            <p className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Tip:</span> "Hold / Grasp" will ensure fingers appear in front of the object (true occlusion) and add realistic contact shadows.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleCompose}
              disabled={isLoading || !mainImage || !objectImage}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-md transition-colors duration-200"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Composing Images...
                </div>
              ) : (
                'Compose Images'
              )}
            </button>

            <button
              onClick={resetCompositor}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-50 transition-colors duration-200"
            >
              Reset
            </button>
          </div>

          {/* Error Display */}
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
                    {isRefusal ? 'Composition Refused' : 'Error'}
                  </p>
                  <p className="text-sm mt-1">{error}</p>
                  {isRefusal && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium">Try adjusting:</p>
                      <ul className="mt-1 ml-4 list-disc space-y-1">
                        <li>Use clear, descriptive object and scene descriptions</li>
                        <li>Ensure images are appropriate for composition</li>
                        <li>Try different positioning for the object</li>
                        <li>Consider simpler object-scene combinations</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Result Display */}
          {compositeResult && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Composite Result</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <img
                  src={compositeResult.imageUrl}
                  alt="Composite result"
                  className="w-full max-w-lg rounded-lg shadow-md mx-auto"
                />
                <div className="mt-3 text-sm text-gray-600">
                  <p><span className="font-semibold">Position:</span> {objectPosition.x.toFixed(1)}%, {objectPosition.y.toFixed(1)}%</p>
                  {sceneDescription && <p><span className="font-semibold">Scene:</span> {sceneDescription}</p>}
                  {objectDescription && <p><span className="font-semibold">Object:</span> {objectDescription}</p>}
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Download Options</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => downloadOriginal(compositeResult)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Original Size
                    </button>
                    
                    <button
                      onClick={() => download916AspectRatio(compositeResult)}
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