import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log(`Google Calendar Auth - Action: ${action}`);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    
    if (action === "auth-url") {
      // Generate OAuth URL for user to authorize
      const redirectUri = url.searchParams.get("redirect_uri");
      
      if (!redirectUri) {
        throw new Error("redirect_uri is required");
      }

      const scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events"
      ].join(" ");

      // We'll use state to store the redirect URI for the callback
      const state = encodeURIComponent(JSON.stringify({ 
        redirect_uri: redirectUri 
      }));

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(`${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`;

      console.log("Generated auth URL");

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      // Handle OAuth callback from Google
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        console.error("OAuth error:", error);
        return new Response(`Erro na autenticação: ${error}`, { status: 400 });
      }

      if (!code || !stateParam) {
        console.error("Missing code or state");
        return new Response("Parâmetros inválidos", { status: 400 });
      }

      const state = JSON.parse(decodeURIComponent(stateParam));
      const redirectUri = state.redirect_uri;

      console.log("Exchanging code for tokens...");

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error("Token exchange error:", tokenData);
        return new Response(`Erro ao obter tokens: ${tokenData.error_description}`, { status: 400 });
      }

      console.log("Tokens obtained successfully");

      // Create temporary token for the frontend to exchange
      const tempToken = crypto.randomUUID();
      
      // Store tokens temporarily in a way the frontend can retrieve them
      // We'll redirect with a temp token that the frontend will exchange
      const finalRedirect = `${redirectUri}?google_auth=success&temp_token=${tempToken}&access_token=${encodeURIComponent(tokenData.access_token)}&refresh_token=${encodeURIComponent(tokenData.refresh_token || "")}&expires_in=${tokenData.expires_in}`;

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: finalRedirect,
        },
      });
    }

    if (action === "save-tokens") {
      // Save tokens to database (called from frontend after callback)
      if (!authHeader) {
        throw new Error("Authorization header required");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Verify the user's JWT
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        console.error("User verification failed:", userError);
        throw new Error("Unauthorized");
      }

      const body = await req.json();
      const { access_token, refresh_token, expires_in } = body;

      if (!access_token) {
        throw new Error("access_token is required");
      }

      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

      console.log(`Saving tokens for user: ${user.id}`);

      // Upsert tokens
      const { error: upsertError } = await supabase
        .from("google_calendar_tokens")
        .upsert({
          user_id: user.id,
          access_token,
          refresh_token,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id"
        });

      if (upsertError) {
        console.error("Error saving tokens:", upsertError);
        throw upsertError;
      }

      console.log("Tokens saved successfully");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh-token") {
      // Refresh access token using refresh token
      if (!authHeader) {
        throw new Error("Authorization header required");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        throw new Error("Unauthorized");
      }

      // Get stored refresh token
      const { data: tokenData, error: fetchError } = await supabase
        .from("google_calendar_tokens")
        .select("refresh_token")
        .eq("user_id", user.id)
        .single();

      if (fetchError || !tokenData?.refresh_token) {
        console.error("No refresh token found");
        throw new Error("No refresh token available");
      }

      console.log("Refreshing access token...");

      // Refresh the token
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshResponse.json();

      if (refreshData.error) {
        console.error("Refresh error:", refreshData);
        throw new Error(refreshData.error_description);
      }

      const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

      // Update access token in database
      const { error: updateError } = await supabase
        .from("google_calendar_tokens")
        .update({
          access_token: refreshData.access_token,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      console.log("Token refreshed successfully");

      return new Response(JSON.stringify({ 
        access_token: refreshData.access_token,
        expires_at: expiresAt.toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      // Remove Google Calendar connection
      if (!authHeader) {
        throw new Error("Authorization header required");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        throw new Error("Unauthorized");
      }

      console.log(`Disconnecting Google Calendar for user: ${user.id}`);

      const { error: deleteError } = await supabase
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      // Check if user has Google Calendar connected
      if (!authHeader) {
        throw new Error("Authorization header required");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        throw new Error("Unauthorized");
      }

      const { data: tokenData } = await supabase
        .from("google_calendar_tokens")
        .select("expires_at")
        .eq("user_id", user.id)
        .single();

      const isConnected = !!tokenData;
      const isExpired = tokenData ? new Date(tokenData.expires_at) < new Date() : false;

      return new Response(JSON.stringify({ 
        connected: isConnected,
        expired: isExpired
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
