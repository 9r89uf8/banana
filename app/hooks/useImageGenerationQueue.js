'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generationsService } from '@/app/services/firebase/generationsService';

/**
 * Hook for managing the image generation queue state and operations
 */
export const useImageGenerationQueue = () => {
  const [queue, setQueue] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

  // Track online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load queue from Firestore on mount
  useEffect(() => {
    const loadQueue = async () => {
      try {
        setIsLoading(true);
        
        if (isOnline) {
          // Load from Firestore
          const firestoreGenerations = await generationsService.getGenerations();
          
          // Mark any active generations as failed (in case of browser crash/reload)
          const restoredQueue = firestoreGenerations.map(item => ({
            ...item,
            status: ['pending', 'uploading', 'processing'].includes(item.status) 
              ? 'failed' : item.status
          }));
          
          setQueue(restoredQueue);
          
          // Update failed generations in Firestore
          const failedUpdates = restoredQueue
            .filter(item => item.status === 'failed' && 
              ['pending', 'uploading', 'processing'].includes(
                firestoreGenerations.find(ag => ag.id === item.id)?.status
              ))
            .map(item => generationsService.updateGeneration(item.id, { status: 'failed' }));
          
          if (failedUpdates.length > 0) {
            await Promise.all(failedUpdates);
          }
        } else {
          // When offline, start with empty queue
          setQueue([]);
        }
      } catch (error) {
        console.error('Failed to load image generation queue:', error);
        setQueue([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadQueue();
  }, [isOnline]);


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
  const addToQueue = useCallback(async (image1, image2, prompt, image1Source = null, image2Source = null, image1LibraryData = null, image2LibraryData = null) => {
    const id = uuidv4();
    
    // Create thumbnails for preview (only for images that exist)
    const thumbnails = {};
    if (image1) {
      if (typeof image1 === 'string') {
        // It's a URL (from library)
        thumbnails.image1 = image1;
      } else {
        // It's a File object
        thumbnails.image1 = URL.createObjectURL(image1);
      }
    }
    if (image2) {
      if (typeof image2 === 'string') {
        // It's a URL (from library)
        thumbnails.image2 = image2;
      } else {
        // It's a File object
        thumbnails.image2 = URL.createObjectURL(image2);
      }
    }

    const newGeneration = {
      id,
      status: 'pending',
      prompt: prompt.trim(),
      timestamp: new Date(),
      progress: 0,
      result: null,
      error: null,
      thumbnails,
      // Keep original files/URLs for processing (can be null)
      image1,
      image2,
      // Track image sources
      image1Source,
      image2Source,
      image1LibraryData,
      image2LibraryData
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
    
    const updateGenerationStatus = async (updates) => {
      setQueue(prev => prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      ));
      
      // Update Firestore if online
      if (isOnline) {
        try {
          await generationsService.updateGeneration(id, updates);
        } catch (firestoreError) {
          console.error('Failed to update Firestore, continuing with local state:', firestoreError);
        }
      }
    };
    
    // Update status to uploading
    await updateGenerationStatus({ status: 'uploading', progress: 10 });

    try {
      // Create FormData
      const formData = new FormData();
      
      // Handle images based on their type (File object or URL string)
      if (generation.image1) {
        if (typeof generation.image1 === 'string') {
          // It's a URL from library
          formData.append('image1Url', generation.image1);
        } else {
          // It's a File object
          formData.append('image1', generation.image1);
        }
      }
      
      if (generation.image2) {
        if (typeof generation.image2 === 'string') {
          // It's a URL from library
          formData.append('image2Url', generation.image2);
        } else {
          // It's a File object
          formData.append('image2', generation.image2);
        }
      }
      
      formData.append('prompt', generation.prompt);
      formData.append('generationId', id);

      // Update status to processing
      await updateGenerationStatus({ status: 'processing', progress: 25 });

      // Send to API
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process generation');
      }

      // Update with completed result and save reference URLs to Firestore
      await updateGenerationStatus({
        status: 'completed',
        progress: 100,
        result: data,
        error: null,
        imageUrl: data.imageUrl,
        referenceImage1Url: data.referenceImage1Url,
        referenceImage2Url: data.referenceImage2Url
      });

      // Save completed generation to Firestore with reference URLs
      if (isOnline) {
        try {
          const firestoreData = {
            id: generation.id,
            status: 'completed',
            prompt: generation.prompt,
            timestamp: generation.timestamp,
            progress: 100,
            error: null,
            imageUrl: data.imageUrl,
            referenceImage1Url: data.referenceImage1Url,
            referenceImage2Url: data.referenceImage2Url,
            result: data,
            thumbnails: {
              image1: data.referenceImage1Url,
              image2: data.referenceImage2Url
            }
          };
          await generationsService.saveGeneration(firestoreData);
        } catch (firestoreError) {
          console.error('Failed to save completed generation to Firestore:', firestoreError);
        }
      }

    } catch (error) {
      console.error('Image generation failed:', error);
      await updateGenerationStatus({
        status: 'failed',
        error: error.message,
        progress: 0
      });
    }
  }, [isOnline]);

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
    
    try {
      // For persistent generations, we need to recreate File objects from URLs if they don't exist
      let image1 = originalGeneration.image1;
      let image2 = originalGeneration.image2;
      
      if (!image1 && originalGeneration.referenceImage1Url) {
        // If we don't have the original files, fetch them from storage
        const response1 = await fetch(originalGeneration.referenceImage1Url);
        const blob1 = await response1.blob();
        image1 = new File([blob1], `ref1.${blob1.type.split('/')[1]}`, { type: blob1.type });
      }
      
      if (!image2 && originalGeneration.referenceImage2Url) {
        const response2 = await fetch(originalGeneration.referenceImage2Url);
        const blob2 = await response2.blob();
        image2 = new File([blob2], `ref2.${blob2.type.split('/')[1]}`, { type: blob2.type });
      }

      // Create thumbnails for preview
      const image1Thumbnail = originalGeneration.thumbnails?.image1 || originalGeneration.referenceImage1Url;
      const image2Thumbnail = originalGeneration.thumbnails?.image2 || originalGeneration.referenceImage2Url;

      const newGeneration = {
        id,
        status: 'pending',
        image1,
        image2,
        prompt: originalGeneration.prompt,
        timestamp: new Date(),
        progress: 0,
        result: null,
        error: null,
        referenceImage1Url: originalGeneration.referenceImage1Url,
        referenceImage2Url: originalGeneration.referenceImage2Url,
        thumbnails: {
          image1: image1Thumbnail,
          image2: image2Thumbnail
        }
      };

      // Save to Firestore (exclude File objects)
      if (isOnline) {
        try {
          const firestoreData = {
            ...newGeneration,
            image1: undefined,
            image2: undefined,
            thumbnails: {
              image1: originalGeneration.referenceImage1Url,
              image2: originalGeneration.referenceImage2Url
            }
          };
          await generationsService.saveGeneration(firestoreData);
        } catch (firestoreError) {
          console.error('Failed to save to Firestore, continuing with local state:', firestoreError);
        }
      }

      setQueue(prev => [newGeneration, ...prev]);
      
      // Start processing immediately with the generation data
      processGeneration(newGeneration);
      
      return id;
    } catch (error) {
      console.error('Failed to recreate generation:', error);
      throw new Error('Failed to recreate generation');
    }
  }, [processGeneration, isOnline]);

  /**
   * Remove a generation from the queue
   */
  const removeFromQueue = useCallback(async (id) => {
    // Remove from Firestore if online
    if (isOnline) {
      try {
        await generationsService.deleteGeneration(id);
      } catch (firestoreError) {
        console.error('Failed to delete from Firestore, continuing with local state:', firestoreError);
      }
    }

    setQueue(prev => {
      // Clean up thumbnails
      const item = prev.find(gen => gen.id === id);
      if (item?.thumbnails) {
        if (item.thumbnails.image1 && item.thumbnails.image1.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image1);
        }
        if (item.thumbnails.image2 && item.thumbnails.image2.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image2);
        }
      }

      return prev.filter(item => item.id !== id);
    });
  }, [isOnline]);

  /**
   * Clear all completed generations
   */
  const clearCompleted = useCallback(async () => {
    const completedItems = queue.filter(item => item.status === 'completed');
    const completedIds = completedItems.map(item => item.id);
    
    // Delete from Firestore if online
    if (isOnline && completedIds.length > 0) {
      try {
        await generationsService.deleteGenerations(completedIds);
      } catch (firestoreError) {
        console.error('Failed to delete completed items from Firestore, continuing with local state:', firestoreError);
      }
    }

    setQueue(prev => {
      const completedItems = prev.filter(item => item.status === 'completed');
      
      // Clean up thumbnails for completed items
      completedItems.forEach(item => {
        if (item.thumbnails?.image1 && item.thumbnails.image1.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image1);
        }
        if (item.thumbnails?.image2 && item.thumbnails.image2.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image2);
        }
      });

      return prev.filter(item => item.status !== 'completed');
    });
  }, [queue, isOnline]);

  /**
   * Clear all failed generations
   */
  const clearFailed = useCallback(async () => {
    const failedItems = queue.filter(item => item.status === 'failed');
    const failedIds = failedItems.map(item => item.id);
    
    // Delete from Firestore if online
    if (isOnline && failedIds.length > 0) {
      try {
        await generationsService.deleteGenerations(failedIds);
      } catch (firestoreError) {
        console.error('Failed to delete failed items from Firestore, continuing with local state:', firestoreError);
      }
    }

    setQueue(prev => {
      const failedItems = prev.filter(item => item.status === 'failed');
      
      // Clean up thumbnails for failed items
      failedItems.forEach(item => {
        if (item.thumbnails?.image1 && item.thumbnails.image1.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image1);
        }
        if (item.thumbnails?.image2 && item.thumbnails.image2.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image2);
        }
      });

      return prev.filter(item => item.status !== 'failed');
    });
  }, [queue, isOnline]);

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
        if (item.thumbnails?.image1 && item.thumbnails.image1.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image1);
        }
        if (item.thumbnails?.image2 && item.thumbnails.image2.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.image2);
        }
      });
    };
  }, []);

  return {
    queue,
    activeGenerations,
    isLoading,
    isOnline,
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