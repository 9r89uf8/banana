import { NextRequest, NextResponse } from 'next/server';
import { geminiPersonComposeService, GenerationRefusedError } from '@/app/services/gemini';
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
      ['mainImage', 'personImage']
    );
    
    // Get and validate prompt
    const prompt = formData.get('prompt');
    if (!prompt || !prompt.trim()) {
      throw new Error('Missing required parameter: prompt');
    }

    console.log('Processing people composition request:', {
      prompt: prompt.substring(0, 100) + '...',
      mainImageSize: validatedImages.mainImage.size,
      personImageSize: validatedImages.personImage.size,
      clientIP: clientIP.substring(0, 8) + '***' // Log partial IP for debugging
    });

    // Use validated image buffers
    const mainImageBuffer = validatedImages.mainImage.buffer;
    const personImageBuffer = validatedImages.personImage.buffer;

    // Use Gemini service to compose the people with prompt
    console.log('Calling Gemini service for people composition...');
    const compositeImageBuffer = await geminiPersonComposeService.composePeople(
      mainImageBuffer,
      personImageBuffer,
      prompt
    );

    // Upload result to Firebase Storage
    console.log('Uploading composite result to Firebase...');
    const fileName = `people-compositions/${uuidv4()}.png`;
    const imageUrl = await uploadToFirebaseStorage(
      compositeImageBuffer,
      fileName,
      'image/png'
    );

    console.log('People composition completed successfully');
    return NextResponse.json({
      success: true,
      imageUrl,
      fileName,
      prompt,
      processingSteps: [
        'Images converted to buffers',
        'AI composition with natural language prompt',
        'Result uploaded to storage'
      ]
    });

  } catch (error) {
    console.error('Error in compose-people API:', error);
    
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
        { error: `People composition failed: ${error.message}` },
        { status: 400 }
      );
    }
    
    // Handle other errors as server errors
    return NextResponse.json(
      { error: error.message || 'Failed to compose people' },
      { status: 500 }
    );
  }
}