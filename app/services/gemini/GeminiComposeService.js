import { GeminiBaseService } from './GeminiBaseService.js';

export class GeminiComposeService extends GeminiBaseService {
  constructor() {
    super();
    this.SNAP_RADIUS_PCT = 4.0; // snap tolerance around click
    this.JSON_RETRY_HINT = 'Return ONE LINE of compact JSON only. No prose, no code fences.';
  }

  /**
   * Helper: clamp a percentage to [0, 100]
   */
  _clampPct(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  /**
   * Helper: robust JSON extraction from a text blob.
   */
  _extractJson(text) {
    if (!text) return null;
    
    // Clean the text by removing common prefixes/suffixes
    const cleanText = text.trim().replace(/^```json\s*|\s*```$/gi, '');
    
    // Try direct parse first
    try {
      return JSON.parse(cleanText);
    } catch (_) {
      // Try to find JSON block patterns
      const jsonPatterns = [
        /\{[^{}]*\{[^{}]*\}[^{}]*\}/,  // nested object pattern
        /\{[^{}]*\}/,                    // simple object pattern
      ];
      
      for (const pattern of jsonPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
          try {
            return JSON.parse(match[0]);
          } catch (_) {
            continue;
          }
        }
      }
      
      // Last resort: try to extract between first { and last }
      const start = cleanText.indexOf('{');
      const end = cleanText.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const slice = cleanText.slice(start, end + 1);
        try {
          return JSON.parse(slice);
        } catch (_) {
          return null;
        }
      }
      
      return null;
    }
  }


  async composeImages(
      mainImageBuffer,
      objectImageBuffer,
      positionX,
      positionY,
      sceneDescription = '',
      objectDescription = '',
      interactionIntent = 'auto',
      interactionCustom = ''
  ) {
    try {
      // Clamp and normalize percentage inputs
      const xPct = this._clampPct(positionX);
      const yPct = this._clampPct(positionY);

      // Stage 1: Generate structured semantic location JSON
      const semanticLocation = await this._generateSemanticLocation(
          mainImageBuffer,
          objectImageBuffer,
          xPct,
          yPct,
          sceneDescription,
          interactionIntent,
          interactionCustom
      );

      // Stage 2: Generate composite image with the object placed at the semantic location
      const compositeResult = await this._generateCompositeImage(
          mainImageBuffer,
          objectImageBuffer,
          semanticLocation, // structured JSON object
          xPct,
          yPct,
          sceneDescription,
          objectDescription,
          interactionIntent,
          interactionCustom
      );

      return compositeResult;
    } catch (error) {
      console.error('Error composing images:', error);
      throw error;
    }
  }

  async _generateSemanticLocation(
      mainImageBuffer,
      objectImageBuffer,
      positionX,
      positionY,
      sceneDescription,
      interactionIntent,
      interactionCustom
  ) {
    try {
      const mainPart = this._bufferToInlinePart(mainImageBuffer);
      const objectPart = this._bufferToInlinePart(objectImageBuffer);

      const locationPrompt = `
You are selecting a precise, physically plausible anchor for placing an inserted object.

Inputs:
- main image (attached first)
- object image (attached second)
- user click location (percent coords): ${positionX.toFixed(1)} from left, ${positionY.toFixed(1)} from top
- optional scene context: "${sceneDescription || ''}"
- interaction intent: "${interactionIntent}"${interactionCustom ? ` (custom: "${interactionCustom}")` : ''}

Task:
1) Interpret the click and "SNAP" to the nearest sensible anchor within a ${this.SNAP_RADIUS_PCT}% radius if needed (e.g., "center of subject's LEFT palm", "top of mug rim", "tabletop surface", "ground in front of building"). If no suitable support is within the radius, keep the click as "air".
2) Infer depth and support plane (hand/table/floor/air).
3) Suggest a scale hint appropriate for the anchor (e.g., "fit within palm width", "cover ~1/3 of mug height").
4) Decide whether true OCCLUSION is REQUIRED for the interaction:
   - If interaction is hold_grasp/wear/hang/lean, occlusion is usually required by body parts or scene elements.
   - Name the likely occluding parts (e.g., "thumb,index,middle", "upper lip of glass", "hat brim", "table edge").
5) Provide a simple orientation hint in degrees relative to camera (0 = upright bottle). Use subject-relative LEFT/RIGHT when relevant.

Ambiguities:
- Use SUBJECT left/right (not viewer). If unknown, use "unknown".
- If click is in empty air, keep "anchor_kind":"air" and provide a minimal plausible description.

Output: ONE LINE of compact JSON ONLY. No prose, no code fences.

Schema:
{
  "location_phrase": "<short phrase>",
  "coords_pct": {"x": <float>, "y": <float>},
  "anchor_kind": "hand|surface|air|other",
  "subject_left_or_right": "left|right|unknown",
  "plane": "horizontal|vertical|angled|unknown",
  "depth_note": "<in front of / behind / at same depth as …>",
  "scale_hint": "<rule of thumb>",
  "orientation_hint_deg": <number>,
  "interaction_intent": "<auto|hold_grasp|place_on_surface|wear|hang|lean|float|custom>",
  "occlusion_required": <true|false>,
  "occluding_parts": "<comma-separated tokens or 'none'>"
}
${this.JSON_RETRY_HINT}
`.trim();

      const contents = [
        {
          role: 'user',
          parts: [mainPart, objectPart, { text: locationPrompt }],
        },
      ];

      // Stage 1: TEXT-ONLY for deterministic JSON (model doesn't support JSON mode)
      const locationConfig = {
        responseModalities: ['TEXT'],
        safetySettings: this.config.safetySettings,
      };

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: locationConfig,
        contents,
      });

      let textOut = '';
      for await (const chunk of response) {
        const candidate = chunk.candidates?.[0];
        if (candidate && candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) textOut += part.text;
          }
        }
      }

      // Try parsing JSON with improved extraction
      let json = this._extractJson(textOut);

      // If parsing failed, try once more with a repair prompt
      if (!json) {
        const repairPrompt = `
You previously returned an invalid response. ${this.JSON_RETRY_HINT}

Return JSON in ONE LINE for this schema. Fill missing fields conservatively.
{"location_phrase":"","coords_pct":{"x":${positionX.toFixed(1)},"y":${positionY.toFixed(1)}},"anchor_kind":"","subject_left_or_right":"","plane":"","depth_note":"","scale_hint":"","orientation_hint_deg":0,"interaction_intent":"${interactionIntent}","occlusion_required":false,"occluding_parts":"none"}
`.trim();

        const repairResponse = await this.ai.models.generateContentStream({
          model: this.model,
          config: locationConfig,
          contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
        });

        textOut = '';
        for await (const chunk of repairResponse) {
          const candidate = chunk.candidates?.[0];
          if (candidate && candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.text) textOut += part.text;
            }
          }
        }
        json = this._extractJson(textOut);
      }

      if (!json) {
        throw new Error(
            'Failed to parse semantic location JSON from model output.'
        );
      }

      // Ensure coords are present and clamped
      if (!json.coords_pct) {
        json.coords_pct = { x: positionX, y: positionY };
      } else {
        json.coords_pct.x = this._clampPct(json.coords_pct.x);
        json.coords_pct.y = this._clampPct(json.coords_pct.y);
      }

      // Backfill intent fields
      if (!json.interaction_intent) json.interaction_intent = interactionIntent || 'auto';
      if (json.interaction_intent === 'custom' && !json.location_phrase && interactionCustom) {
        json.location_phrase = interactionCustom;
      }

      return json;
    } catch (error) {
      console.error('Error generating semantic location:', error);
      throw error;
    }
  }

  async _generateCompositeImage(
      mainImageBuffer,
      objectImageBuffer,
      semanticLocation, // JSON object
      positionX,
      positionY,
      sceneDescription,
      objectDescription,
      interactionIntent,
      interactionCustom
  ) {
    try {
      const mainPart = this._bufferToInlinePart(mainImageBuffer);
      const objectPart = this._bufferToInlinePart(objectImageBuffer);

      const semanticJSON = JSON.stringify(semanticLocation);
      // Debug logging removed for security

      const compositionPrompt = `
Create a realistic composite using:
- main image (first attachment)
- object image (second attachment)
- placement spec (JSON): ${semanticJSON}
- click coords (percent): ${positionX.toFixed(1)} from left, ${positionY.toFixed(1)} from top
- snap radius: ${this.SNAP_RADIUS_PCT}%
- scene context: "${sceneDescription || ''}"
- object context: "${objectDescription || ''}"
- interaction intent: "${interactionIntent}"${interactionCustom ? ` (custom: "${interactionCustom}")` : ''}

REQUIREMENTS (non-negotiable):
1) BACKGROUND REMOVAL: Isolate ONLY the object from the object image. Remove any solid/colored/white background and IGNORE any surrounding lettering/graphics not part of the object. Produce clean alpha; feather softly (~1–2% of local object size) to avoid halos.
2) PRECISE PLACEMENT: Align the object's effective anchor to the snapped anchor described in the JSON. If JSON snap differs from raw coords, prefer the JSON anchor. Respect percent coords relative to the main image.
3) SCALE: Use "scale_hint" to size the object realistically (e.g., "fit within palm width"). Minor adjustments allowed to avoid clipping.
4) ORIENTATION & PERSPECTIVE: Rotate/warp subtly to match the support plane ("horizontal/vertical/angled") and camera perspective. Use "orientation_hint_deg" as a bias, not an absolute.
5) LIGHTING & COLOR: Match exposure/contrast/white balance to the main image. Do not stylize the entire image.
6) SHADOWS & CONTACT: When resting in a hand or on a surface, add soft contact shadows consistent with the scene's lighting. Avoid sticker-like edges.

OCCLUSION & INTERACTION (MANDATORY when applicable):
- If "occlusion_required": true OR interaction intent is "hold_grasp" / "wear" / "hang" / "lean":
   a) Identify near-field occluders from "occluding_parts" (e.g., "thumb,index,middle", "table edge", "hat brim") around the anchor.
   b) MASK the object so these parts naturally overlap it (e.g., fingers in front of bottle). Maintain realistic edge softness (no cutout halos).
   c) For a hand GRASP: position the object so the THUMB crosses the object on the near side and INDEX/MIDDLE wrap the far side. Slightly adjust object orientation to fit the palm plane. Add micro-shadows cast by fingers onto the object.
   d) Preserve hand anatomy; do not redraw or invent new fingers. Only local occlusion/masking and tonal adjustment are allowed.
- If "occlusion_required": false or anchor_kind is "air": keep object fully visible; add faint projected shadow only if plausible.

DO NOT:
- Crop or move main-scene elements, add new props, redraw faces, or globally restyle.
- Output multiple images or any text captions.

OUTPUT:
- Return ONLY the final composite image.
`.trim();

      const contents = [
        {
          role: 'user',
          parts: [mainPart, objectPart, { text: compositionPrompt }],
        },
      ];

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: this.config,
        contents,
      });

      return await this._processStream(response);
    } catch (error) {
      console.error('Error generating composite image:', error);
      throw error;
    }
  }
}

export const geminiComposeService = new GeminiComposeService();