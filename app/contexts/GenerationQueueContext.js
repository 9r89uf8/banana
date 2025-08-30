'use client';

import { createContext, useContext } from 'react';
import { useGenerationQueue } from '@/app/hooks/useGenerationQueue';

const GenerationQueueContext = createContext();

/**
 * Provider component for the generation queue context
 */
export const GenerationQueueProvider = ({ children }) => {
  const queueData = useGenerationQueue();

  return (
    <GenerationQueueContext.Provider value={queueData}>
      {children}
    </GenerationQueueContext.Provider>
  );
};

/**
 * Hook to consume the generation queue context
 * @returns {Object} Queue operations and state
 */
export const useGenerationQueueContext = () => {
  const context = useContext(GenerationQueueContext);
  
  if (!context) {
    throw new Error(
      'useGenerationQueueContext must be used within a GenerationQueueProvider'
    );
  }
  
  return context;
};

/**
 * HOC to wrap components with queue context
 */
export const withGenerationQueue = (Component) => {
  return function WrappedComponent(props) {
    return (
      <GenerationQueueProvider>
        <Component {...props} />
      </GenerationQueueProvider>
    );
  };
};