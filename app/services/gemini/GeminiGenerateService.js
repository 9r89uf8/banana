import { GeminiBaseService } from './GeminiBaseService.js';

export class GeminiGenerateService extends GeminiBaseService {
  constructor() {
    super();
  }

  async generateImage(image1Buffer, image2Buffer, prompt) {
    try {
      const image1Part = this._bufferToInlinePart(image1Buffer);
      const image2Part = this._bufferToInlinePart(image2Buffer);

      const contents = [
        {
          role: 'user',
          parts: [image1Part, image2Part, { text: prompt }],
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