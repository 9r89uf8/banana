import { validateImageBuffer } from '@/app/utils/imageUtils';

/**
 * Rate limiting map to track concurrent requests per IP
 */
const rateLimitMap = new Map();
const MAX_CONCURRENT_REQUESTS = 3;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

/**
 * Middleware for validating uploaded images and applying rate limiting
 */
export class ImageValidationMiddleware {
  /**
   * Check rate limit for an IP address
   */
  static checkRateLimit(clientIP) {
    const now = Date.now();
    const clientData = rateLimitMap.get(clientIP) || { count: 0, lastRequest: now };
    
    // Clean old entries
    if (now - clientData.lastRequest > RATE_LIMIT_WINDOW) {
      clientData.count = 0;
    }
    
    if (clientData.count >= MAX_CONCURRENT_REQUESTS) {
      throw new Error(`Rate limit exceeded. Maximum ${MAX_CONCURRENT_REQUESTS} requests per minute.`);
    }
    
    // Increment counter
    clientData.count++;
    clientData.lastRequest = now;
    rateLimitMap.set(clientIP, clientData);
    
    // Set cleanup timeout
    setTimeout(() => {
      const current = rateLimitMap.get(clientIP);
      if (current && current.count > 0) {
        current.count--;
        if (current.count <= 0) {
          rateLimitMap.delete(clientIP);
        }
      }
    }, RATE_LIMIT_WINDOW);
  }
  
  /**
   * Validate image files from FormData
   */
  static async validateImages(formData, requiredFiles = []) {
    const validatedImages = {};
    
    for (const fieldName of requiredFiles) {
      const file = formData.get(fieldName);
      if (!file) {
        throw new Error(`Missing required image: ${fieldName}`);
      }
      
      // Convert file to buffer for validation
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type;
      
      // Validate the image
      validateImageBuffer(buffer, mimeType);
      
      // Store validated data
      validatedImages[fieldName] = {
        buffer,
        mimeType,
        size: buffer.length,
        originalName: file.name
      };
    }
    
    return validatedImages;
  }
  
  /**
   * Extract and validate form parameters
   */
  static validateFormParams(formData, requiredParams = {}, optionalParams = {}) {
    const params = {};
    
    // Validate required parameters
    for (const [key, validator] of Object.entries(requiredParams)) {
      const value = formData.get(key);
      if (value === null || value === undefined) {
        throw new Error(`Missing required parameter: ${key}`);
      }
      
      try {
        params[key] = validator(value);
      } catch (error) {
        throw new Error(`Invalid ${key}: ${error.message}`);
      }
    }
    
    // Validate optional parameters
    for (const [key, validator] of Object.entries(optionalParams)) {
      const value = formData.get(key);
      if (value !== null && value !== undefined && value !== '') {
        try {
          params[key] = validator(value);
        } catch (error) {
          throw new Error(`Invalid ${key}: ${error.message}`);
        }
      }
    }
    
    return params;
  }
  
  /**
   * Clean up rate limiting data periodically
   */
  static startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of rateLimitMap.entries()) {
        if (now - data.lastRequest > RATE_LIMIT_WINDOW * 2) {
          rateLimitMap.delete(ip);
        }
      }
    }, RATE_LIMIT_WINDOW);
  }
}

// Parameter validators
export const validators = {
  number: (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) throw new Error('must be a valid number');
    return num;
  },
  
  positiveNumber: (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) throw new Error('must be a positive number');
    return num;
  },
  
  percentage: (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) {
      throw new Error('must be a percentage between 0 and 100');
    }
    return num;
  },
  
  string: (value) => {
    if (typeof value !== 'string') throw new Error('must be a string');
    return value.trim();
  },
  
  nonEmptyString: (value) => {
    const str = validators.string(value);
    if (str.length === 0) throw new Error('cannot be empty');
    return str;
  },
  
  enum: (allowedValues) => (value) => {
    const str = validators.string(value);
    if (!allowedValues.includes(str)) {
      throw new Error(`must be one of: ${allowedValues.join(', ')}`);
    }
    return str;
  }
};

// Start cleanup timer
ImageValidationMiddleware.startCleanupTimer();