'use client';

import { useState } from 'react';
import { useImageGenerationQueueContext } from '@/app/contexts/ImageGenerationQueueContext';
import { useImageGeneratorContext } from '@/app/contexts/ImageGeneratorContext';

export default function ImageQueueItem({ generation, onView }) {
  const { retryGeneration, runAgain, removeFromQueue } = useImageGenerationQueueContext();
  const { setGeneratedAsReference1, setGeneratedAsReference2 } = useImageGeneratorContext();
  const [showActions, setShowActions] = useState(false);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return (
          <div className="w-5 h-5 bg-gray-400 rounded-full animate-pulse" title="Waiting in queue" />
        );
      case 'uploading':
        return (
          <div className="w-5 h-5 bg-blue-400 rounded-full animate-pulse" title="Uploading images" />
        );
      case 'processing':
        return (
          <div className="w-5 h-5 bg-yellow-400 rounded-full relative" title="AI processing">
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping" />
          </div>
        );
      case 'completed':
        return (
          <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center" title="Completed">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'failed':
        return (
          <div className="w-5 h-5 bg-red-400 rounded-full flex items-center justify-center" title="Failed">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'border-gray-300';
      case 'uploading': return 'border-blue-300';
      case 'processing': return 'border-yellow-300';
      case 'completed': return 'border-green-300';
      case 'failed': return 'border-red-300';
      default: return 'border-gray-300';
    }
  };

  const getProgressColor = (status) => {
    switch (status) {
      case 'uploading': return 'bg-blue-400';
      case 'processing': return 'bg-yellow-400';
      case 'completed': return 'bg-green-400';
      case 'failed': return 'bg-red-400';
      default: return 'bg-gray-300';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes < 1) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return timestamp.toLocaleTimeString();
  };

  const handleClick = () => {
    if (generation.status === 'completed') {
      onView();
    }
  };


  const downloadOriginal = async () => {
    // Simple download function for fullscreen viewer
    if (generation.result?.imageUrl) {
      const link = document.createElement('a');
      link.href = generation.result.imageUrl;
      link.download = generation.result.fileName?.split('/').pop() || 'image.png';
      link.click();
    }
  };

  const handleRetry = (e) => {
    e.stopPropagation();
    retryGeneration(generation.id);
  };

  const handleRunAgain = (e) => {
    e.stopPropagation();
    runAgain(generation);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    removeFromQueue(generation.id);
  };

  const handleUseAsReference1 = async (e) => {
    e.stopPropagation();
    try {
      await setGeneratedAsReference1(generation);
    } catch (err) {
      console.error('Failed to set as reference 1:', err);
    }
  };

  const handleUseAsReference2 = async (e) => {
    e.stopPropagation();
    try {
      await setGeneratedAsReference2(generation);
    } catch (err) {
      console.error('Failed to set as reference 2:', err);
    }
  };

  return (
    <div
      className={`relative bg-white rounded-lg border-2 ${getStatusColor(generation.status)} overflow-hidden transition-all duration-200 ${
        generation.status === 'completed' 
          ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' 
          : 'cursor-default'
      }`}
      onClick={handleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Progress bar */}
      {generation.status !== 'pending' && generation.status !== 'failed' && (
        <div className="absolute top-0 left-0 right-0 h-1">
          <div 
            className={`h-full transition-all duration-300 ${getProgressColor(generation.status)}`}
            style={{ width: `${generation.progress}%` }}
          />
        </div>
      )}

      {/* Status indicator */}
      <div className="absolute top-2 right-2 z-10">
        {getStatusIcon(generation.status)}
      </div>

      {/* Actions menu */}
      {showActions && (
        <div className="absolute top-2 left-2 z-10 flex gap-1">
          {generation.status === 'failed' && (
            <button
              onClick={handleRetry}
              className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors"
              title="Retry generation"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {generation.status === 'completed' && (
            <>
              <button
                onClick={handleRunAgain}
                className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors"
                title="Run same generation again"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={handleUseAsReference1}
                className="w-6 h-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors"
                title="Use as Reference 1"
              >
                <span className="text-xs font-bold">1</span>
              </button>
              <button
                onClick={handleUseAsReference2}
                className="w-6 h-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors"
                title="Use as Reference 2"
              >
                <span className="text-xs font-bold">2</span>
              </button>
            </>
          )}
          <button
            onClick={handleRemove}
            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
            title="Remove from queue"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Image previews */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center p-2">
        {generation.status === 'completed' && generation.result ? (
          <img
            src={generation.result.imageUrl}
            alt="Generated image"
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <div className="grid grid-cols-2 gap-1 w-full h-full">
            <img
              src={generation.thumbnails.image1}
              alt="Reference image 1"
              className="w-full h-full object-cover rounded"
            />
            <img
              src={generation.thumbnails.image2}
              alt="Reference image 2"
              className="w-full h-full object-cover rounded"
            />
          </div>
        )}
      </div>

      {/* Generation info */}
      <div className="p-3 space-y-2">
        <p className="text-xs text-gray-600 line-clamp-2" title={generation.prompt}>
          {generation.prompt}
        </p>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {formatTime(generation.timestamp)}
          </span>
          
          {generation.status === 'processing' && (
            <span className="text-yellow-600 font-medium">
              {generation.progress}%
            </span>
          )}
          
          {generation.status === 'failed' && generation.error && (
            <span className="text-red-600 font-medium" title={generation.error}>
              Error
            </span>
          )}
        </div>
      </div>

    </div>
  );
}