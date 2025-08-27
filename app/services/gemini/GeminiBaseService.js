import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/genai';
import mime from 'mime';

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

export class GeminiBaseService {
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.model = 'gemini-2.5-flash-image-preview';
    this.config = {
      responseModalities: ['IMAGE', 'TEXT'],
      safetySettings: safetySettings,
    };
  }

  /**
   * Helper: detect mime type from buffer magic numbers.
   * Falls back to 'image/png' if unknown.
   */
  _detectMimeFromBuffer(buf) {
    if (!buf || buf.length < 12) return 'image/png';
    const header = buf.subarray(0, 12);

    // PNG
    if (
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47
    ) {
      return 'image/png';
    }
    // JPEG
    if (header[0] === 0xff && header[1] === 0xd8) {
      return 'image/jpeg';
    }
    // GIF
    if (
        header[0] === 0x47 &&
        header[1] === 0x49 &&
        header[2] === 0x46 &&
        header[3] === 0x38
    ) {
      return 'image/gif';
    }
    // WEBP (RIFF....WEBP)
    if (
        header[0] === 0x52 &&
        header[1] === 0x49 &&
        header[2] === 0x46 &&
        header[3] === 0x46 &&
        header[8] === 0x57 &&
        header[9] === 0x45 &&
        header[10] === 0x42 &&
        header[11] === 0x50
    ) {
      return 'image/webp';
    }
    // BMP
    if (header[0] === 0x42 && header[1] === 0x4d) {
      return 'image/bmp';
    }
    // HEIC/HEIF (ftypheic / ftypheif)
    if (
        header[4] === 0x66 &&
        header[5] === 0x74 &&
        header[6] === 0x79 &&
        header[7] === 0x70
    ) {
      return 'image/heic';
    }

    return 'image/png';
  }

  /**
   * Helper: convert a buffer to an inlineData part with proper mime.
   */
  _bufferToInlinePart(buffer) {
    const detected = this._detectMimeFromBuffer(buffer);
    const fallback = mime.getType(detected.split('/')[1]) || detected;
    const mimeType = fallback || 'image/png';
    return {
      inlineData: {
        mimeType,
        data: buffer.toString('base64'),
      },
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
        break; // Exit early
      }

      const candidate = chunk.candidates?.[0];

      // 2. Check finishReason (Output Filtering)
      if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
        refusalReason = candidate.finishReason;
        if (!feedbackMessage) {
          if (candidate.finishReason === 'SAFETY') {
            feedbackMessage = 'The generation was stopped due to safety concerns.';
          } else {
            feedbackMessage = `The generation stopped unexpectedly. Reason: ${candidate.finishReason}.`;
          }
        }
        // continue to capture any text feedback
      }

      // 3. Process parts (Collect image data AND text feedback)
      if (candidate && candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            imageChunks.push(buffer);
          } else if (part.text) {
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
      throw new Error(
          'No image data received from Gemini API, and no specific refusal reason was detected.'
      );
    }

    // Case D: Success
    return Buffer.concat(imageChunks);
  }
}