import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !requestingUser) {
      console.error("User verification failed:", userError);
      throw new Error("Unauthorized");
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (roleData?.role !== "admin") {
      throw new Error("Apenas administradores podem alterar emails");
    }

    const body = await req.json();
    const { userId, newEmail } = body;

    if (!userId || !newEmail) {
      throw new Error("userId e newEmail são obrigatórios");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error("Formato de email inválido");
    }

    console.log(`Admin ${requestingUser.email} updating email for user ${userId} to ${newEmail}`);

    // Update user email using admin API
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: newEmail, email_confirm: true }
    );

    if (updateError) {
      console.error("Error updating user email:", updateError);
      throw new Error(updateError.message);
    }

    // Also update the profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email: newEmail })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile email:", profileError);
      // Don't throw - the auth email was updated successfully
    }

    console.log(`Email updated successfully for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email atualizado com sucesso",
        user: { id: updatedUser.user?.id, email: updatedUser.user?.email }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
