# Full end-to-end test of the XP engine
# PowerShell script — run this from the Puck root folder

Write-Host "`n=== STEP 1: Login as Feriku ===" -ForegroundColor Cyan
$loginBody = '{"email":"feriku@realm.com","password":"password123"}'
$loginResp = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $loginResp.token
Write-Host "Logged in as: $($loginResp.user.username) | Level: $($loginResp.user.level) | Title: $($loginResp.user.title)"

$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

Write-Host "`n=== STEP 2: Create a Board ===" -ForegroundColor Cyan
$boardBody = '{"name":"My Quest Log","description":"Epic tasks for an epic hero"}'
$boardResp = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/boards" -Method POST -Headers $headers -Body $boardBody
$boardId = $boardResp.board.id
Write-Host "Board created: $($boardResp.board.name) | ID: $boardId"

Write-Host "`n=== STEP 3: Get board to find first column ID ===" -ForegroundColor Cyan
$boardDetail = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/boards/$boardId" -Method GET -Headers $headers
$columnId = $boardDetail.board.columns[0].id
Write-Host "Using column: $($boardDetail.board.columns[0].name) | ID: $columnId"

Write-Host "`n=== STEP 4: Create a Task with 100 XP reward ===" -ForegroundColor Cyan
$taskBody = "{`"column_id`":`"$columnId`",`"title`":`"Slay the Dragon`",`"description`":`"Defeat the dungeon boss`",`"xp_reward`":100,`"priority`":`"legendary`"}"
$taskResp = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/boards/$boardId/tasks" -Method POST -Headers $headers -Body $taskBody
$taskId = $taskResp.task.id
Write-Host "Task created: $($taskResp.task.title) | XP Reward: $($taskResp.task.xp_reward) | ID: $taskId"

Write-Host "`n=== STEP 5: COMPLETE THE TASK — XP ENGINE FIRES ===" -ForegroundColor Yellow
$completeResp = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/boards/$boardId/tasks/$taskId/complete" -Method POST -Headers $headers -Body '{}'
Write-Host "XP Awarded:    $($completeResp.xp_awarded)"
Write-Host "New Total XP:  $($completeResp.new_total_xp)"
Write-Host "Leveled Up?    $($completeResp.leveled_up)"
if ($completeResp.leveled_up) {
    Write-Host "NEW LEVEL: $($completeResp.new_level.level_number) — $($completeResp.new_level.title) [$($completeResp.new_level.class_name)]" -ForegroundColor Green
}

Write-Host "`n=== STEP 6: Try completing the same task again (should fail) ===" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "http://localhost:3001/api/v1/boards/$boardId/tasks/$taskId/complete" -Method POST -Headers $headers -Body '{}'
} catch {
    $errBody = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Correctly rejected: $($errBody.error.code) — $($errBody.error.message)" -ForegroundColor Red
}

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Green
