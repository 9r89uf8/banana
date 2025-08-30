'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'generationQueue';
const POLLING_INTERVAL = 2000; // 2 seconds

/**
 * Hook for managing the generation queue state and operations
 */
export const useGenerationQueue = () => {
  const [queue, setQueue] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState(0);
  const pollingRef = useRef(new Set()); // Track which IDs are being polled

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
      console.error('Failed to load queue from localStorage:', error);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save queue to localStorage:', error);
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
  const addToQueue = useCallback(async (mainImage, personImage, prompt) => {
    const id = uuidv4();
    
    // Create thumbnails for preview
    const mainThumbnail = URL.createObjectURL(mainImage);
    const personThumbnail = URL.createObjectURL(personImage);

    const newGeneration = {
      id,
      status: 'pending',
      mainImage,
      personImage,
      prompt: prompt.trim(),
      timestamp: new Date(),
      progress: 0,
      result: null,
      error: null,
      thumbnails: {
        main: mainThumbnail,
        person: personThumbnail
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
      formData.append('mainImage', generation.mainImage);
      formData.append('personImage', generation.personImage);
      formData.append('prompt', generation.prompt);
      formData.append('generationId', id);

      // Update status to processing
      setQueue(prev => prev.map(item => 
        item.id === id ? { ...item, status: 'processing', progress: 25 } : item
      ));

      // Send to API
      const response = await fetch('/api/compose-people', {
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
      console.error('Generation failed:', error);
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
    const mainThumbnail = URL.createObjectURL(originalGeneration.mainImage);
    const personThumbnail = URL.createObjectURL(originalGeneration.personImage);

    const newGeneration = {
      id,
      status: 'pending',
      mainImage: originalGeneration.mainImage,
      personImage: originalGeneration.personImage,
      prompt: originalGeneration.prompt,
      timestamp: new Date(),
      progress: 0,
      result: null,
      error: null,
      thumbnails: {
        main: mainThumbnail,
        person: personThumbnail
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
        if (item.thumbnails.main?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.main);
        }
        if (item.thumbnails.person?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.person);
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
        if (item.thumbnails?.main?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.main);
        }
        if (item.thumbnails?.person?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.person);
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
        if (item.thumbnails?.main?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.main);
        }
        if (item.thumbnails?.person?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.person);
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
        if (item.thumbnails?.main?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.main);
        }
        if (item.thumbnails?.person?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.person);
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