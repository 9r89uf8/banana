import { NextRequest, NextResponse } from 'next/server';
import { geminiService, GenerationRefusedError } from '@/app/services/geminiService';
import { uploadToFirebaseStorage } from '@/app/middleware/firebaseStorage';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Generate image using Gemini
    const imageBuffer = await geminiService.generateImage(prompt);

    // Generate unique filename
    const fileName = `generated-images/${uuidv4()}.png`;

    // Upload to Firebase Storage
    const imageUrl = await uploadToFirebaseStorage(
      imageBuffer,
      fileName,
      'image/png'
    );

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt,
      fileName
    });

  } catch (error) {
    console.error('Error in generate-image API:', error);
    
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
    
    // Handle other errors as server errors
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    );
  }
}