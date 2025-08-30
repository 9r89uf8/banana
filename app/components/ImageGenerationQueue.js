'use client';

import { useState } from 'react';
import { useImageGenerationQueueContext } from '@/app/contexts/ImageGenerationQueueContext';
import ImageQueueItem from './ImageQueueItem';
import ImageGenerationModal from './ImageGenerationModal';

export default function ImageGenerationQueue() {
  const { 
    queue, 
    stats,
    isLoading,
    isOnline,
    clearCompleted, 
    clearFailed 
  } = useImageGenerationQueueContext();
  
  const [filter, setFilter] = useState('all');
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredQueue = queue.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['pending', 'uploading', 'processing'].includes(item.status);
    if (filter === 'completed') return item.status === 'completed';
    if (filter === 'failed') return item.status === 'failed';
    return true;
  });

  const handleViewGeneration = (generation) => {
    setSelectedGeneration(generation);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedGeneration(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <div className="text-gray-400">
          <div className="w-8 h-8 mx-auto mb-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-lg font-medium text-gray-500">Loading generations...</p>
          <p className="text-sm text-gray-400">
            {isOnline ? 'Syncing with cloud storage' : 'Loading from local storage'}
          </p>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <div className="text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-medium text-gray-500">No generations yet</p>
          <p className="text-sm text-gray-400">Start by adding reference images and a prompt above</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Queue Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">Generation Queue</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              Active: {stats.active}
            </span>
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
              Completed: {stats.completed || 0}
            </span>
            {stats.failed > 0 && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">
                Failed: {stats.failed}
              </span>
            )}
            {!isOnline && (
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                Offline
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Buttons */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { key: 'all', label: 'All', count: stats.total },
              { key: 'active', label: 'Active', count: stats.active },
              { key: 'completed', label: 'Done', count: stats.completed || 0 },
              ...(stats.failed > 0 ? [{ key: 'failed', label: 'Failed', count: stats.failed }] : [])
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  filter === key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {stats.completed > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs px-2 py-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                title="Clear completed generations"
              >
                Clear Done
              </button>
            )}
            {stats.failed > 0 && (
              <button
                onClick={clearFailed}
                className="text-xs px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                title="Clear failed generations"
              >
                Clear Failed
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Queue Grid */}
      {filteredQueue.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No {filter} generations</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredQueue.map((generation) => (
            <ImageQueueItem
              key={generation.id}
              generation={generation}
              onView={() => handleViewGeneration(generation)}
            />
          ))}
        </div>
      )}

      {/* Generation Modal */}
      {selectedGeneration && (
        <ImageGenerationModal
          generation={selectedGeneration}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}