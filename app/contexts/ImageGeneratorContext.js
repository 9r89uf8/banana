'use client';

import { createContext, useContext } from 'react';

const ImageGeneratorContext = createContext();

/**
 * Provider component for the image generator context
 */
export const ImageGeneratorProvider = ({ children, setGeneratedAsReference1, setGeneratedAsReference2 }) => {
  const contextValue = {
    setGeneratedAsReference1,
    setGeneratedAsReference2
  };

  return (
    <ImageGeneratorContext.Provider value={contextValue}>
      {children}
    </ImageGeneratorContext.Provider>
  );
};

/**
 * Hook to consume the image generator context
 * @returns {Object} Reference setter methods
 */
export const useImageGeneratorContext = () => {
  const context = useContext(ImageGeneratorContext);
  
  if (!context) {
    throw new Error(
      'useImageGeneratorContext must be used within an ImageGeneratorProvider'
    );
  }
  
  return context;
};