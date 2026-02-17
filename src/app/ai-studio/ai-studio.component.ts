import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Import GoogleGenAI and GenerateContentResponse for type safety,
// also import Part if you need to explicitly reference its type for more complex scenarios,
// but for this fix, it's mostly about refining the type of 'part.inlineData'.
import { GoogleGenAI, GenerateContentResponse, Part } from '@google/genai';


// --- Helper function to convert a File object to a Gemini API Part ---
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

// --- Helper function to handle Gemini API responses ---
const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // 2. Try to find the image part with correct type guarding
    // We use a type predicate to narrow down the type of 'part' to include 'inlineData'
    // that has 'mimeType' and 'data' properties.
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(
        (part): part is { inlineData: { mimeType: string; data: string; } } =>
            'inlineData' in part &&
            typeof part.inlineData === 'object' &&
            part.inlineData !== null &&
            'mimeType' in part.inlineData && // Ensure mimeType is a property of inlineData
            'data' in part.inlineData        // Ensure data is a property of inlineData
    );

    // Now, if imagePartFromResponse is found, TypeScript knows its inlineData structure
    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData; // Destructuring is now safe
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // Attempt to get text feedback more robustly using a type predicate for text part
    const textPart = response.candidates?.[0]?.content?.parts?.find(
      (part): part is { text: string } => 'text' in part && typeof part.text === 'string'
    );
    const textFeedback = textPart?.text?.trim();


    const errorMessage = `The AI model did not return an image for the ${context}. ` +
        (textFeedback
            ? `The model responded with text: "${textFeedback}"`
            : "This can happen due to safety filters or if the request is too complex or lacks specific instructions for image output. Please try rephrasing your prompt to be more direct or ensure it explicitly asks for an image.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};


@Component({
  selector: 'app-ai-studio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-studio.component.html',
  styleUrls: ['./ai-studio.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AiStudioComponent {
  // --- WARNING: DO NOT EXPOSE API KEYS IN PRODUCTION ---
  // This is for demonstration/learning purposes only.
  // In a real application, proxy this call through a secure backend (like Firebase Cloud Functions).
  private readonly GEMINI_API_KEY = 'AIzaSyDTIGXHoONI48ORU-GhOq5zvlHamBB8Dyw'; // Replace with your actual Gemini API Key
  // --- END WARNING ---

  private ai: GoogleGenAI; // Use GoogleGenAI consistent with your sample

  selectedFile: File | null = null;
  originalImageUrl: string | null = null;
  generatedImageUrl: string | null = null;
  selectedCategory: string = 'clothing';
  specificStyle: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;

  productCategories = [
    'clothing', 'jewelry', 'electronics', 'furniture', 'food', 'other'
  ];

  constructor() {
    // Initialize with GoogleGenAI, not GoogleGenerativeAI
    this.ai = new GoogleGenAI({ apiKey: this.GEMINI_API_KEY });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.originalImageUrl = URL.createObjectURL(file);
      this.generatedImageUrl = null;
      this.errorMessage = null;
    }
  }

  async generateImage() {
    if (!this.selectedFile) {
      this.errorMessage = 'Please upload an image first.';
      return;
    }

    this.isLoading = true;
    this.generatedImageUrl = null;
    this.errorMessage = null;

    try {
      const originalImagePart = await fileToPart(this.selectedFile);

      let userPrompt = `You are an expert product photographer AI. Your task is to transform the raw, unedited product image into a high-quality, professional model or product shoot suitable for e-commerce.

Product Category: ${this.selectedCategory}.`;

      if (this.specificStyle) {
        userPrompt += `
Specific Style Request: ${this.specificStyle}.`;
      } else {
        // Dynamic prompt based on category
        switch (this.selectedCategory.toLowerCase()) {
          case 'clothing':
            userPrompt += `
Guidance: Show a diverse human model wearing the ${this.selectedCategory} in a well-lit, attractive setting, like a studio, urban street, or natural environment. Ensure the model's pose and expression are professional and appealing. The background should complement the product.`;
            break;
          case 'jewelry':
            userPrompt += `
Guidance: Display the ${this.selectedCategory} on an elegant background, with clear focus, exquisite macro-level lighting, and subtle reflections. Consider showing it being worn on a hand, neck, or ear if appropriate, or on a simple, luxurious stand.`;
            break;
          case 'electronics':
            userPrompt += `
Guidance: Present the ${this.selectedCategory} in a sleek, modern, and clean environment (e.g., a minimalist desk, futuristic setting, or a clean studio). Highlight its design, screen quality, and key features.`;
            break;
          case 'furniture':
            userPrompt += `
Guidance: Place the ${this.selectedCategory} in a tastefully decorated room setting (e.g., a contemporary living room, cozy bedroom, or chic office), showcasing its scale, design, and how it fits into a home or professional environment. Use natural or warm lighting.`;
            break;
          case 'food':
            userPrompt += `
Guidance: Present the ${this.selectedCategory} as an appetizing, beautifully plated dish with natural, warm lighting. Use soft focus for background elements and include subtle garnishes to enhance its appeal and freshness.`;
            break;
          default:
            userPrompt += `
Guidance: Ensure a clean, well-lit, and professional background suitable for e-commerce. Focus on making the product look its absolute best for sale, highlighting its features and texture.`;
            break;
        }
      }

      userPrompt += `

Output Format: Return ONLY the final professionally shot image. Do not return text descriptions, conversational elements, or any other output. The output must be a high-quality, photorealistic image, in the same aspect ratio as the input.`;


      const textPart = { text: userPrompt };

      console.log('Sending image and prompt to the model...');
      const response: GenerateContentResponse = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash-image-preview', // Using the model from your sample
          contents: { parts: [originalImagePart, textPart] },
      });
      console.log('Received response from model.', response);

      this.generatedImageUrl = handleApiResponse(response, 'product shoot transformation');

    } catch (error: any) {
      console.error('Error generating image:', error);
      // More user-friendly error messages based on common issues
      if (error.message.includes('API key not valid') || error.message.includes('Unauthorized')) {
        this.errorMessage = 'Authentication Error: Please check your Gemini API key. It might be invalid or unauthorized.';
      } else if (error.message.includes('blocked') || error.message.includes('safety')) {
        this.errorMessage = 'Content Safety Issue: Your request was blocked by safety filters. Please try rephrasing your prompt or selecting a different image.';
      } else if (error.message.includes('not return an image')) {
        this.errorMessage = 'Model Output Error: The AI model did not return a valid image. This can happen with complex requests. Please try again with a simpler prompt.';
      } else {
        this.errorMessage = error.message || 'An unexpected error occurred during image generation. Please try again.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  // The original fileToBase64 is now effectively replaced by fileToPart.
  // We don't need the old private fileToBase64 anymore.
}