import { NextRequest, NextResponse } from 'next/server';
import { geminiComposeService, GenerationRefusedError } from '@/app/services/gemini';
import { uploadToFirebaseStorage } from '@/app/middleware/firebaseStorage';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const mainImage = formData.get('mainImage');
    const objectImage = formData.get('objectImage');
    const positionX = parseFloat(formData.get('positionX'));
    const positionY = parseFloat(formData.get('positionY'));
    const sceneDescription = formData.get('sceneDescription') || '';
    const objectDescription = formData.get('objectDescription') || '';
    const interactionIntent = formData.get('interactionIntent') || 'auto';
    const interactionCustom = formData.get('interactionCustom') || '';

    // Validate required fields
    if (!mainImage || !objectImage) {
      return NextResponse.json(
        { error: 'Both main image and object image are required' },
        { status: 400 }
      );
    }

    if (isNaN(positionX) || isNaN(positionY)) {
      return NextResponse.json(
        { error: 'Valid position coordinates are required' },
        { status: 400 }
      );
    }

    console.log('Processing composition request:', {
      positionX,
      positionY,
      sceneDescription,
      objectDescription,
      interactionIntent,
      interactionCustom,
      mainImageSize: mainImage.size,
      objectImageSize: objectImage.size
    });

    // Convert uploaded images to buffers for Gemini
    console.log('Converting images to buffers...');
    const mainImageBuffer = Buffer.from(await mainImage.arrayBuffer());
    const objectImageBuffer = Buffer.from(await objectImage.arrayBuffer());

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