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

// Input validation constants
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
}

// Input validation helpers
function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

function sanitizeString(str: string | null | undefined, maxLength: number): string {
  if (!str) return "";
  return str.slice(0, maxLength).trim();
}

function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return true; // Optional dates are valid
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

async function getValidAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: tokenData, error } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    console.log("No token found for user");
    return null;
  }

  // Check if token is expired
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt > new Date()) {
    return tokenData.access_token;
  }

  // Token expired, try to refresh
  if (!tokenData.refresh_token) {
    console.log("No refresh token available");
    return null;
  }

  console.log("Refreshing expired token...");

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
    console.error("Token refresh failed:", refreshData.error);
    return null;
  }

  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

  // Update token in database
  await supabase
    .from("google_calendar_tokens")
    .update({
      access_token: refreshData.access_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return refreshData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
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

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log(`Google Calendar Sync - Action: ${action}, User: ${user.id}`);

    const accessToken = await getValidAccessToken(supabase, user.id);
    
    if (!accessToken) {
      return new Response(JSON.stringify({ 
        error: "Google Calendar não conectado",
        needsAuth: true
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-event") {
      // Create event in Google Calendar from task
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { taskId, title, description, startDate, dueDate } = body;

      // Validate inputs
      const sanitizedTitle = sanitizeString(title, MAX_TITLE_LENGTH);
      if (!sanitizedTitle) {
        return new Response(JSON.stringify({ error: "Título é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (taskId && !isValidUUID(taskId)) {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isValidDate(startDate) || !isValidDate(dueDate)) {
        return new Response(JSON.stringify({ error: "Data inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sanitizedDescription = sanitizeString(description, MAX_DESCRIPTION_LENGTH);

      console.log(`Creating Google Calendar event for task: ${taskId || 'new'}`);

      const event = {
        summary: sanitizedTitle,
        description: sanitizedDescription,
        start: {
          dateTime: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 3600000).toISOString(),
          timeZone: "America/Sao_Paulo",
        },
      };

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      const eventData = await response.json();

      if (!response.ok) {
        console.error("Error creating event:", eventData.error?.message);
        return new Response(JSON.stringify({ error: "Erro ao criar evento no Google Calendar" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Event created with ID: ${eventData.id}`);

      // Update task with Google event ID
      if (taskId && isValidUUID(taskId)) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ google_event_id: eventData.id })
          .eq("id", taskId);

        if (updateError) {
          console.error("Error updating task with event ID:", updateError.message);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        eventId: eventData.id,
        htmlLink: eventData.htmlLink
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-event") {
      // Update existing Google Calendar event
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { eventId, title, description, startDate, dueDate, status } = body;

      if (!eventId || typeof eventId !== 'string' || eventId.length > 256) {
        return new Response(JSON.stringify({ error: "ID do evento inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isValidDate(startDate) || !isValidDate(dueDate)) {
        return new Response(JSON.stringify({ error: "Data inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sanitizedTitle = sanitizeString(title, MAX_TITLE_LENGTH);
      const sanitizedDescription = sanitizeString(description, MAX_DESCRIPTION_LENGTH);

      console.log(`Updating Google Calendar event: ${eventId}`);

      const event: any = {
        summary: sanitizedTitle,
        description: sanitizedDescription,
      };

      if (startDate) {
        event.start = {
          dateTime: new Date(startDate).toISOString(),
          timeZone: "America/Sao_Paulo",
        };
      }

      if (dueDate) {
        event.end = {
          dateTime: new Date(dueDate).toISOString(),
          timeZone: "America/Sao_Paulo",
        };
      }

      // Mark as cancelled if task is done
      if (status === "concluida" || status === "cancelada") {
        event.status = "cancelled";
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating event:", errorData.error?.message);
        return new Response(JSON.stringify({ error: "Erro ao atualizar evento no Google Calendar" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Event updated successfully");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-event") {
      // Delete Google Calendar event
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { eventId } = body;

      if (!eventId || typeof eventId !== 'string' || eventId.length > 256) {
        return new Response(JSON.stringify({ error: "ID do evento inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Deleting Google Calendar event: ${eventId}`);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok && response.status !== 404) {
        console.error("Error deleting event");
        return new Response(JSON.stringify({ error: "Erro ao deletar evento do Google Calendar" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Event deleted successfully");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch-events") {
      // Fetch events from Google Calendar to import as tasks
      const timeMinParam = url.searchParams.get("timeMin");
      const timeMaxParam = url.searchParams.get("timeMax");
      
      const timeMin = isValidDate(timeMinParam) && timeMinParam ? timeMinParam : new Date().toISOString();
      const timeMax = isValidDate(timeMaxParam) && timeMaxParam ? timeMaxParam : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      console.log(`Fetching Google Calendar events from ${timeMin} to ${timeMax}`);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${encodeURIComponent(timeMin)}&` +
        `timeMax=${encodeURIComponent(timeMax)}&` +
        `singleEvents=true&` +
        `orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Error fetching events:", data.error?.message);
        return new Response(JSON.stringify({ error: "Erro ao buscar eventos do Google Calendar" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Fetched ${data.items?.length || 0} events`);

      // Filter out events that are already imported (check by google_event_id)
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("google_event_id")
        .not("google_event_id", "is", null);

      const existingEventIds = new Set((existingTasks || []).map(t => t.google_event_id));

      const newEvents = (data.items || [])
        .filter((event: GoogleEvent) => !existingEventIds.has(event.id) && event.status !== "cancelled")
        .map((event: GoogleEvent) => ({
          id: event.id,
          title: event.summary,
          description: event.description,
          startDate: event.start?.dateTime || event.start?.date,
          endDate: event.end?.dateTime || event.end?.date,
        }));

      return new Response(JSON.stringify({ events: newEvents }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import-event") {
      // Import a Google Calendar event as a task
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { eventId, unitId } = body;

      if (!eventId || typeof eventId !== 'string' || eventId.length > 256) {
        return new Response(JSON.stringify({ error: "ID do evento inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!unitId || !isValidUUID(unitId)) {
        return new Response(JSON.stringify({ error: "Unidade inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Importing Google Calendar event: ${eventId}`);

      // Fetch the event details
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const event = await response.json();

      if (!response.ok) {
        console.error("Error fetching event:", event.error?.message);
        return new Response(JSON.stringify({ error: "Erro ao buscar evento do Google Calendar" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create task from event
      const startDate = event.start?.dateTime || event.start?.date;
      const dueDate = event.end?.dateTime || event.end?.date;

      const { data: task, error: insertError } = await supabase
        .from("tasks")
        .insert({
          title: sanitizeString(event.summary, MAX_TITLE_LENGTH),
          description: sanitizeString(event.description, MAX_DESCRIPTION_LENGTH) || null,
          start_date: startDate,
          due_date: dueDate,
          unit_id: unitId,
          created_by: user.id,
          assigned_to: user.id,
          google_event_id: eventId,
          status: "pendente",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating task:", insertError.message);
        return new Response(JSON.stringify({ error: "Erro ao criar tarefa" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Task created with ID: ${task.id}`);

      return new Response(JSON.stringify({ success: true, task }), {
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
