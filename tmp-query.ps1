$envFile = Get-Content .env.local
$url = ($envFile | Select-String "VITE_SUPABASE_URL=(.*)").Matches.Groups[1].Value.Trim()
$key = ($envFile | Select-String "VITE_SUPABASE_ANON_KEY=(.*)").Matches.Groups[1].Value.Trim()

$response = Invoke-RestMethod -Uri "$url/rest/v1/tasks?title=ilike.*Check%20de%20Disponibilidade*&due_date=gte.2026-03-04T00:00:00&due_date=lt.2026-03-05T00:00:00&select=id,title,status,due_date,unit_id,is_recurring,parent_task_id,routine_id" -Headers @{ "apikey" = $key; "Authorization" = "Bearer $key" }

$response | ConvertTo-Json -Depth 5
