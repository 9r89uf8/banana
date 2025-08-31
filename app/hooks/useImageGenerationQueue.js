'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generationsService } from '@/app/services/firebase/generationsService';

const STORAGE_KEY = 'imageGenerationQueue';

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

  // Load queue from Firestore on mount with fallback to localStorage and migration
  useEffect(() => {
    const loadQueue = async () => {
      try {
        setIsLoading(true);
        
        if (isOnline) {
          // Try to load from Firestore first
          const firestoreGenerations = await generationsService.getGenerations();
          
          // Check for localStorage data to migrate
          const localStorageData = localStorage.getItem(STORAGE_KEY);
          let localGenerations = [];
          
          if (localStorageData) {
            try {
              const parsedLocalData = JSON.parse(localStorageData);
              localGenerations = parsedLocalData.map(item => ({
                ...item,
                timestamp: new Date(item.timestamp)
              }));
            } catch (parseError) {
              console.error('Failed to parse localStorage data:', parseError);
            }
          }
          
          // Migrate localStorage data to Firestore if it doesn't exist there
          const migratedGenerations = [];
          if (localGenerations.length > 0) {
            console.log(`Found ${localGenerations.length} generations in localStorage, checking for migration...`);
            
            const firestoreIds = new Set(firestoreGenerations.map(fg => fg.id));
            const generationsToMigrate = localGenerations.filter(lg => !firestoreIds.has(lg.id));
            
            if (generationsToMigrate.length > 0) {
              console.log(`Migrating ${generationsToMigrate.length} generations to Firestore...`);
              
              for (const generation of generationsToMigrate) {
                try {
                  // Only migrate completed or failed generations (don't migrate File objects)
                  if (generation.status === 'completed' || generation.status === 'failed') {
                    const migrationData = {
                      id: generation.id,
                      status: generation.status,
                      prompt: generation.prompt,
                      timestamp: generation.timestamp,
                      progress: generation.progress || 0,
                      error: generation.error || null,
                      // For localStorage migrations, we might not have reference image URLs
                      referenceImage1Url: generation.referenceImage1Url || null,
                      referenceImage2Url: generation.referenceImage2Url || null,
                      imageUrl: generation.result?.imageUrl || null,
                      result: generation.result || null,
                      thumbnails: generation.thumbnails || null
                    };
                    
                    await generationsService.saveGeneration(migrationData);
                    migratedGenerations.push(migrationData);
                  }
                } catch (migrationError) {
                  console.error(`Failed to migrate generation ${generation.id}:`, migrationError);
                }
              }
              
              console.log(`Successfully migrated ${migratedGenerations.length} generations to Firestore`);
            }
          }
          
          // Combine Firestore data with any newly migrated data
          const allGenerations = [...firestoreGenerations, ...migratedGenerations];
          
          // Mark any active generations as failed (in case of browser crash/reload)
          const restoredQueue = allGenerations.map(item => ({
            ...item,
            status: ['pending', 'uploading', 'processing'].includes(item.status) 
              ? 'failed' : item.status
          }));
          
          setQueue(restoredQueue);
          
          // Update failed generations in Firestore
          const failedUpdates = restoredQueue
            .filter(item => item.status === 'failed' && 
              ['pending', 'uploading', 'processing'].includes(
                allGenerations.find(ag => ag.id === item.id)?.status
              ))
            .map(item => generationsService.updateGeneration(item.id, { status: 'failed' }));
          
          if (failedUpdates.length > 0) {
            await Promise.all(failedUpdates);
          }
          
          // Clear localStorage after successful migration (keep as backup but mark as migrated)
          if (migratedGenerations.length > 0) {
            localStorage.setItem(STORAGE_KEY + '_migrated', 'true');
          }
          
        } else {
          // Fallback to localStorage when offline
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsedQueue = JSON.parse(saved);
            const restoredQueue = parsedQueue.map(item => ({
              ...item,
              status: ['pending', 'uploading', 'processing'].includes(item.status) 
                ? 'failed' : item.status,
              timestamp: new Date(item.timestamp)
            }));
            setQueue(restoredQueue);
          }
        }
      } catch (error) {
        console.error('Failed to load image generation queue:', error);
        
        // Fallback to localStorage on error
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsedQueue = JSON.parse(saved);
            const restoredQueue = parsedQueue.map(item => ({
              ...item,
              status: ['pending', 'uploading', 'processing'].includes(item.status) 
                ? 'failed' : item.status,
              timestamp: new Date(item.timestamp)
            }));
            setQueue(restoredQueue);
          }
        } catch (localError) {
          console.error('Failed to load from localStorage fallback:', localError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadQueue();
  }, [isOnline]);

  // Save queue to localStorage as backup (always maintain local backup)
  useEffect(() => {
    if (isLoading) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save image generation queue to localStorage:', error);
    }
  }, [queue, isLoading]);

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
    
    // Create thumbnails for preview (only for images that exist)
    const thumbnails = {};
    if (image1) {
      thumbnails.image1 = URL.createObjectURL(image1);
    }
    if (image2) {
      thumbnails.image2 = URL.createObjectURL(image2);
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
      // Keep original files for processing (can be null)
      image1,
      image2
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
      
      // Only append images that exist
      if (generation.image1) {
        formData.append('image1', generation.image1);
      }
      if (generation.image2) {
        formData.append('image2', generation.image2);
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