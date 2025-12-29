-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload config';

-- Verify table existence (trivial check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dashboard_panels') THEN
        RAISE EXCEPTION 'Table dashboard_panels does not exist!';
    END IF;
END $$;
