
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/genai';
import mime from 'mime';

// Define a custom error class for better error handling in the application
export class GenerationRefusedError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'GenerationRefusedError';
    this.reason = reason;
  }
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

class GeminiImageService {
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.model = 'gemini-2.5-flash-image-preview';
    this.config = {
      // It is crucial to keep TEXT enabled to catch soft refusals
      responseModalities: ['IMAGE', 'TEXT'],
      safetySettings: safetySettings
    };
  }

  /**
   * Helper function to process the stream and detect refusals.
   */
  async _processStream(response) {
    const imageChunks = [];
    let refusalReason = null;
    let feedbackMessage = '';

    for await (const chunk of response) {
      // 1. Check promptFeedback (Input Filtering)
      if (chunk.promptFeedback && chunk.promptFeedback.blockReason) {
          refusalReason = `PROMPT_BLOCKED_${chunk.promptFeedback.blockReason}`;
          feedbackMessage = `The prompt was blocked. Reason: ${chunk.promptFeedback.blockReason}.`;
          // Exit the loop early as no content will be generated
          break;
      }

      const candidate = chunk.candidates?.[0];

      // 2. Check finishReason (Output Filtering)
      if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
          refusalReason = candidate.finishReason;
          // Set a default message if one isn't already present
           if (!feedbackMessage) {
               if (candidate.finishReason === 'SAFETY') {
                    feedbackMessage = 'The generation was stopped due to safety concerns.';
               } else {
                    feedbackMessage = `The generation stopped unexpectedly. Reason: ${candidate.finishReason}.`;
               }
          }
          // We don't break immediately in case there is also text feedback in this chunk
      }

      // 3. Process parts (Collect image data AND text feedback)
      if (candidate && candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            imageChunks.push(buffer);
          } else if (part.text) {
              // Capture any text feedback from the model
              feedbackMessage += part.text + ' ';
          }
        }
      }
    }

    // 4. Determine the final outcome
    
    // Case A: Explicit refusal detected (prompt block or finishReason != STOP)
    if (refusalReason) {
      const finalMessage = feedbackMessage.trim() || 'Image generation refused by the model.';
      throw new GenerationRefusedError(finalMessage, refusalReason);
    }

    // Case B: Implicit refusal (Soft Refusal: Model returned text instead of an image)
    if (imageChunks.length === 0 && feedbackMessage.trim().length > 0) {
        throw new GenerationRefusedError(feedbackMessage.trim(), 'POLICY_SOFT_REFUSAL');
    }

    // Case C: No image generated and no feedback received
    if (imageChunks.length === 0) {
      // This handles cases where generation finished successfully ('STOP')
      // but resulted in no output.
      throw new Error('No image data received from Gemini API, and no specific refusal reason was detected.');
    }

    // Case D: Success
    return Buffer.concat(imageChunks);
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

      // Use the helper function to process the stream
      return await this._processStream(response);

    } catch (error) {
      console.error('Error generating image:', error);
      // Re-throw the error to preserve specific refusal messages and types
      throw error;
    }
  }

  async editImage(imageBuffer, editPrompt) {
    try {
      const mimeType = mime.getType('png') || 'image/png';
      const base64Image = imageBuffer.toString('base64');

      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
            {
              text: editPrompt,
            },
          ],
        },
      ];

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: this.config,
        contents,
      });

       // Use the helper function to process the stream
      return await this._processStream(response);

    } catch (error) {
      console.error('Error editing image:', error);
      // Re-throw the error
      throw error;
    }
  }
}

export const geminiService = new GeminiImageService();