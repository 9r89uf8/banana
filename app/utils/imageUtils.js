export const validateImageFile = (file) => {
  if (!file) {
    throw new Error('No file selected');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file');
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error('Image file size must be less than 10MB');
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