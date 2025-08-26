'use client';

import { useState } from 'react';

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState('');
  const [isRefusal, setIsRefusal] = useState(false);

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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}