
import { GoogleGenAI, Modality, Type, Schema } from "@google/genai";
import type { ImageAnalysisResult } from '../types';
import type { RelightSettings } from '../components/pro-ai-relight/types';
import type { UploadedPortrait, FamilyMember } from '../components/concept-photo/types';

// Guideline: MUST NOT use top-level initialization if using models requiring dynamic API keys (like gemini-3-pro-image-preview)
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// SPECIALIZED QUALITY SUFFIXES
const GENERAL_QUALITY_SUFFIX = " . Best quality, masterpiece, 8k resolution, ultra-detailed, photorealistic, sharp focus, professional lighting, ray tracing, unreal engine 5 render, cinematic realistic style, no blur, no pixelation, perfect composition.";

const PORTRAIT_QUALITY_SUFFIX = " . High-end studio portrait photography, 4k resolution, ultra-realistic skin texture, pore-level detail, professional studio lighting, sharp focus on eyes, natural skin tones, Hasselblad medium format quality, no artifacts.";

const RESTORATION_QUALITY_SUFFIX = " . Restore to absolute high definition 4k, remove all noise, blur, and scratches while preserving authentic skin texture. Do not over-smooth (no waxy skin). Enhance details, correct colors naturally, sharp focus, ultra-detailed.";

async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseImageModelResponse(response: any): { image: string | null; text: string | null } {
  let image: string | null = null;
  let text: string | null = null;

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        image = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
      if (part.text) {
        text = part.text;
      }
    }
  }
  
  if (!image && response.generatedImages?.[0]?.image?.imageBytes) {
     image = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
  }

  return { image, text };
}

export async function analyzeImage(file: File): Promise<ImageAnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(file);
  const prompt = "Analyze this portrait for an ID photo. Determine gender (Nam/Nữ), estimated age, and check for issues: lighting, face visibility, background, glasses, etc. Return JSON.";
  
  const config = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          gender: { type: Type.STRING, enum: ['Nam', 'Nữ'] },
          age: { type: Type.STRING },
          feedback: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                isGood: { type: Type.BOOLEAN },
                message: { type: Type.STRING }
              }
            }
          }
        }
      }
    };

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [imagePart, { text: prompt }],
        },
        config: config
      });

      if (response.text) {
        return JSON.parse(response.text) as ImageAnalysisResult;
      }
  } catch (e) {
      console.warn("Gemini 3 Pro analysis failed, falling back to Flash.", e);
      try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
              parts: [imagePart, { text: prompt }],
            },
            config: config
          });
          if (response.text) {
            return JSON.parse(response.text) as ImageAnalysisResult;
          }
      } catch (fallbackError) {
          console.error("Fallback analysis failed", fallbackError);
      }
  }

  return { feedback: [], gender: undefined, age: undefined };
}

export async function generateIdPhoto(
  file: File,
  background: string,
  outfit: { name: string; file: File | null },
  gender: string,
  hairstyle: string,
  aspectRatio: string,
  retouch: string,
  lighting: string,
  expression: string,
  allowAiCreativity: boolean,
  strictPreservation: boolean,
  customPrompt: string
): Promise<{ image: string | null; text: string | null }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(file);
  const parts: any[] = [imagePart];

  if (outfit.file) {
    const outfitPart = await fileToGenerativePart(outfit.file);
    parts.push(outfitPart);
  }

  let systemInstruction = `You are an expert ID photo generator. 
  Task: Transform the input person into a professional ID photo.
  - Keep the face recognizable.
  - Background: ${background}.
  - Outfit: ${outfit.name} ${outfit.file ? '(use the second image as reference)' : ''}.
  - Gender: ${gender}.
  - Hairstyle: ${hairstyle}.
  - Aspect Ratio: ${aspectRatio} (crop/fill accordingly).
  - Retouch: ${retouch}.
  - Lighting: ${lighting}.
  - Expression: ${expression}.
  `;

  if (strictPreservation) {
    systemInstruction += " CRITICAL: PRESERVE FACIAL FEATURES 100%. Do not alter the face structure, eyes, nose, or mouth. Only change background and clothes.";
  } else if (allowAiCreativity) {
    systemInstruction += " You may slightly enhance facial features for beauty while maintaining likeness.";
  }

  if (customPrompt) {
    systemInstruction += ` Additional User Request: ${customPrompt}`;
  }

  // Inject Specialized Portrait Quality Suffix
  systemInstruction += PORTRAIT_QUALITY_SUFFIX;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [...parts, { text: systemInstruction }],
    },
    config: {
      responseModalalities: [Modality.IMAGE],
    },
  });

  return parseImageModelResponse(response);
}

export async function analyzeImageForRestoration(file: File): Promise<{ needsUpscaling: boolean; reason: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(file);
  const prompt = "Analyze this image quality carefully. Look for blur, noise, low resolution, compression artifacts, or scratches. Does it need upscaling or restoration? Return JSON.";
  const config = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          needsUpscaling: { type: Type.BOOLEAN },
          reason: { type: Type.STRING }
        }
      }
    };

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [imagePart, { text: prompt }],
        },
        config: config
      });
      
      if (response.text) {
          return JSON.parse(response.text);
      }
  } catch (e) {
      console.warn("Gemini 3 Pro restoration analysis failed, falling back to Flash.", e);
      try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
              parts: [imagePart, { text: prompt }],
            },
            config: config
          });
          if (response.text) {
              return JSON.parse(response.text);
          }
      } catch (fallbackError) {
          console.error("Fallback restoration analysis failed", fallbackError);
      }
  }
  return { needsUpscaling: false, reason: "Could not analyze." };
}

export async function upscaleImage(file: File, type: 'portrait' | 'general' | 'sketch' = 'portrait'): Promise<{ image: string | null; text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = await fileToGenerativePart(file);
    let prompt = "Upscale this image to 4K Ultra HD resolution. Significantly improve sharpness, refine details, and remove artifacts/noise. ";

    let aspectRatioConfig = "1:1"; 
    
    if (type === 'portrait') {
        prompt += "Enhance skin texture naturally, maintain pore-level detail, clear eyes. Do not over-smooth/wax the skin. Keep facial identity 100%. " + PORTRAIT_QUALITY_SUFFIX;
        aspectRatioConfig = "3:4";
    } else if (type === 'sketch') {
        prompt += "Sharpen lines, maintain the sketch style, remove paper texture if unwanted, high contrast line art. " + GENERAL_QUALITY_SUFFIX;
        aspectRatioConfig = "1:1";
    } else {
        prompt += "Enhance materials, textures, lighting, and overall clarity. " + GENERAL_QUALITY_SUFFIX;
        aspectRatioConfig = "16:9";
    }

    try {
        // Real 4K Model usage requires user-selected key check in the component
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [imagePart, { text: prompt }]
            },
            config: {
                imageConfig: {
                    imageSize: '4K',
                    aspectRatio: aspectRatioConfig
                }
            }
        });
        return parseImageModelResponse(response);
    } catch (e) {
        console.warn("Gemini 3 Pro Image Preview (4K) failed, falling back to Standard Upscale.", e);
        
        const fallbackPrompt = prompt.replace("4K Ultra HD resolution", "high resolution");

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [imagePart, { text: fallbackPrompt }]
            },
            config: {
                responseModalalities: [Modality.IMAGE]
            }
        });
        return parseImageModelResponse(response);
    }
}

export async function restorePhoto(
  file: File,
  options: { faceEnhance: boolean; denoise: boolean; sharpen: boolean; colorize: boolean },
  customPrompt: string,
  maskDataUrl: string | null
): Promise<{ image: string | null; text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = await fileToGenerativePart(file);
    const parts: any[] = [imagePart];

    let prompt = "Restore this photo. ";
    if (options.faceEnhance) prompt += "Enhance facial details. ";
    if (options.denoise) prompt += "Remove noise and grain. ";
    if (options.sharpen) prompt += "Sharpen the image. ";
    if (options.colorize) prompt += "Colorize the black and white image naturally. ";
    if (customPrompt) prompt += `Additional: ${customPrompt}`;

    if (maskDataUrl) {
        const maskPart = await fileToGenerativePart(await (await fetch(maskDataUrl)).blob() as File);
        parts.push(maskPart);
        prompt += " Edit ONLY the area highlighted in white in the second image (the mask). Restore/Fix that area matching the surrounding context.";
    }

    prompt += RESTORATION_QUALITY_SUFFIX;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [...parts, { text: prompt }]
        },
        config: {
            responseModalalities: [Modality.IMAGE]
        }
    });
    return parseImageModelResponse(response);
}

export async function cleanOrRestoreObject(
    file: File,
    cleaningTypes: string[],
    customPrompt: string,
    maskDataUrl: string | null
): Promise<{ image: string | null; text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = await fileToGenerativePart(file);
    const parts: any[] = [imagePart];
    
    let prompt = `Clean/Restore object. Apply: ${cleaningTypes.join(', ')}. ${customPrompt}`;

    if (maskDataUrl) {
        const maskPart = await fileToGenerativePart(await (await fetch(maskDataUrl)).blob() as File);
        parts.push(maskPart);
        prompt += " Apply changes ONLY to the masked area (white area in second image).";
    }

    prompt += GENERAL_QUALITY_SUFFIX;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [...parts, { text: prompt }]
        },
        config: {
            responseModalalities: [Modality.IMAGE]
        }
    });

    return parseImageModelResponse(response);
}

export async function relightImage(file: File, settings: RelightSettings): Promise<{ image: string | null; text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = await fileToGenerativePart(file);
    const prompt = `Relight this image professionally. 
    Settings:
    - Backlight Direction: ${settings.backlightDirection}
    - Light Type: ${settings.lightType}
    - Colors: ${settings.lightColor1} ${settings.lightColor2 ? ', ' + settings.lightColor2 : ''} ${settings.lightColor3 ? ', ' + settings.lightColor3 : ''}
    - Quality: ${settings.quality}
    - Custom: ${settings.customPrompt}
    Keep the subject the same, only change lighting atmosphere.
    ${GENERAL_QUALITY_SUFFIX}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [imagePart, { text: prompt }]
        },
        config: {
            responseModalalities: [Modality.IMAGE]
        }
    });

    return parseImageModelResponse(response);
}

export async function generateImageFromPrompt(prompt: string, aspectRatio: string): Promise<{ images: string[], text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const enhancedPrompt = prompt + GENERAL_QUALITY_SUFFIX;

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: enhancedPrompt,
            config: {
                numberOfImages: 4,
                aspectRatio: aspectRatio as any || '16:9',
                outputMimeType: 'image/jpeg'
            }
        });
        
        const images = response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
        return { images, text: null };
    } catch (e: any) {
        return { images: [], text: e.message || "Failed to generate images" };
    }
}

export async function generateConceptPhoto(
    portraits: (UploadedPortrait | FamilyMember)[],
    posePrompt: string,
    isFamily: boolean,
    simpleFamilyMode: boolean
): Promise<{ image: string | null; text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];
    
    for (const p of portraits) {
        const part = await fileToGenerativePart(p.file);
        parts.push(part);
    }
    
    const instructions = `Generate a photorealistic concept photo.
    Prompt: "${posePrompt}".
    Use the provided reference portraits to maintain facial likeness.
    ${isFamily ? 'This is a family photo. Ensure all members are present and consistent.' : 'Single subject.'}
    ${simpleFamilyMode ? 'Simple family snapshot style.' : 'High quality artistic concept.'}
    ${GENERAL_QUALITY_SUFFIX}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [...parts, { text: instructions }]
        },
        config: {
            responseModalalities: [Modality.IMAGE]
        }
    });

    return parseImageModelResponse(response);
}

export async function analyzeStyleFromImage(file: File): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = await fileToGenerativePart(file);
    const prompt = "Describe the artistic style, lighting, mood, materials, colors, and context of this image in extreme detail for a high-quality generative prompt. Focus on cinematic details.";
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [imagePart, { text: prompt }]
            }
        });
        return response.text || null;
    } catch (e) {
        console.warn("Gemini 3 Pro style analysis failed, falling back to Flash.", e);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [imagePart, { text: prompt }]
                }
            });
            return response.text || null;
        } catch (fallbackError) {
            console.error("Fallback style analysis failed", fallbackError);
            return null;
        }
    }
}

export async function generateTattooSketch(file: File): Promise<{ image: string | null; text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = await fileToGenerativePart(file);
    const sketchSuffix = " . Best quality, high resolution, sharp lines, clean ink, 8k resolution, vector style.";
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [imagePart, { text: "Convert this tattoo image into a clean line art sketch or stencil. Black lines on white background." + sketchSuffix }]
        },
        config: {
            responseModalalities: [Modality.IMAGE]
        }
    });
    return parseImageModelResponse(response);
}

export async function refineTattooSketch(imageUrl: string): Promise<{ image: string | null; text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const blob = await (await fetch(imageUrl)).blob();
    const imagePart = await fileToGenerativePart(blob as File);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [imagePart, { text: "Refine this sketch. Make lines sharper, smoother, and higher definition. Best quality, 8k resolution." }]
        },
        config: {
            responseModalalities: [Modality.IMAGE]
        }
    });
    return parseImageModelResponse(response);
}

export async function generateCaricature(
  imageFile: File,
  style: string,
  customPrompt: string
): Promise<{ images: string[] | null; text: string | null }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(imageFile);
  
  const prompt = `You are a world-class professional caricature artist. Your task is to transform the person OR PEOPLE in the provided image into a humorous and artistic caricature based on the requested style: "${style}".

**CORE OBJECTIVES:**
1.  **Group Preservation (CRITICAL):** If the image contains multiple people, include ALL of them.
2.  **Exaggeration:** Exaggerate distinct features playfully.
3.  **Likeness:** Maintain recognizability.
4.  **Artistic Style:** ${style}.
5.  **Quality:** High resolution, clean.

**Additional Instructions:**
${customPrompt ? customPrompt : "None"}

**Mandatory Quality Settings:**
${GENERAL_QUALITY_SUFFIX}

**Output:** A single high-quality caricature image.`;

  const requests = Array(4).fill(null).map(() => {
    const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return aiInstance.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            imagePart,
            { text: prompt },
          ],
        },
        config: {
            responseModalalities: [Modality.IMAGE],
        },
      });
  });

  try {
      const responses = await Promise.all(requests);
      const images: string[] = [];
      let lastText: string | null = null;

      for (const response of responses) {
          const parsed = parseImageModelResponse(response);
          if (parsed.image) {
              images.push(parsed.image);
          }
          if (parsed.text) {
              lastText = parsed.text;
          }
      }

      if (images.length === 0) {
          return { images: null, text: lastText || "Failed to generate images." };
      }

      return { images, text: lastText };
  } catch (error) {
      console.error("Error generating multiple caricatures:", error);
      return { images: null, text: error instanceof Error ? error.message : "Unknown error occurred." };
  }
}

export async function generateChibiPoseCollage(
  files: File[],
  styleInfo: { theme: string; description: string; layout: string; themeId: string }
): Promise<{ image: string | null; text: string | null }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];
    
    for (const file of files) {
        const part = await fileToGenerativePart(file);
        parts.push(part);
    }
    
    let instructions = `You are a world-class wedding storyboard illustrator.
    
    TASK:
    1. ANALYZE EACH IMAGE: For each provided reference image, identify exactly how many people are in it and their specific body posing (hand positions, tilt of head, interaction).
    2. REPLICATE AS ILLUSTRATION: Draw a high-quality version of each pose.
       - Use a cute chibi art style.
       - Bride and Groom must look charming.
    3. THEME & OUTFITS: Apply the theme "${styleInfo.theme}". ${styleInfo.description ? `Character details: ${styleInfo.description}` : ''}
    4. GRID LAYOUT: Arrange ALL reconstructed poses into a SINGLE clean professional grid collage.
       - IMPORTANT: Add a small, neat number (1, 2, 3...) in the corner of each pose box.
       - Layout orientation: ${styleInfo.layout}.
    
    OUTPUT: A single 4K image that serves as a professional wedding posing guide poster.`;

    if (styleInfo.themeId === 'graphite') {
        instructions += `
        CRITICAL STYLE OVERRIDE (GRAPHITE MODE):
        - NO COLORS. The entire image MUST be in black and white pencil/graphite sketch style.
        - PURE WHITE BACKGROUND.
        - Only clean, expressive pencil lines to show the pose.
        - Focus on body geometry and posing lines.
        - Minimal shading, emphasizing strong outlines.
        `;
    }

    instructions += `\n\n${GENERAL_QUALITY_SUFFIX}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [...parts, { text: instructions }]
        },
        config: {
            responseModalalities: [Modality.IMAGE]
        }
    });

    return parseImageModelResponse(response);
}
