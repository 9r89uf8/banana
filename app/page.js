'use client';

import { useState } from 'react';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import ImageGallery from './components/ImageGallery';
import ObjectCompositor from './components/ObjectCompositor';

export default function Home() {
  const [activeTab, setActiveTab] = useState('generate');
  const [imageToEdit, setImageToEdit] = useState(null);

  const handleEditImage = (image) => {
    setImageToEdit(image);
    setActiveTab('edit');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">AI Image Studio</h1>
          <p className="text-gray-600 text-lg">Generate, edit, and compose images with Gemini AI</p>
        </header>

        <nav className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-md">
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-6 py-3 rounded-md font-semibold transition-colors duration-200 ${
                activeTab === 'generate'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Generate
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-6 py-3 rounded-md font-semibold transition-colors duration-200 ${
                activeTab === 'edit'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-6 py-3 rounded-md font-semibold transition-colors duration-200 ${
                activeTab === 'compose'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Compose
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-6 py-3 rounded-md font-semibold transition-colors duration-200 ${
                activeTab === 'gallery'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Gallery
            </button>
          </div>
        </nav>

        <main className="flex justify-center">
          {activeTab === 'generate' && <ImageGenerator />}
          {activeTab === 'edit' && <ImageEditor initialImage={imageToEdit} />}
          {activeTab === 'compose' && <ObjectCompositor />}
          {activeTab === 'gallery' && <ImageGallery onEditImage={handleEditImage} />}
        </main>
      </div>
    </div>
  );
}
