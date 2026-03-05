$envFile = Get-Content .env -Raw
$url = [regex]::match($envFile, 'VITE_SUPABASE_URL="?(.*?)"?`r?`n').Groups[1].Value.Trim()
$key = [regex]::match($envFile, 'VITE_SUPABASE_PUBLISHABLE_KEY="?(.*?)"?`r?`n').Groups[1].Value.Trim()

$uri = "$url/rest/v1/tasks?due_date=gte.2026-03-04T00:00:00&due_date=lt.2026-03-05T00:00:00&select=id,title,status,due_date,is_recurring,parent_task_id,routine_id,created_at&limit=1000"
$response = Invoke-RestMethod -Uri $uri -Headers @{ "apikey" = $key; "Authorization" = "Bearer $key" }

$response | ConvertTo-Json -Depth 5 | Out-File "db_state_today.json" -Encoding utf8
