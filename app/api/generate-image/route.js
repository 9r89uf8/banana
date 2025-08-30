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
    
    // Validate images
    const validatedImages = await ImageValidationMiddleware.validateImages(
      formData,
      ['image1', 'image2']
    );
    
    // Get and validate prompt
    const prompt = formData.get('prompt');
    if (!prompt || !prompt.trim()) {
      throw new Error('Missing required parameter: prompt');
    }

    console.log('Processing image generation request:', {
      prompt: prompt.substring(0, 100) + '...',
      image1Size: validatedImages.image1.size,
      image2Size: validatedImages.image2.size,
      clientIP: clientIP.substring(0, 8) + '***'
    });

    // Use validated image buffers
    const image1Buffer = validatedImages.image1.buffer;
    const image2Buffer = validatedImages.image2.buffer;

    // Upload reference images to Firebase Storage first
    console.log('Uploading reference images to Firebase...');
    const generationId = uuidv4();
    
    const [referenceImage1Url, referenceImage2Url] = await Promise.all([
      uploadToFirebaseStorage(
        image1Buffer,
        `reference-images/${generationId}-ref1.${validatedImages.image1.originalName?.split('.').pop() || 'jpg'}`,
        validatedImages.image1.mimeType
      ),
      uploadToFirebaseStorage(
        image2Buffer,
        `reference-images/${generationId}-ref2.${validatedImages.image2.originalName?.split('.').pop() || 'jpg'}`,
        validatedImages.image2.mimeType
      )
    ]);

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
        'Reference images uploaded to storage',
        'Images converted to buffers',
        'AI generation with reference images and prompt',
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