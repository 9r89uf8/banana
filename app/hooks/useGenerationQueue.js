'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generationsService } from '@/app/services/firebase/generationsService';

/**
 * Hook for managing the generation queue state and operations
 */
export const useGenerationQueue = () => {
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
        console.error('Failed to load generation queue:', error);
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
  const addToQueue = useCallback(async (generationData) => {
    const id = uuidv4();
    
    const newGeneration = {
      id,
      status: 'pending',
      timestamp: new Date(),
      progress: 0,
      result: null,
      error: null,
      ...generationData
    };

    setQueue(prev => [newGeneration, ...prev]);
    
    // Save to Firestore if online
    if (isOnline) {
      try {
        await generationsService.saveGeneration(newGeneration);
      } catch (firestoreError) {
        console.error('Failed to save to Firestore, continuing with local state:', firestoreError);
      }
    }
    
    return id;
  }, [isOnline]);

  /**
   * Retry a failed generation
   */
  const retryGeneration = useCallback(async (id) => {
    const updates = { 
      status: 'pending', 
      progress: 0, 
      error: null 
    };

    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
    
    // Update in Firestore if online
    if (isOnline) {
      try {
        await generationsService.updateGeneration(id, updates);
      } catch (firestoreError) {
        console.error('Failed to update Firestore, continuing with local state:', firestoreError);
      }
    }
  }, [isOnline]);

  /**
   * Run a completed generation again with same prompt and data
   */
  const runAgain = useCallback(async (originalGeneration) => {
    const newId = uuidv4();
    
    const newGeneration = {
      ...originalGeneration,
      id: newId,
      status: 'pending',
      timestamp: new Date(),
      progress: 0,
      result: null,
      error: null
    };

    setQueue(prev => [newGeneration, ...prev]);
    
    // Save to Firestore if online
    if (isOnline) {
      try {
        await generationsService.saveGeneration(newGeneration);
      } catch (firestoreError) {
        console.error('Failed to save to Firestore, continuing with local state:', firestoreError);
      }
    }
    
    return newId;
  }, [isOnline]);

  /**
   * Remove a generation from the queue and database
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
        if (item.thumbnails.main && item.thumbnails.main.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.main);
        }
        if (item.thumbnails.person && item.thumbnails.person.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.person);
        }
      }

      return prev.filter(item => item.id !== id);
    });
  }, [isOnline]);

  /**
   * Clear all completed generations from queue and database
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
        if (item.thumbnails?.main && item.thumbnails.main.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.main);
        }
        if (item.thumbnails?.person && item.thumbnails.person.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.person);
        }
      });

      return prev.filter(item => item.status !== 'completed');
    });
  }, [queue, isOnline]);

  /**
   * Clear all failed generations from queue and database
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
        if (item.thumbnails?.main && item.thumbnails.main.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.main);
        }
        if (item.thumbnails?.person && item.thumbnails.person.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.person);
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
        if (item.thumbnails?.main && item.thumbnails.main.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.main);
        }
        if (item.thumbnails?.person && item.thumbnails.person.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnails.person);
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