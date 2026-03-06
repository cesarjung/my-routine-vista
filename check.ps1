$headers = @{ "apikey" = $env:VITE_SUPABASE_PUBLISHABLE_KEY; "Authorization" = "Bearer $($env:VITE_SUPABASE_PUBLISHABLE_KEY)" }

Write-Host "--- ROTINAS E SETORES ---"
$urlRoutines = "$($env:VITE_SUPABASE_URL)/rest/v1/routines?select=id,title,sector_id,sectors(name)&title=in.(Checkpoint%20Di%C3%A1rio,Boletim%20de%20Produtividade,Check%20de%20Disponibilidade)"
$res1 = Invoke-RestMethod -Uri $urlRoutines -Headers $headers -Method Get
$res1 | ConvertTo-Json -Depth 5

Write-Host "`n--- UNIDADES LIVRAMENTO ---"
$urlUnits = "$($env:VITE_SUPABASE_URL)/rest/v1/units?select=id,name&name=ilike.*Livramento*"
$res2 = Invoke-RestMethod -Uri $urlUnits -Headers $headers -Method Get
$res2 | ConvertTo-Json -Depth 5

if ($res2.Count -gt 0) {
    $livId = $res2[0].id
    $checkId = ($res1 | Where-Object title -eq 'Check de Disponibilidade').id
    
    if ($checkId) {
        Write-Host "`n--- ASSIGNEES DE CHECK DE DISPONIBILIDADE ---"
        $urlAssignees = "$($env:VITE_SUPABASE_URL)/rest/v1/routine_assignees?select=user_id,profiles(unit_id,full_name)&routine_id=eq.$checkId"
        $res3 = Invoke-RestMethod -Uri $urlAssignees -Headers $headers -Method Get
        Write-Host "Total Assignees: $($res3.Count)"
        
        $livAssignees = $res3 | Where-Object { $_.profiles.unit_id -eq $livId }
        Write-Host "Livramento Assignees: $($livAssignees.Count)"
        $livAssignees | ConvertTo-Json -Depth 5
    }
}
