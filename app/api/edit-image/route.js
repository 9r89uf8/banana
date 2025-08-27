import { NextRequest, NextResponse } from 'next/server';
import { geminiEditService, GenerationRefusedError } from '@/app/services/gemini';
import { uploadToFirebaseStorage } from '@/app/middleware/firebaseStorage';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');
    const editPrompt = formData.get('editPrompt');

    if (!image || !editPrompt) {
      return NextResponse.json(
        { error: 'Image and edit prompt are required' },
        { status: 400 }
      );
    }

    // Convert uploaded image to buffer
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    // Edit image using Gemini
    const editedImageBuffer = await geminiEditService.editImage(imageBuffer, editPrompt);

    // Generate unique filename
    const fileName = `edited-images/${uuidv4()}.png`;

    // Upload to Firebase Storage
    const imageUrl = await uploadToFirebaseStorage(
      editedImageBuffer,
      fileName,
      'image/png'
    );

    return NextResponse.json({
      success: true,
      imageUrl,
      editPrompt,
      fileName
    });

  } catch (error) {
    console.error('Error in edit-image API:', error);
    
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
      { error: error.message || 'Failed to edit image' },
      { status: 500 }
    );
  }
}