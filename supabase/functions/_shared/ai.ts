/**
 * AI Provider Abstraction Layer
 * 
 * Environment Variables:
 * - AI_PROVIDER (optional): "lovable" | "gemini" - forces a specific provider
 * - LOVABLE_API_KEY: Key for Lovable AI Gateway (auto-provisioned by Lovable)
 * - GEMINI_API_KEY: Key for Google Gemini API (free tier available)
 * 
 * Provider Selection Logic:
 * 1. If AI_PROVIDER is set, use that provider
 * 2. Else if LOVABLE_API_KEY exists and length > 20, use "lovable"
 * 3. Else fallback to "gemini"
 */

export type AIProvider = "lovable" | "gemini";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIChatOptions {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: any[];
  tool_choice?: any;
}

export interface AIChatResponse {
  text: string;
  raw: any;
  provider: AIProvider;
}

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Determines which AI provider to use based on environment configuration
 */
export function selectProvider(): AIProvider {
  const explicitProvider = Deno.env.get("AI_PROVIDER");
  if (explicitProvider === "lovable" || explicitProvider === "gemini") {
    return explicitProvider;
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
  if (lovableKey.length > 20) {
    return "lovable";
  }

  return "gemini";
}

/**
 * Masks an API key for safe logging (shows first 4 and last 4 chars)
 */
function maskKey(key: string | undefined): string {
  if (!key || key.length < 10) return "[empty/short]";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Calls Lovable AI Gateway
 */
async function callLovable(options: AIChatOptions): Promise<AIChatResponse> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  
  if (!apiKey || apiKey.length === 0) {
    throw new Error("LOVABLE_API_KEY is not configured or empty");
  }

  const body: any = {
    model: options.model || "google/gemini-2.5-flash",
    messages: options.messages,
  };

  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.max_tokens !== undefined) body.max_tokens = options.max_tokens;
  if (options.tools) body.tools = options.tools;
  if (options.tool_choice) body.tool_choice = options.tool_choice;

  const response = await fetch(LOVABLE_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ai] Lovable gateway error:", {
      status: response.status,
      key_masked: maskKey(apiKey),
      error: errorText.slice(0, 200),
    });
    throw new Error(`Lovable AI error: ${response.status} - ${errorText.slice(0, 100)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";

  return { text, raw: data, provider: "lovable" };
}

/**
 * Calls Google Gemini API directly
 * Note: When tools are provided, we ask Gemini to return JSON matching the tool schema
 */
async function callGemini(options: AIChatOptions): Promise<AIChatResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  
  if (!apiKey || apiKey.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured - required for Gemini provider");
  }

  // Convert messages to Gemini format
  const systemMessage = options.messages.find(m => m.role === "system")?.content || "";
  const conversationMessages = options.messages.filter(m => m.role !== "system");
  
  // Build Gemini contents array
  const contents = conversationMessages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  // If tools are provided, add instruction to return JSON matching the tool schema
  let enhancedSystemMessage = systemMessage;
  if (options.tools && options.tools.length > 0) {
    const toolSchema = options.tools[0]?.function?.parameters;
    if (toolSchema) {
      enhancedSystemMessage += `\n\nIMPORTANT: You MUST respond with a valid JSON object matching this schema:
${JSON.stringify(toolSchema, null, 2)}

Your response should be ONLY the JSON object, no other text.`;
    }
  }

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.max_tokens ?? 2048,
    },
  };

  if (enhancedSystemMessage) {
    requestBody.systemInstruction = { parts: [{ text: enhancedSystemMessage }] };
  }

  const model = "gemini-2.0-flash"; // Free tier model
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ai] Gemini API error:", {
      status: response.status,
      key_masked: maskKey(apiKey),
      error: errorText.slice(0, 200),
    });
    throw new Error(`Gemini AI error: ${response.status} - ${errorText.slice(0, 100)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // If tools were requested, wrap the response in a format matching OpenAI tool_calls
  if (options.tools && options.tools.length > 0) {
    // Try to parse the text as JSON and wrap it in tool_calls format
    try {
      // Clean up the response - remove markdown code blocks if present
      let jsonText = text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      // Validate it's valid JSON
      JSON.parse(jsonText);
      
      // Return in OpenAI-compatible format
      const wrappedData = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: options.tools[0]?.function?.name || "send_response",
                arguments: jsonText,
              }
            }]
          }
        }]
      };
      return { text, raw: wrappedData, provider: "gemini" };
    } catch (e) {
      console.warn("[ai] Gemini response not valid JSON for tool call, returning as-is:", e);
    }
  }

  return { text, raw: data, provider: "gemini" };
}

/**
 * Main AI chat function - automatically selects provider and calls appropriate API
 */
export async function aiChat(options: AIChatOptions): Promise<AIChatResponse> {
  const provider = selectProvider();
  
  console.log("[ai] Using provider:", provider);

  try {
    if (provider === "lovable") {
      return await callLovable(options);
    } else {
      return await callGemini(options);
    }
  } catch (error) {
    console.error("[ai] Chat error:", {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
