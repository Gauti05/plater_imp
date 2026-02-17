import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, serverTimestamp } from '@angular/fire/firestore';

// --- TypeScript Declaration Fix ---
// These variables are globally injected by the runtime environment 
// but must be declared here to satisfy the TypeScript compiler.
declare const __app_id: string;
// declare const __firebase_config: string; // Not strictly needed in the service but useful for context
// declare const __initial_auth_token: string;
// ----------------------------------

// Define the interface for the structured data storage
interface ReorderSuggestion {
  name: string;
  suggestQty: number;
  reason: string;
  createdAt?: any;
}

// Global configuration variables for the API call (these are set by the Canvas environment)
// We use a global empty string for the key, as the environment provides it at runtime.
const apiKey = "AIzaSyDtInYL2GUz2Ydwl0XYgGggFLaJrAOTFCc"; 
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

@Injectable({ providedIn: 'root' })
export class AiService {
  private firestore = inject(Firestore);

  /**
   * Helper function to handle fetch calls with exponential backoff for retries.
   */
  private async fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        // Handle server-side errors (5xx) with retry
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.statusText}`);
        }
        // For other client errors (4xx), don't retry, just throw the error
        throw new Error(`API error: ${response.statusText} (${response.status})`);
      } catch (error) {
        if (i === retries - 1) {
          throw error; // Last retry failed
        }
        // Wait for an exponentially increasing delay before retrying
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    // This line should technically be unreachable
    throw new Error("Exhausted all retries for API call.");
  }


  /**
   * Save a reorder suggestion to Firestore
   */
  async saveReorderSuggestion(s: ReorderSuggestion) {
    try {
      // Safely access __app_id
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      
      // Use the public data path structure
      const colPath = `artifacts/${appId}/public/data/ai-reorders`;
      const col = collection(this.firestore, colPath);

      await addDoc(col, { ...s, createdAt: serverTimestamp() });
      console.log("AI reorder suggestion saved successfully.");
    } catch (err) {
      console.error('Error saving AI reorder suggestion:', err);
    }
  }

  /**
   * Fetch saved AI reorder suggestions
   */
  async getReorderSuggestions(): Promise<ReorderSuggestion[]> {
    try {
      // Safely access __app_id
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      
      // Use the public data path structure
      const colPath = `artifacts/${appId}/public/data/ai-reorders`;
      const snap = await getDocs(collection(this.firestore, colPath));
      return snap.docs.map(d => d.data() as ReorderSuggestion);
    } catch (err) {
      console.error('Error fetching AI reorder suggestions:', err);
      return [];
    }
  }

  /**
   * Call Gemini via the actual API endpoint to generate reasoning
   * @param prompt The user's prompt or request for the model.
   * @returns A promise resolving to the generated text.
   */
  async callGemini(prompt: string): Promise<string> {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            temperature: 0.7,
            maxOutputTokens: 200,
        }
    };

    try {
        const response = await this.fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
            return generatedText;
        } else {
            console.error('Gemini API returned an unexpected structure or no text:', result);
            return 'AI Error: Could not parse response.';
        }

    } catch (err) {
        console.error('Gemini call error after retries:', err);
        return `AI system error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
