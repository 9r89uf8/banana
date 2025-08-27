export const validateImageFile = (file, maxSize = 15 * 1024 * 1024) => {
  if (!file) {
    throw new Error('No file selected');
  }

  // Validate MIME type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Please select a valid image file (JPEG, PNG, or WebP)');
  }

  // Validate file size (default 15MB to handle high-res images)
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    throw new Error(`Image file size must be less than ${maxMB}MB`);
  }

  return true;
};

// Server-side validation for uploaded files
export const validateImageBuffer = (buffer, mimeType, maxSize = 15 * 1024 * 1024) => {
  if (!buffer || buffer.length === 0) {
    throw new Error('No image data received');
  }

  // Validate MIME type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(mimeType?.toLowerCase())) {
    throw new Error('Invalid image type. Only JPEG, PNG, and WebP are allowed.');
  }

  // Validate file size
  if (buffer.length > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    throw new Error(`Image size too large. Maximum ${maxMB}MB allowed.`);
  }

  // Basic magic number validation
  const magicNumbers = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
  };

  const signature = magicNumbers[mimeType?.toLowerCase()];
  if (signature && buffer.length >= signature.length) {
    const matches = signature.every((byte, index) => buffer[index] === byte);
    if (!matches) {
      throw new Error('File content does not match declared image type');
    }
  }

  return true;
};

export const compressImage = (file, maxWidth = 1024, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Improved resizing function that handles images > 8MP
export const resizeImageForProcessing = (file, maxLongestEdge = 2048) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Only downscale if image is larger than target
      const longestEdge = Math.max(img.width, img.height);
      if (longestEdge <= maxLongestEdge) {
        // Image is already small enough, return as-is
        resolve(file);
        return;
      }
      
      const ratio = maxLongestEdge / longestEdge;
      const newWidth = Math.round(img.width * ratio);
      const newHeight = Math.round(img.height * ratio);
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            reject(new Error('Failed to resize image'));
          }
        },
        file.type,
        0.9
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for resizing'));
    img.src = URL.createObjectURL(file);
  });
};

export const padImageToSquare = (file, targetSize = 1024, paddingColor = 'black') => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = targetSize;
      canvas.height = targetSize;
      
      // Fill with padding color
      ctx.fillStyle = paddingColor;
      ctx.fillRect(0, 0, targetSize, targetSize);
      
      // Calculate positioning to center the image
      const scale = Math.min(targetSize / img.width, targetSize / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (targetSize - scaledWidth) / 2;
      const y = (targetSize - scaledHeight) / 2;
      
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            reject(new Error('Failed to pad image'));
          }
        },
        file.type,
        0.9
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for padding'));
    img.src = URL.createObjectURL(file);
  });
};

export const markPositionOnImage = (file, positionX, positionY, markerSize = 20) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);
      
      // Calculate marker position (positionX and positionY are percentages)
      const markerX = (positionX / 100) * img.width;
      const markerY = (positionY / 100) * img.height;
      
      // Draw red circle marker
      ctx.beginPath();
      ctx.arc(markerX, markerY, markerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], `marked_${file.name}`, { type: file.type }));
          } else {
            reject(new Error('Failed to mark position on image'));
          }
        },
        file.type,
        0.9
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for marking'));
    img.src = URL.createObjectURL(file);
  });
};

export const calculateRelativePosition = (absoluteX, absoluteY, imageWidth, imageHeight) => {
  return {
    xPercent: (absoluteX / imageWidth) * 100,
    yPercent: (absoluteY / imageHeight) * 100
  };
};

export const cropToOriginalAspectRatio = (processedImageFile, originalWidth, originalHeight) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate crop dimensions to match original aspect ratio
      const originalAspect = originalWidth / originalHeight;
      const processedAspect = img.width / img.height;
      
      let cropWidth, cropHeight, cropX, cropY;
      
      if (originalAspect > processedAspect) {
        // Original is wider, crop height
        cropWidth = img.width;
        cropHeight = img.width / originalAspect;
        cropX = 0;
        cropY = (img.height - cropHeight) / 2;
      } else {
        // Original is taller, crop width
        cropHeight = img.height;
        cropWidth = img.height * originalAspect;
        cropX = (img.width - cropWidth) / 2;
        cropY = 0;
      }
      
      canvas.width = originalWidth;
      canvas.height = originalHeight;
      
      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, originalWidth, originalHeight
      );
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], processedImageFile.name, { type: processedImageFile.type }));
          } else {
            reject(new Error('Failed to crop image'));
          }
        },
        processedImageFile.type,
        0.9
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = URL.createObjectURL(processedImageFile);
  });
};

export const convertPositionToSemanticDescription = (positionX, positionY) => {
  let horizontalDesc, verticalDesc;
  
  // Horizontal position
  if (positionX < 25) {
    horizontalDesc = 'on the left side';
  } else if (positionX < 40) {
    horizontalDesc = 'on the left';
  } else if (positionX < 60) {
    horizontalDesc = 'in the center';
  } else if (positionX < 75) {
    horizontalDesc = 'on the right';
  } else {
    horizontalDesc = 'on the right side';
  }
  
  // Vertical position
  if (positionY < 25) {
    verticalDesc = 'at the top';
  } else if (positionY < 40) {
    verticalDesc = 'in the upper area';
  } else if (positionY < 60) {
    verticalDesc = 'in the middle';
  } else if (positionY < 75) {
    verticalDesc = 'in the lower area';
  } else {
    verticalDesc = 'at the bottom';
  }
  
  return `${horizontalDesc} ${verticalDesc}`;
};

export const generatePromptSuggestions = (type) => {
  const suggestions = {
    generate: [
      'A serene landscape with mountains and a crystal clear lake',
      'A futuristic city skyline at sunset with flying cars',
      'A cozy coffee shop interior with warm lighting and books',
      'An abstract painting with vibrant colors and geometric shapes',
      'A magical forest with glowing mushrooms and fairy lights',
      'A minimalist modern living room with plants and natural light'
    ],
    edit: [
      'Change the background to a sunset scene',
      'Add vibrant colors and make it more artistic',
      'Remove the background and make it transparent',
      'Apply a vintage filter with warm tones',
      'Add snow falling in the scene',
      'Transform into a watercolor painting style'
    ]
  };

  return suggestions[type] || [];
};