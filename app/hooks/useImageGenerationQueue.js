'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'imageGenerationQueue';

/**
 * Hook for managing the image generation queue state and operations
 */
export const useImageGenerationQueue = () => {
  const [queue, setQueue] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState(0);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedQueue = JSON.parse(saved);
        // Only restore non-active generations to avoid conflicts
        const restoredQueue = parsedQueue.map(item => ({
          ...item,
          status: ['pending', 'uploading', 'processing'].includes(item.status) 
            ? 'failed' : item.status,
          timestamp: new Date(item.timestamp)
        }));
        setQueue(restoredQueue);
      }
    } catch (error) {
      console.error('Failed to load image generation queue from localStorage:', error);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save image generation queue to localStorage:', error);
    }
  }, [queue]);

  // Count active generations
  useEffect(() => {
    const active = queue.filter(item => 
      ['pending', 'uploading', 'processing'].includes(item.status)
    ).length;
    setActiveGenerations(active);
  }, [queue]);

  /**
   * Add a new generation to the queue
   */
  const addToQueue = useCallback(async (image1, image2, prompt) => {
    const id = uuidv4();
    
    // Create thumbnails for preview
    const image1Thumbnail = URL.createObjectURL(image1);
    const image2Thumbnail = URL.createObjectURL(image2);

    const newGeneration = {
      id,
      status: 'pending',
      image1,
      image2,
      prompt: prompt.trim(),
      timestamp: new Date(),
      progress: 0,
      result: null,
      error: null,
      thumbnails: {
        image1: image1Thumbnail,
        image2: image2Thumbnail
      }
    };

    setQueue(prev => [newGeneration, ...prev]);
    
    // Start processing immediately with the generation data
    processGeneration(newGeneration);
    
    return id;
  }, []);

  /**
   * Process a generation request
   */
  const processGeneration = useCallback(async (generation) => {
    const id = generation.id;
    
    // Update status to uploading
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'uploading', progress: 10 } : item
    ));

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('image1', generation.image1);
      formData.append('image2', generation.image2);
      formData.append('prompt', generation.prompt);
      formData.append('generationId', id);

      // Update status to processing
      setQueue(prev => prev.map(item => 
        item.id === id ? { ...item, status: 'processing', progress: 25 } : item
      ));

      // Send to API
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process generation');
      }

      // Update with completed result
      setQueue(prev => prev.map(item => 
        item.id === id ? { 
          ...item, 
          status: 'completed', 
          progress: 100,
          result: data,
          error: null
        } : item
      ));

    } catch (error) {
      console.error('Image generation failed:', error);
      setQueue(prev => prev.map(item => 
        item.id === id ? { 
          ...item, 
          status: 'failed', 
          error: error.message,
          progress: 0
        } : item
      ));
    }
  }, []);

  /**
   * Retry a failed generation
   */
  const retryGeneration = useCallback((id) => {
    setQueue(prev => {
      const updatedQueue = prev.map(item => 
        item.id === id ? { 
          ...item, 
          status: 'pending', 
          progress: 0, 
          error: null 
        } : item
      );
      
      // Find the updated generation to process
      const generation = updatedQueue.find(item => item.id === id);
      if (generation) {
        processGeneration(generation);
      }
      
      return updatedQueue;
    });
  }, [processGeneration]);

  /**
   * Run a completed generation again with same images and prompt
   */
  const runAgain = useCallback(async (originalGeneration) => {
    const id = uuidv4();
    
    // Create thumbnails for preview (reuse original images)
    const image1Thumbnail = URL.createObjectURL(originalGeneration.image1);
    const image2Thumbnail = URL.createObjectURL(originalGeneration.image2);

    const newGeneration = {
      id,
      status: 'pending',
      image1: originalGeneration.image1,
      image2: originalGeneration.image2,
      prompt: originalGeneration.prompt,
      timestamp: new Date(),
      progress: 0,
      result: null,
      error: null,
      thumbnails: {
        image1: image1Thumbnail,
        image2: image2Thumbnail
      }
    };

    setQueue(prev => [newGeneration, ...prev]);
    
    // Start processing immediately with the generation data
    processGeneration(newGeneration);
    
    return id;
  }, [processGeneration]);

  /**
   * Remove a generation from the queue
   */
  const removeFromQueue = useCallback((id) => {
    setQueue(prev => {
      // Clean up thumbnails
      const item = prev.find(gen => gen.id === id);
      if (item?.thumbnails) {
        if (item.thumbnails.image1?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image1);
        }
        if (item.thumbnails.image2?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image2);
        }
      }

      return prev.filter(item => item.id !== id);
    });
  }, []);

  /**
   * Clear all completed generations
   */
  const clearCompleted = useCallback(() => {
    setQueue(prev => {
      const completedItems = prev.filter(item => item.status === 'completed');
      
      // Clean up thumbnails for completed items
      completedItems.forEach(item => {
        if (item.thumbnails?.image1?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image1);
        }
        if (item.thumbnails?.image2?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image2);
        }
      });

      return prev.filter(item => item.status !== 'completed');
    });
  }, []);

  /**
   * Clear all failed generations
   */
  const clearFailed = useCallback(() => {
    setQueue(prev => {
      const failedItems = prev.filter(item => item.status === 'failed');
      
      // Clean up thumbnails for failed items
      failedItems.forEach(item => {
        if (item.thumbnails?.image1?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image1);
        }
        if (item.thumbnails?.image2?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image2);
        }
      });

      return prev.filter(item => item.status !== 'failed');
    });
  }, []);

  /**
   * Get queue statistics
   */
  const getQueueStats = useCallback(() => {
    const stats = {
      total: queue.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      active: activeGenerations
    };

    queue.forEach(item => {
      stats[item.status] = (stats[item.status] || 0) + 1;
    });

    return stats;
  }, [queue, activeGenerations]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      queue.forEach(item => {
        if (item.thumbnails?.image1?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image1);
        }
        if (item.thumbnails?.image2?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image2);
        }
      });
    };
  }, []);

  return {
    queue,
    activeGenerations,
    addToQueue,
    retryGeneration,
    runAgain,
    removeFromQueue,
    clearCompleted,
    clearFailed,
    getQueueStats,
    stats: getQueueStats()
  };
};