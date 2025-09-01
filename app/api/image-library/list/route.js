import { NextRequest, NextResponse } from 'next/server';
import { imageLibraryServiceServer } from '@/app/services/firebase/imageLibraryServiceServer';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const userId = searchParams.get('userId') || 'anonymous';
    const maxResults = parseInt(searchParams.get('limit') || '50');
    const searchTerm = searchParams.get('search');
    const tags = searchParams.get('tags');
    const sortBy = searchParams.get('sortBy') || 'recent'; // recent, popular, name
    
    console.log('Processing image library list request:', {
      userId: userId.substring(0, 8) + '***',
      maxResults,
      searchTerm: searchTerm?.substring(0, 20),
      tags: tags?.substring(0, 50),
      sortBy
    });

    let images = [];
    
    // Handle different query types
    if (searchTerm) {
      // Search images by term
      images = await imageLibraryServiceServer.searchImages(searchTerm, userId, maxResults);
    } else if (tags) {
      // Filter by tags
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      images = await imageLibraryServiceServer.getImages(userId, maxResults, tagArray);
    } else {
      // Get all images with sorting
      switch (sortBy) {
        case 'popular':
          images = await imageLibraryServiceServer.getPopularImages(userId, maxResults);
          break;
        case 'recent':
        default:
          images = await imageLibraryServiceServer.getImages(userId, maxResults);
          break;
      }
    }

    // Sort images if needed (client-side sorting for name)
    if (sortBy === 'name') {
      images.sort((a, b) => a.name.localeCompare(b.name));
    }

    console.log(`Retrieved ${images.length} images from library`);
    return NextResponse.json({
      success: true,
      images: images,
      count: images.length,
      query: {
        userId: userId === 'anonymous' ? 'anonymous' : 'user',
        maxResults,
        searchTerm,
        tags,
        sortBy
      }
    });

  } catch (error) {
    console.error('Error in image-library list API:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve images from library' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, userId, ...params } = body;
    
    console.log('Processing image library action:', action);
    
    switch (action) {
      case 'getRecent':
        const recentImages = await imageLibraryServiceServer.getRecentImages(
          userId || 'anonymous', 
          params.limit || 10
        );
        return NextResponse.json({
          success: true,
          images: recentImages,
          count: recentImages.length
        });
        
      case 'getPopular':
        const popularImages = await imageLibraryServiceServer.getPopularImages(
          userId || 'anonymous',
          params.limit || 10
        );
        return NextResponse.json({
          success: true,
          images: popularImages,
          count: popularImages.length
        });
        
      case 'getTags':
        const tags = await imageLibraryServiceServer.getAllTags(userId || 'anonymous');
        return NextResponse.json({
          success: true,
          tags: tags,
          count: tags.length
        });
        
      case 'getStats':
        const stats = await imageLibraryServiceServer.getLibraryStats(userId || 'anonymous');
        return NextResponse.json({
          success: true,
          stats: stats
        });
        
      case 'recordUsage':
        if (!params.imageId) {
          throw new Error('Missing imageId parameter');
        }
        await imageLibraryServiceServer.recordImageUsage(params.imageId);
        return NextResponse.json({
          success: true,
          message: 'Usage recorded successfully'
        });
        
      case 'updateTags':
        if (!params.imageId || !params.tags) {
          throw new Error('Missing imageId or tags parameter');
        }
        
        if (params.operation === 'add') {
          await imageLibraryServiceServer.addTags(params.imageId, params.tags);
        } else if (params.operation === 'remove') {
          await imageLibraryServiceServer.removeTags(params.imageId, params.tags);
        } else {
          // Replace tags
          await imageLibraryServiceServer.updateImage(params.imageId, { tags: params.tags });
        }
        
        return NextResponse.json({
          success: true,
          message: 'Tags updated successfully'
        });
        
      case 'updateImage':
        if (!params.imageId) {
          throw new Error('Missing imageId parameter');
        }
        
        const updateData = {};
        if (params.name) updateData.name = params.name;
        if (params.description) updateData.description = params.description;
        if (params.tags) updateData.tags = params.tags;
        
        await imageLibraryServiceServer.updateImage(params.imageId, updateData);
        return NextResponse.json({
          success: true,
          message: 'Image updated successfully'
        });
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
  } catch (error) {
    console.error('Error in image-library list POST API:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to process library action' },
      { status: 400 }
    );
  }
}