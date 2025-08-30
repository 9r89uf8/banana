import { GeminiBaseService } from './GeminiBaseService.js';

export class GeminiPersonComposeService extends GeminiBaseService {
  constructor() {
    super();
  }

  async composePeople(mainImageBuffer, personImageBuffer, prompt) {
    try {
      const mainPart = this._bufferToInlinePart(mainImageBuffer);
      const personPart = this._bufferToInlinePart(personImageBuffer);

      const compositionPrompt = `
Create a realistic composite with two people based on the user's instructions.

Inputs:
- Main image with a person (first attachment)
- Second person image to add (second attachment)
- User instructions: "${prompt}"

CRITICAL REQUIREMENTS:

1) PERSON EXTRACTION: Isolate ONLY the person from the second image. Remove ALL background completely. Extract with precise masking around hair, clothing edges, and body contours. Use soft edge feathering (1-2px) to avoid halos.

2) NATURAL POSITIONING: Follow the user's instructions for positioning. The second person should appear naturally present in the scene, not pasted on top.

3) SCALE & PERSPECTIVE: Match the perspective of the main image. The second person should have appropriate relative size based on their position and depth.

4) BODY ORIENTATION & POSE: Interpret the user's instructions for pose and interaction naturally. Ensure natural body language.

5) LIGHTING CONSISTENCY: Match the lighting direction, intensity, color temperature, and shadows of the main image. Add appropriate shadows:
   - Ground contact shadows where feet meet ground
   - Inter-person shadows if one person blocks light from the other
   - Ambient occlusion in close proximity areas

6) NATURAL INTEGRATION:
   - Ensure both people appear to be in the same physical space
   - Ground plane must be consistent (both standing on same surface)
   - Maintain natural interpersonal distance based on the described interaction
   - No floating or unnatural positioning

7) FOLLOW USER INSTRUCTIONS: Carefully interpret and follow the specific positioning, pose, and interaction described by the user.

DO NOT:
- Alter the main person's appearance, pose, or position
- Change the background or environment
- Add new elements besides the second person
- Create unrealistic body proportions or poses
- Generate multiple images or text captions

OUTPUT:
- Return ONLY the final composite image with both people naturally integrated according to the user's instructions.
`.trim();

      const contents = [
        {
          role: 'user',
          parts: [mainPart, personPart, { text: compositionPrompt }],
        },
      ];

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: this.config,
        contents,
      });

      return await this._processStream(response);
    } catch (error) {
      console.error('Error composing people:', error);
      throw error;
    }
  }
}

export const geminiPersonComposeService = new GeminiPersonComposeService();