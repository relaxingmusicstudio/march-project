import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, maxResults = 10 } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get API key from settings
    const { data: settings } = await supabase
      .from("api_settings")
      .select("setting_value")
      .eq("setting_key", "YOUTUBE_API_KEY")
      .single();

    const apiKey = settings?.setting_value || Deno.env.get("YOUTUBE_API_KEY");

    if (!apiKey) {
      // Return mock data if no API key
      const mockVideos = [
        {
          id: "mock1",
          title: `How to Fix Common ${query} Problems`,
          channel: "Home Repair Pro",
          views: 125000,
          publishedAt: new Date().toISOString(),
          thumbnail: "https://via.placeholder.com/480x360"
        },
        {
          id: "mock2", 
          title: `${query} Tips That Save Money`,
          channel: "DIY Masters",
          views: 89000,
          publishedAt: new Date().toISOString(),
          thumbnail: "https://via.placeholder.com/480x360"
        },
        {
          id: "mock3",
          title: `Top 10 ${query} Mistakes to Avoid`,
          channel: "Expert Advice",
          views: 234000,
          publishedAt: new Date().toISOString(),
          thumbnail: "https://via.placeholder.com/480x360"
        }
      ];

      // Save to content_ideas
      for (const video of mockVideos) {
        await supabase.from("content_ideas").insert({
          source: "youtube",
          source_url: `https://youtube.com/watch?v=${video.id}`,
          topic: video.title,
          niche: query,
          viral_score: Math.floor(Math.random() * 30) + 70,
          suggested_formats: ["short_video", "blog", "social"],
          status: "new"
        });
      }

      return new Response(JSON.stringify({ videos: mockVideos, mock: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Real YouTube API call
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=viewCount&maxResults=${maxResults}&key=${apiKey}`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const videos = data.items?.map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails: { high: { url: string } } } }) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails.high.url
    })) || [];

    // Save to content_ideas
    for (const video of videos) {
      await supabase.from("content_ideas").insert({
        source: "youtube",
        source_url: `https://youtube.com/watch?v=${video.id}`,
        topic: video.title,
        niche: query,
        viral_score: Math.floor(Math.random() * 30) + 70,
        suggested_formats: ["short_video", "blog", "social"],
        status: "new"
      });
    }

    console.log(`Discovered ${videos.length} videos for query: ${query}`);

    return new Response(JSON.stringify({ videos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("YouTube discover error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
