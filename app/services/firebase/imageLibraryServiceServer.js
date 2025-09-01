import { adminDb } from '@/app/utils/firebaseAdmin';

const IMAGE_LIBRARY_COLLECTION = 'imageLibrary';
const db = adminDb.firestore();

// Firebase Admin SDK uses different method names
const serverTimestamp = () => adminDb.firestore.FieldValue.serverTimestamp();
const arrayUnion = (...values) => adminDb.firestore.FieldValue.arrayUnion(...values);
const arrayRemove = (...values) => adminDb.firestore.FieldValue.arrayRemove(...values);
const increment = (value) => adminDb.firestore.FieldValue.increment(value);

export const imageLibraryServiceServer = {
  /**
   * Save a new image to the library
   * @param {Object} imageData - Image data
   * @returns {Promise<string>} Document ID
   */
  async saveImage(imageData) {
    try {
      if (!imageData.id) {
        throw new Error('Image must have an id field');
      }

      const libraryImageData = {
        id: imageData.id,
        name: imageData.name || `Image ${Date.now()}`,
        imageUrl: imageData.imageUrl,
        thumbnailUrl: imageData.thumbnailUrl || imageData.imageUrl,
        tags: imageData.tags || [],
        fileSize: imageData.fileSize || 0,
        dimensions: imageData.dimensions || { width: 0, height: 0 },
        mimeType: imageData.mimeType || 'image/jpeg',
        userId: imageData.userId || 'anonymous',
        uploadedAt: serverTimestamp(),
        lastUsedAt: serverTimestamp(),
        useCount: 0,
        description: imageData.description || '',
        originalFileName: imageData.originalFileName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = db.collection(IMAGE_LIBRARY_COLLECTION).doc(imageData.id);
      await docRef.set(libraryImageData);
      return imageData.id;
    } catch (error) {
      console.error('Error saving image to library:', error);
      throw new Error('Failed to save image to library');
    }
  },

  /**
   * Get all images from the library
   * @param {string} userId - Optional user ID to filter by
   * @param {number} maxResults - Maximum number of results (default: 100)
   * @param {Array<string>} tags - Optional tags to filter by
   * @returns {Promise<Array>} Array of images
   */
  async getImages(userId = null, maxResults = 100, tags = null) {
    try {
      let queryRef = db.collection(IMAGE_LIBRARY_COLLECTION)
        .where('userId', '==', userId || 'anonymous')
        .orderBy('lastUsedAt', 'desc')
        .limit(maxResults);

      // Note: Firestore doesn't support array-contains-any with orderBy on different fields
      // For now, we'll filter by tags in memory after fetching
      
      const querySnapshot = await queryRef.get();
      const images = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const image = {
          id: doc.id,
          ...data,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          lastUsedAt: data.lastUsedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };

        // Apply tag filtering if specified
        if (tags && tags.length > 0) {
          const hasMatchingTag = tags.some(tag => 
            image.tags && image.tags.some(imageTag => 
              imageTag.toLowerCase().includes(tag.toLowerCase())
            )
          );
          if (hasMatchingTag) {
            images.push(image);
          }
        } else {
          images.push(image);
        }
      });

      return images;
    } catch (error) {
      console.error('Error getting images from library:', error);
      throw new Error('Failed to retrieve images from library');
    }
  },

  /**
   * Get recently used images
   * @param {string} userId - Optional user ID to filter by
   * @param {number} maxResults - Maximum number of results (default: 10)
   * @returns {Promise<Array>} Array of recently used images
   */
  async getRecentImages(userId = null, maxResults = 10) {
    try {
      const querySnapshot = await db.collection(IMAGE_LIBRARY_COLLECTION)
        .where('userId', '==', userId || 'anonymous')
        .orderBy('lastUsedAt', 'desc')
        .limit(maxResults)
        .get();

      const images = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        images.push({
          id: doc.id,
          ...data,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          lastUsedAt: data.lastUsedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      });

      return images;
    } catch (error) {
      console.error('Error getting recent images from library:', error);
      throw new Error('Failed to retrieve recent images from library');
    }
  },

  /**
   * Get most used images
   * @param {string} userId - Optional user ID to filter by
   * @param {number} maxResults - Maximum number of results (default: 10)
   * @returns {Promise<Array>} Array of most used images
   */
  async getPopularImages(userId = null, maxResults = 10) {
    try {
      const querySnapshot = await db.collection(IMAGE_LIBRARY_COLLECTION)
        .where('userId', '==', userId || 'anonymous')
        .orderBy('useCount', 'desc')
        .limit(maxResults)
        .get();

      const images = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        images.push({
          id: doc.id,
          ...data,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          lastUsedAt: data.lastUsedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      });

      return images;
    } catch (error) {
      console.error('Error getting popular images from library:', error);
      throw new Error('Failed to retrieve popular images from library');
    }
  },

  /**
   * Search images by name or tags
   * @param {string} searchTerm - Search term
   * @param {string} userId - Optional user ID to filter by
   * @param {number} maxResults - Maximum number of results (default: 50)
   * @returns {Promise<Array>} Array of matching images
   */
  async searchImages(searchTerm, userId = null, maxResults = 50) {
    try {
      // Note: Firestore doesn't support full-text search natively
      // This is a simple implementation that searches in memory
      
      const querySnapshot = await db.collection(IMAGE_LIBRARY_COLLECTION)
        .where('userId', '==', userId || 'anonymous')
        .limit(maxResults * 2) // Get more to filter
        .get();

      const images = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const image = {
          id: doc.id,
          ...data,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          lastUsedAt: data.lastUsedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };

        // Check if search term matches name, description, or tags
        const searchLower = searchTerm.toLowerCase();
        const matchesName = image.name?.toLowerCase().includes(searchLower);
        const matchesDescription = image.description?.toLowerCase().includes(searchLower);
        const matchesTags = image.tags?.some(tag => tag.toLowerCase().includes(searchLower));

        if (matchesName || matchesDescription || matchesTags) {
          images.push(image);
        }
      });

      // Sort by relevance (use count and recency)
      images.sort((a, b) => {
        const scoreA = (a.useCount || 0) + (a.lastUsedAt.getTime() / 1000000);
        const scoreB = (b.useCount || 0) + (b.lastUsedAt.getTime() / 1000000);
        return scoreB - scoreA;
      });

      return images.slice(0, maxResults);
    } catch (error) {
      console.error('Error searching images in library:', error);
      throw new Error('Failed to search images in library');
    }
  },

  /**
   * Update an image in the library
   * @param {string} id - Image document ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<void>}
   */
  async updateImage(id, updates) {
    try {
      const docRef = db.collection(IMAGE_LIBRARY_COLLECTION).doc(id);
      await docRef.update({
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating image in library:', error);
      throw new Error('Failed to update image in library');
    }
  },

  /**
   * Record usage of an image (increment use count and update last used)
   * @param {string} id - Image document ID
   * @returns {Promise<void>}
   */
  async recordImageUsage(id) {
    try {
      const docRef = db.collection(IMAGE_LIBRARY_COLLECTION).doc(id);
      await docRef.update({
        useCount: increment(1),
        lastUsedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error recording image usage:', error);
      // Don't throw error as this is not critical
    }
  },

  /**
   * Add tags to an image
   * @param {string} id - Image document ID
   * @param {Array<string>} tags - Tags to add
   * @returns {Promise<void>}
   */
  async addTags(id, tags) {
    try {
      const docRef = db.collection(IMAGE_LIBRARY_COLLECTION).doc(id);
      await docRef.update({
        tags: arrayUnion(...tags),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding tags to image:', error);
      throw new Error('Failed to add tags to image');
    }
  },

  /**
   * Remove tags from an image
   * @param {string} id - Image document ID
   * @param {Array<string>} tags - Tags to remove
   * @returns {Promise<void>}
   */
  async removeTags(id, tags) {
    try {
      const docRef = db.collection(IMAGE_LIBRARY_COLLECTION).doc(id);
      await docRef.update({
        tags: arrayRemove(...tags),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error removing tags from image:', error);
      throw new Error('Failed to remove tags from image');
    }
  },

  /**
   * Delete an image from the library
   * @param {string} id - Image document ID
   * @returns {Promise<void>}
   */
  async deleteImage(id) {
    try {
      const docRef = db.collection(IMAGE_LIBRARY_COLLECTION).doc(id);
      await docRef.delete();
    } catch (error) {
      console.error('Error deleting image from library:', error);
      throw new Error('Failed to delete image from library');
    }
  },

  /**
   * Delete multiple images from the library
   * @param {Array<string>} ids - Array of image document IDs
   * @returns {Promise<void>}
   */
  async deleteImages(ids) {
    try {
      const deletePromises = ids.map(id => this.deleteImage(id));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting multiple images from library:', error);
      throw new Error('Failed to delete images from library');
    }
  },

  /**
   * Get all unique tags in the library
   * @param {string} userId - Optional user ID to filter by
   * @returns {Promise<Array<string>>} Array of unique tags
   */
  async getAllTags(userId = null) {
    try {
      const querySnapshot = await db.collection(IMAGE_LIBRARY_COLLECTION)
        .where('userId', '==', userId || 'anonymous')
        .get();

      const tagSet = new Set();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.tags && Array.isArray(data.tags)) {
          data.tags.forEach(tag => tagSet.add(tag));
        }
      });

      return Array.from(tagSet).sort();
    } catch (error) {
      console.error('Error getting tags from library:', error);
      throw new Error('Failed to retrieve tags from library');
    }
  },

  /**
   * Get library statistics
   * @param {string} userId - Optional user ID to filter by
   * @returns {Promise<Object>} Library statistics
   */
  async getLibraryStats(userId = null) {
    try {
      const querySnapshot = await db.collection(IMAGE_LIBRARY_COLLECTION)
        .where('userId', '==', userId || 'anonymous')
        .get();

      let totalImages = 0;
      let totalUsage = 0;
      let totalSize = 0;
      const tagCounts = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        totalImages++;
        totalUsage += data.useCount || 0;
        totalSize += data.fileSize || 0;

        if (data.tags && Array.isArray(data.tags)) {
          data.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      return {
        totalImages,
        totalUsage,
        totalSize,
        averageUsage: totalImages > 0 ? Math.round(totalUsage / totalImages) : 0,
        averageSize: totalImages > 0 ? Math.round(totalSize / totalImages) : 0,
        topTags: Object.entries(tagCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([tag, count]) => ({ tag, count }))
      };
    } catch (error) {
      console.error('Error getting library statistics:', error);
      throw new Error('Failed to retrieve library statistics');
    }
  }
};