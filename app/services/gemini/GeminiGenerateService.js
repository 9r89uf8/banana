import { GeminiBaseService } from './GeminiBaseService.js';

export class GeminiGenerateService extends GeminiBaseService {
  constructor() {
    super();
  }

  async generateImage(prompt) {
    try {
      const contents = [
        {
          role: 'user',
          parts: [{ text: prompt }],
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