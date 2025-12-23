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

// Input validation helpers
const MAX_URI_LENGTH = 2000;
const MAX_TOKEN_LENGTH = 4096;

function isValidUri(uri: string): boolean {
  if (!uri || uri.length > MAX_URI_LENGTH) return false;
  try {
    new URL(uri);
    return true;
  } catch {
    return false;
  }
}

function sanitizeToken(token: string | null): string | null {
  if (!token) return null;
  if (token.length > MAX_TOKEN_LENGTH) return null;
  return token;
}

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
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isValidUri(redirectUri)) {
        console.error("Invalid redirect URI format or length");
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user ID from auth header to include in state
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events"
      ].join(" ");

      // Include user_id in state so we can save tokens on callback
      const state = encodeURIComponent(JSON.stringify({ 
        redirect_uri: redirectUri,
        user_id: user.id
      }));

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(`${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`;

      console.log("Generated auth URL for user:", user.id);

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
        return new Response("Erro na autenticação. Tente novamente.", { status: 400 });
      }

      if (!code || !stateParam) {
        console.error("Missing code or state");
        return new Response("Parâmetros inválidos", { status: 400 });
      }

      let state;
      try {
        state = JSON.parse(decodeURIComponent(stateParam));
      } catch {
        console.error("Invalid state parameter");
        return new Response("Parâmetros inválidos", { status: 400 });
      }

      const redirectUri = state.redirect_uri;
      const userId = state.user_id;
      
      if (!isValidUri(redirectUri)) {
        console.error("Invalid redirect URI in state");
        return new Response("Parâmetros inválidos", { status: 400 });
      }

      if (!userId) {
        console.error("No user_id in state");
        return new Response("Parâmetros inválidos", { status: 400 });
      }

      console.log("Exchanging code for tokens for user:", userId);

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
        console.error("Token exchange error:", tokenData.error);
        return new Response("Erro ao conectar com Google Calendar. Tente novamente.", { status: 400 });
      }

      console.log("Tokens obtained successfully, saving to database...");

      // Save tokens directly in the callback
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

      const { error: upsertError } = await supabase
        .from("google_calendar_tokens")
        .upsert({
          user_id: userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id"
        });

      if (upsertError) {
        console.error("Error saving tokens:", upsertError.message);
        return new Response(`Erro ao salvar conexão: ${upsertError.message}`, { status: 500 });
      }

      console.log("Tokens saved successfully for user:", userId);

      // Redirect back to app with success flag only (no tokens in URL)
      const finalRedirect = `${redirectUri}?google_auth=success`;

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
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Verify the user's JWT
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        console.error("User verification failed:", userError?.message);
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { access_token, refresh_token, expires_in } = body;

      const sanitizedAccessToken = sanitizeToken(access_token);
      const sanitizedRefreshToken = sanitizeToken(refresh_token);

      if (!sanitizedAccessToken) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresInNum = typeof expires_in === 'number' && expires_in > 0 && expires_in < 86400 
        ? expires_in 
        : 3600;
      const expiresAt = new Date(Date.now() + expiresInNum * 1000);

      console.log(`Saving tokens for user: ${user.id}`);

      // Upsert tokens
      const { error: upsertError } = await supabase
        .from("google_calendar_tokens")
        .upsert({
          user_id: user.id,
          access_token: sanitizedAccessToken,
          refresh_token: sanitizedRefreshToken,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id"
        });

      if (upsertError) {
        console.error("Error saving tokens:", upsertError.message);
        return new Response(JSON.stringify({ error: "Erro ao salvar conexão" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Tokens saved successfully");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh-token") {
      // Refresh access token using refresh token
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get stored refresh token
      const { data: tokenData, error: fetchError } = await supabase
        .from("google_calendar_tokens")
        .select("refresh_token")
        .eq("user_id", user.id)
        .single();

      if (fetchError || !tokenData?.refresh_token) {
        console.error("No refresh token found");
        return new Response(JSON.stringify({ error: "Reconecte o Google Calendar" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        console.error("Refresh error:", refreshData.error);
        return new Response(JSON.stringify({ error: "Erro ao atualizar token. Reconecte o Google Calendar." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        console.error("Error updating token:", updateError.message);
        return new Response(JSON.stringify({ error: "Erro ao atualizar conexão" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Disconnecting Google Calendar for user: ${user.id}`);

      const { error: deleteError } = await supabase
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("Error disconnecting:", deleteError.message);
        return new Response(JSON.stringify({ error: "Erro ao desconectar" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      // Check if user has Google Calendar connected
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
