-- Fix Google Calendar Tokens Table and Permissions

-- 1. Ensure table exists (it should, but just to be safe/idempotent)
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- 2. Enable RLS
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- 3. Create/Replace Policies

-- Policy: Users can view their own tokens
DROP POLICY IF EXISTS "Users can view their own calendar tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can view their own calendar tokens" ON public.google_calendar_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own tokens (needed for client-side auth flow updates if any)
-- OR typically the Edge Function does this with service_role, but if client does it:
DROP POLICY IF EXISTS "Users can insert their own calendar tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can insert their own calendar tokens" ON public.google_calendar_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tokens
DROP POLICY IF EXISTS "Users can update their own calendar tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can update their own calendar tokens" ON public.google_calendar_tokens
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own tokens
DROP POLICY IF EXISTS "Users can delete their own calendar tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can delete their own calendar tokens" ON public.google_calendar_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload config';
