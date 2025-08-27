import { NextRequest, NextResponse } from 'next/server';
import { geminiComposeService, GenerationRefusedError } from '@/app/services/gemini';
import { uploadToFirebaseStorage } from '@/app/middleware/firebaseStorage';
import { ImageValidationMiddleware, validators } from '@/app/middleware/imageValidationMiddleware';
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
      ['mainImage', 'objectImage']
    );
    
    // Validate parameters
    const params = ImageValidationMiddleware.validateFormParams(
      formData,
      {
        positionX: validators.percentage,
        positionY: validators.percentage
      },
      {
        sceneDescription: validators.string,
        objectDescription: validators.string,
        interactionIntent: validators.enum([
          'auto', 'hold_grasp', 'place_on_surface', 'wear', 
          'hang', 'lean', 'float', 'custom'
        ]),
        interactionCustom: validators.string
      }
    );
    
    const {
      positionX,
      positionY,
      sceneDescription = '',
      objectDescription = '',
      interactionIntent = 'auto',
      interactionCustom = ''
    } = params;

    console.log('Processing composition request:', {
      positionX,
      positionY,
      sceneDescription: sceneDescription || '[empty]',
      objectDescription: objectDescription || '[empty]',
      interactionIntent,
      interactionCustom: interactionCustom || '[empty]',
      mainImageSize: validatedImages.mainImage.size,
      objectImageSize: validatedImages.objectImage.size,
      clientIP: clientIP.substring(0, 8) + '***' // Log partial IP for debugging
    });

    // Use validated image buffers
    const mainImageBuffer = validatedImages.mainImage.buffer;
    const objectImageBuffer = validatedImages.objectImage.buffer;

    // Use Gemini service to compose the images directly
    console.log('Calling Gemini service for composition...');
    const compositeImageBuffer = await geminiComposeService.composeImages(
      mainImageBuffer,
      objectImageBuffer,
      positionX,
      positionY,
      sceneDescription,
      objectDescription,
      interactionIntent,
      interactionCustom
    );

    // Upload result to Firebase Storage
    console.log('Uploading composite result to Firebase...');
    const fileName = `composite-images/${uuidv4()}.png`;
    const imageUrl = await uploadToFirebaseStorage(
      compositeImageBuffer,
      fileName,
      'image/png'
    );

    console.log('Composition completed successfully');
    return NextResponse.json({
      success: true,
      imageUrl,
      fileName,
      position: {
        x: positionX,
        y: positionY
      },
      sceneDescription: sceneDescription || null,
      objectDescription: objectDescription || null,
      interactionIntent: interactionIntent || null,
      interactionCustom: interactionCustom || null,
      processingSteps: [
        'Images converted to buffers',
        'Semantic location analysis with interaction intent',
        'Advanced AI composition with occlusion handling',
        'Result uploaded to storage'
      ]
    });

  } catch (error) {
    console.error('Error in compose-images API:', error);
    
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
        { error: `Image processing failed: ${error.message}` },
        { status: 400 }
      );
    }
    
    // Handle other errors as server errors
    return NextResponse.json(
      { error: error.message || 'Failed to compose images' },
      { status: 500 }
    );
  }
}