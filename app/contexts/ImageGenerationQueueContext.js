'use client';

import { createContext, useContext } from 'react';
import { useImageGenerationQueue } from '@/app/hooks/useImageGenerationQueue';

const ImageGenerationQueueContext = createContext();

/**
 * Provider component for the image generation queue context
 */
export const ImageGenerationQueueProvider = ({ children }) => {
  const queueData = useImageGenerationQueue();

  return (
    <ImageGenerationQueueContext.Provider value={queueData}>
      {children}
    </ImageGenerationQueueContext.Provider>
  );
};

/**
 * Hook to consume the image generation queue context
 * @returns {Object} Queue operations and state
 */
export const useImageGenerationQueueContext = () => {
  const context = useContext(ImageGenerationQueueContext);
  
  if (!context) {
    throw new Error(
      'useImageGenerationQueueContext must be used within an ImageGenerationQueueProvider'
    );
  }
  
  return context;
};

/**
 * HOC to wrap components with image generation queue context
 */
export const withImageGenerationQueue = (Component) => {
  return function WrappedComponent(props) {
    return (
      <ImageGenerationQueueProvider>
        <Component {...props} />
      </ImageGenerationQueueProvider>
    );
  };
};