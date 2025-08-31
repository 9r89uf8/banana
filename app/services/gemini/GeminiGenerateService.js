import { GeminiBaseService } from './GeminiBaseService.js';

export class GeminiGenerateService extends GeminiBaseService {
  constructor() {
    super();
  }

  async generateImage(image1Buffer, image2Buffer, prompt) {
    try {
      // Build parts array dynamically based on available images
      const parts = [];
      
      if (image1Buffer) {
        parts.push(this._bufferToInlinePart(image1Buffer));
      }
      
      if (image2Buffer) {
        parts.push(this._bufferToInlinePart(image2Buffer));
      }
      
      // Always add the text prompt
      parts.push({ text: prompt });

      const contents = [
        {
          role: 'user',
          parts: parts,
        },
      ];

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: this.config,
        contents,
      });

      return await this._processStream(response);
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }
}

export const geminiGenerateService = new GeminiGenerateService();