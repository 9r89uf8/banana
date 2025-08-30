'use client';

import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  where,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/app/utils/firebaseClient';

const GENERATIONS_COLLECTION = 'imageGenerations';

export const generationsService = {
  /**
   * Save a new generation to Firestore
   * @param {Object} generation - Generation data
   * @param {string} userId - Optional user ID for user-specific generations
   * @returns {Promise<string>} Document ID
   */
  async saveGeneration(generation, userId = null) {
    try {
      const generationData = {
        ...generation,
        userId: userId || 'anonymous',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, GENERATIONS_COLLECTION), generationData);
      return docRef.id;
    } catch (error) {
      console.error('Error saving generation to Firestore:', error);
      throw new Error('Failed to save generation to database');
    }
  },

  /**
   * Get all generations from Firestore
   * @param {string} userId - Optional user ID to filter by
   * @param {number} maxResults - Maximum number of results (default: 50)
   * @returns {Promise<Array>} Array of generations
   */
  async getGenerations(userId = null, maxResults = 50) {
    try {
      let q;
      
      if (userId) {
        q = query(
          collection(db, GENERATIONS_COLLECTION),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(maxResults)
        );
      } else {
        // Get anonymous generations for current session
        q = query(
          collection(db, GENERATIONS_COLLECTION),
          where('userId', '==', 'anonymous'),
          orderBy('timestamp', 'desc'),
          limit(maxResults)
        );
      }

      const querySnapshot = await getDocs(q);
      const generations = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        generations.push({
          id: doc.id,
          ...data,
          // Convert Firestore Timestamp to Date
          timestamp: data.timestamp?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      });

      return generations;
    } catch (error) {
      console.error('Error getting generations from Firestore:', error);
      throw new Error('Failed to retrieve generations from database');
    }
  },

  /**
   * Update a generation in Firestore
   * @param {string} id - Generation document ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<void>}
   */
  async updateGeneration(id, updates) {
    try {
      const docRef = doc(db, GENERATIONS_COLLECTION, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating generation in Firestore:', error);
      throw new Error('Failed to update generation in database');
    }
  },

  /**
   * Delete a generation from Firestore
   * @param {string} id - Generation document ID
   * @returns {Promise<void>}
   */
  async deleteGeneration(id) {
    try {
      const docRef = doc(db, GENERATIONS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting generation from Firestore:', error);
      throw new Error('Failed to delete generation from database');
    }
  },

  /**
   * Delete multiple generations from Firestore
   * @param {Array<string>} ids - Array of generation document IDs
   * @returns {Promise<void>}
   */
  async deleteGenerations(ids) {
    try {
      const deletePromises = ids.map(id => this.deleteGeneration(id));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting multiple generations from Firestore:', error);
      throw new Error('Failed to delete generations from database');
    }
  },

  /**
   * Get generations by status
   * @param {string} status - Generation status ('pending', 'processing', 'completed', 'failed')
   * @param {string} userId - Optional user ID
   * @returns {Promise<Array>} Array of generations
   */
  async getGenerationsByStatus(status, userId = null) {
    try {
      let q;
      
      if (userId) {
        q = query(
          collection(db, GENERATIONS_COLLECTION),
          where('userId', '==', userId),
          where('status', '==', status),
          orderBy('timestamp', 'desc')
        );
      } else {
        q = query(
          collection(db, GENERATIONS_COLLECTION),
          where('userId', '==', 'anonymous'),
          where('status', '==', status),
          orderBy('timestamp', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      const generations = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        generations.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      });

      return generations;
    } catch (error) {
      console.error('Error getting generations by status from Firestore:', error);
      throw new Error('Failed to retrieve generations by status from database');
    }
  }
};