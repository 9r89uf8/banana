import { NextRequest, NextResponse } from 'next/server';
import { geminiGenerateService, GenerationRefusedError } from '@/app/services/gemini';
import { uploadToFirebaseStorage } from '@/app/middleware/firebaseStorage';
import { ImageValidationMiddleware } from '@/app/middleware/imageValidationMiddleware';
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
    
    // Get images from form data (both are optional)
    const image1File = formData.get('image1');
    const image2File = formData.get('image2');
    
    // Validate only the images that are provided
    const imageFields = [];
    if (image1File && image1File.size > 0) imageFields.push('image1');
    if (image2File && image2File.size > 0) imageFields.push('image2');
    
    let validatedImages = {};
    if (imageFields.length > 0) {
      validatedImages = await ImageValidationMiddleware.validateImages(
        formData,
        imageFields
      );
    }
    
    // Get and validate prompt
    const prompt = formData.get('prompt');
    if (!prompt || !prompt.trim()) {
      throw new Error('Missing required parameter: prompt');
    }

    console.log('Processing image generation request:', {
      prompt: prompt.substring(0, 100) + '...',
      image1Size: validatedImages.image1?.size || 'none',
      image2Size: validatedImages.image2?.size || 'none',
      clientIP: clientIP.substring(0, 8) + '***'
    });

    // Use validated image buffers (if they exist)
    const image1Buffer = validatedImages.image1?.buffer || null;
    const image2Buffer = validatedImages.image2?.buffer || null;

    // Upload reference images to Firebase Storage (only if they exist)
    const generationId = uuidv4();
    let referenceImage1Url = null;
    let referenceImage2Url = null;
    
    const uploadPromises = [];
    
    if (image1Buffer) {
      console.log('Uploading reference image 1 to Firebase...');
      uploadPromises.push(
        uploadToFirebaseStorage(
          image1Buffer,
          `reference-images/${generationId}-ref1.${validatedImages.image1.originalName?.split('.').pop() || 'jpg'}`,
          validatedImages.image1.mimeType
        ).then(url => referenceImage1Url = url)
      );
    }
    
    if (image2Buffer) {
      console.log('Uploading reference image 2 to Firebase...');
      uploadPromises.push(
        uploadToFirebaseStorage(
          image2Buffer,
          `reference-images/${generationId}-ref2.${validatedImages.image2.originalName?.split('.').pop() || 'jpg'}`,
          validatedImages.image2.mimeType
        ).then(url => referenceImage2Url = url)
      );
    }
    
    if (uploadPromises.length > 0) {
      await Promise.all(uploadPromises);
    }

    // Generate image using Gemini
    console.log('Calling Gemini service for image generation...');
    const imageBuffer = await geminiGenerateService.generateImage(image1Buffer, image2Buffer, prompt);

    // Generate unique filename for generated image
    console.log('Uploading generated image to Firebase...');
    const fileName = `generated-images/${generationId}.png`;

    // Upload generated image to Firebase Storage
    const imageUrl = await uploadToFirebaseStorage(
      imageBuffer,
      fileName,
      'image/png'
    );

    console.log('Image generation completed successfully');
    return NextResponse.json({
      success: true,
      generationId,
      imageUrl,
      referenceImage1Url,
      referenceImage2Url,
      prompt,
      fileName,
      processingSteps: [
        image1Buffer || image2Buffer ? 'Reference images uploaded to storage' : 'Text-only generation (no reference images)',
        image1Buffer || image2Buffer ? 'Images converted to buffers' : 'Processing text prompt',
        image1Buffer || image2Buffer ? 'AI generation with reference images and prompt' : 'AI generation with text prompt only',
        'Generated image uploaded to storage'
      ]
    });

  } catch (error) {
    console.error('Error in generate-image API:', error);
    
    // Handle validation and rate limiting errors
    if (error.message.includes('Rate limit') || 
        error.message.includes('Invalid') ||
        error.message.includes('Missing required') ||
        error.message.includes('Image size too large') ||
        error.message.includes('File content does not match')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    // Handle refusal errors separately from server errors
    if (error instanceof GenerationRefusedError) {
      return NextResponse.json(
        { 
          error: error.message,
          isRefusal: true,
          reason: error.reason
        },
        { status: 400 }
      );
    }
    
    // Handle processing errors
    if (error.message.includes('Failed to')) {
      return NextResponse.json(
        { error: `Image generation failed: ${error.message}` },
        { status: 400 }
      );
    }
    
    // Handle other errors as server errors
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    );
  }
}