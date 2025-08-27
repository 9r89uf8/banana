import { GeminiBaseService } from './GeminiBaseService.js';

export class GeminiEditService extends GeminiBaseService {
  constructor() {
    super();
  }

  async editImage(imageBuffer, editPrompt) {
    try {
      const imagePart = this._bufferToInlinePart(imageBuffer);

      const contents = [
        {
          role: 'user',
          parts: [imagePart, { text: editPrompt }],
        },
      ];

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: this.config,
        contents,
      });

      return await this._processStream(response);
    } catch (error) {
      console.error('Error editing image:', error);
      throw error;
    }
  }
}

export const geminiEditService = new GeminiEditService();