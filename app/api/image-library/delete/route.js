import { NextRequest, NextResponse } from 'next/server';
import { imageLibraryServiceServer } from '@/app/services/firebase/imageLibraryServiceServer';

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');
    
    if (!imageId) {
      throw new Error('Missing imageId parameter');
    }
    
    console.log('Processing image library delete request:', {
      imageId: imageId.substring(0, 8) + '***'
    });

    // Delete the image from Firestore
    // Note: This doesn't delete the actual file from Firebase Storage
    // You might want to add that functionality for cleanup
    await imageLibraryServiceServer.deleteImage(imageId);

    console.log('Image successfully deleted from library');
    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
      imageId: imageId
    });

  } catch (error) {
    console.error('Error in image-library delete API:', error);
    
    if (error.message.includes('Missing imageId')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to delete image from library' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, imageIds, imageId } = body;
    
    console.log('Processing image library delete action:', action);
    
    switch (action) {
      case 'deleteMultiple':
        if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
          throw new Error('Missing or invalid imageIds parameter');
        }
        
        console.log(`Deleting ${imageIds.length} images from library`);
        await imageLibraryServiceServer.deleteImages(imageIds);
        
        return NextResponse.json({
          success: true,
          message: `Successfully deleted ${imageIds.length} images`,
          deletedCount: imageIds.length
        });
        
      case 'deleteSingle':
        if (!imageId) {
          throw new Error('Missing imageId parameter');
        }
        
        await imageLibraryServiceServer.deleteImage(imageId);
        
        return NextResponse.json({
          success: true,
          message: 'Image deleted successfully',
          imageId: imageId
        });
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
  } catch (error) {
    console.error('Error in image-library delete POST API:', error);
    
    if (error.message.includes('Missing') || error.message.includes('invalid') || error.message.includes('Unknown action')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to delete images from library' },
      { status: 500 }
    );
  }
}