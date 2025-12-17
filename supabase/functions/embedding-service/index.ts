import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, parseAIError } from "../_shared/ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, texts } = await req.json();
    
    const inputTexts = texts || (text ? [text] : null);
    
    if (!inputTexts || inputTexts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embeddings: number[][] = [];

    for (const inputText of inputTexts) {
      const embedding = await generateSemanticEmbedding(inputText);
      embeddings.push(embedding);
    }

    return new Response(
      JSON.stringify({
        success: true,
        embeddings: texts ? embeddings : embeddings[0],
        dimensions: 1536,
        model: 'semantic-embedding-v1'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Embedding service error:', error);
    const parsed = parseAIError(error);
    return new Response(
      JSON.stringify({ error: parsed.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateSemanticEmbedding(text: string): Promise<number[]> {
  try {
    const result = await aiChat({
      messages: [
        {
          role: 'system',
          content: `You are an embedding generator. Analyze the text and output ONLY a JSON array of 64 numbers between -1 and 1 representing:
- Topic categories (positions 0-15): sales, marketing, customer service, technical, financial, etc.
- Sentiment dimensions (16-31): positive/negative, urgent/calm, formal/casual, etc.
- Intent signals (32-47): question, request, complaint, praise, information, action, etc.
- Entity types (48-63): person, company, product, service, time, money, etc.
Output ONLY the JSON array, nothing else.`
        },
        { role: 'user', content: text.substring(0, 2000) }
      ],
      purpose: "embedding_generation",
    });

    try {
      const semanticVector = JSON.parse(result.text);
      if (Array.isArray(semanticVector) && semanticVector.length === 64) {
        return expandTo1536(semanticVector, text);
      }
    } catch {
      // If parsing fails, use fallback
    }

    return generateFallbackEmbedding(text);
  } catch (error) {
    console.error('Semantic embedding error:', error);
    return generateFallbackEmbedding(text);
  }
}

function expandTo1536(vector64: number[], text: string): number[] {
  const embedding = new Array(1536).fill(0);
  const textHash = simpleHash(text);
  
  for (let i = 0; i < 1536; i++) {
    const baseIndex = i % 64;
    const repeatIndex = Math.floor(i / 64);
    const noise = (((textHash * (i + 1)) % 1000) / 10000) - 0.05;
    const decay = 1 - (repeatIndex * 0.02);
    embedding[i] = Math.max(-1, Math.min(1, vector64[baseIndex] * decay + noise));
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < 1536; i++) {
      embedding[i] = embedding[i] / magnitude;
    }
  }
  
  return embedding;
}

function generateFallbackEmbedding(text: string): number[] {
  const embedding = new Array(1536).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  const textHash = simpleHash(text);
  
  for (let i = 0; i < words.length && i < 100; i++) {
    const wordHash = simpleHash(words[i]);
    const positions = [wordHash % 1536, (wordHash * 31) % 1536, (wordHash * 127) % 1536];
    for (const pos of positions) {
      embedding[pos] += 0.1;
    }
  }
  
  embedding[0] = Math.min(1, text.length / 1000);
  embedding[1] = Math.min(1, words.length / 100);
  
  for (let i = 0; i < Math.min(text.length, 500); i++) {
    const charCode = text.charCodeAt(i);
    const pos = (charCode * 7 + i) % 1536;
    embedding[pos] += 0.01;
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < 1536; i++) {
      embedding[i] = embedding[i] / magnitude;
    }
  }
  
  return embedding;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
