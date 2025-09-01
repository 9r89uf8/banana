import { NextRequest, NextResponse } from 'next/server';
import { uploadToFirebaseStorage } from '@/app/middleware/firebaseStorage';
import { ImageValidationMiddleware } from '@/app/middleware/imageValidationMiddleware';
import { imageLibraryServiceServer } from '@/app/services/firebase/imageLibraryServiceServer';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     '127.0.0.1';
    
    // Check rate limit
    ImageValidationMiddleware.checkRateLimit(clientIP);
    
    // Get image file from form data
    const imageFile = formData.get('image');
    if (!imageFile || imageFile.size === 0) {
      throw new Error('No image file provided');
    }
    
    // Get optional metadata
    const name = formData.get('name') || imageFile.name || `Image ${Date.now()}`;
    const description = formData.get('description') || '';
    const tagsString = formData.get('tags') || '';
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const userId = formData.get('userId') || 'anonymous';

    // Validate the image file
    const validatedImages = await ImageValidationMiddleware.validateImages(
      formData,
      ['image']
    );
    
    const validatedImage = validatedImages.image;
    if (!validatedImage) {
      throw new Error('Image validation failed');
    }

    console.log('Processing image library upload:', {
      name: name.substring(0, 50) + '...',
      fileSize: validatedImage.size,
      mimeType: validatedImage.mimeType,
      tags: tags.slice(0, 5),
      clientIP: clientIP.substring(0, 8) + '***'
    });

    // Generate unique ID and filename
    const imageId = uuidv4();
    const fileName = `library-images/${imageId}.${validatedImage.originalName?.split('.').pop() || 'jpg'}`;
    
    // Upload image to Firebase Storage
    console.log('Uploading image to Firebase Storage...');
    const imageUrl = await uploadToFirebaseStorage(
      validatedImage.buffer,
      fileName,
      validatedImage.mimeType
    );

    // Get image dimensions (basic implementation)
    let dimensions = { width: 0, height: 0 };
    try {
      // For a more robust solution, you might want to use a library like 'sharp' or 'image-size'
      // For now, we'll leave dimensions as default
      console.log('Image dimensions detection not implemented yet');
    } catch (dimensionError) {
      console.warn('Could not determine image dimensions:', dimensionError.message);
    }

    // Create thumbnail URL (for now, use the same as main image)
    // In a production app, you might want to generate actual thumbnails
    const thumbnailUrl = imageUrl;

    // Save to image library in Firestore
    console.log('Saving image metadata to library...');
    const libraryImageData = {
      id: imageId,
      name: name,
      description: description,
      imageUrl: imageUrl,
      thumbnailUrl: thumbnailUrl,
      tags: tags,
      fileSize: validatedImage.size,
      dimensions: dimensions,
      mimeType: validatedImage.mimeType,
      originalFileName: validatedImage.originalName,
      userId: userId
    };

    await imageLibraryServiceServer.saveImage(libraryImageData);

    console.log('Image successfully added to library');
    return NextResponse.json({
      success: true,
      imageId: imageId,
      imageUrl: imageUrl,
      thumbnailUrl: thumbnailUrl,
      name: name,
      description: description,
      tags: tags,
      fileSize: validatedImage.size,
      dimensions: dimensions,
      mimeType: validatedImage.mimeType
    });

  } catch (error) {
    console.error('Error in image-library upload API:', error);
    
    // Handle validation and rate limiting errors
    if (error.message.includes('Rate limit') || 
        error.message.includes('Invalid') ||
        error.message.includes('No image file') ||
        error.message.includes('Image size too large') ||
        error.message.includes('File content does not match')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    // Handle upload errors
    if (error.message.includes('Failed to upload') || 
        error.message.includes('Failed to save')) {
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 400 }
      );
    }
    
    // Handle other errors as server errors
    return NextResponse.json(
      { error: error.message || 'Failed to upload image to library' },
      { status: 500 }
    );
  }
}