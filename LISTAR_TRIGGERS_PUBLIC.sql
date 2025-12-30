SELECT 
    event_object_table as table_name,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table IN ('tasks', 'routines', 'routine_checkins');
