import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    switch (action) {
      case 'generate_image':
        return await generateImage(params, LOVABLE_API_KEY);
      case 'generate_video':
        return await generateVideo(params);
      case 'enhance_prompt':
        return await enhancePrompt(params, LOVABLE_API_KEY);
      case 'get_brand_style':
        return await getBrandStyle(params);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: generate_image, generate_video, enhance_prompt, get_brand_style' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Visual content generator error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate image using Gemini's image generation
async function generateImage(params: any, apiKey: string | undefined) {
  const { prompt, style = 'professional', aspect_ratio = '16:9', brand_colors } = params;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'API key not configured',
        mock_url: 'https://placehold.co/1200x675/1A56DB/FFFFFF?text=AI+Generated+Image'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Enhance prompt with style and brand
  const enhancedPrompt = `${prompt}. Style: ${style}. ${brand_colors ? `Use brand colors: ${brand_colors}` : ''}. Professional quality, ${aspect_ratio} aspect ratio.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          { role: 'user', content: enhancedPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Image generation error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Image generation failed',
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Check for image in response
    const imageContent = data.choices?.[0]?.message?.content;
    
    return new Response(
      JSON.stringify({
        success: true,
        image_url: imageContent,
        prompt_used: enhancedPrompt,
        model: 'gemini-2.5-flash-image'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Image generation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Generate video (placeholder for Veo 3 integration)
async function generateVideo(params: any) {
  const { image_url, script, duration = 5, style = 'professional' } = params;

  // Veo 3 integration placeholder
  // In production, would call Veo 3 API
  
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Video generation queued',
      status: 'pending',
      job_id: `vid_${Date.now()}`,
      estimated_time: '2-5 minutes',
      note: 'Veo 3 integration pending API access. Video will be generated when available.',
      mock_video_url: 'https://placehold.co/1920x1080/1A56DB/FFFFFF?text=Video+Preview'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Enhance prompts for better visual output
async function enhancePrompt(params: any, apiKey: string | undefined) {
  const { prompt, target_platform, content_type } = params;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ enhanced_prompt: prompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an expert at creating image generation prompts. Enhance the user's prompt to create better visual output.

Platform: ${target_platform || 'general'}
Content type: ${content_type || 'marketing'}

Guidelines:
- Add specific visual details (lighting, composition, style)
- Include relevant aspect ratio suggestions
- Add professional quality indicators
- Keep brand consistency in mind

Output JSON: { "enhanced_prompt": "...", "style_notes": "...", "recommended_aspect": "..." }`
        },
        { role: 'user', content: prompt }
      ],
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  try {
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ enhanced_prompt: prompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Get brand style guidelines
async function getBrandStyle(params: any) {
  const { brand_name } = params;

  // Default brand style (would be stored in DB in production)
  const brandStyle = {
    colors: {
      primary: '#1A56DB',
      secondary: '#046C4E',
      accent: '#DC2626',
      background: '#FFFFFF',
      text: '#111827'
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter'
    },
    style: {
      tone: 'professional',
      imagery: 'modern, clean, trustworthy',
      photography_style: 'bright, high-contrast, people-focused',
      illustration_style: 'minimal, geometric, flat design'
    },
    guidelines: {
      do: [
        'Use consistent color palette',
        'Include human elements when possible',
        'Maintain clean, uncluttered compositions',
        'Use high-quality imagery'
      ],
      dont: [
        'Use stock photo clichés',
        'Overcrowd with text',
        'Use dark/gloomy imagery',
        'Mix conflicting styles'
      ]
    }
  };

  return new Response(
    JSON.stringify(brandStyle),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
