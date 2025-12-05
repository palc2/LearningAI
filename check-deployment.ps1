# Deployment Status Checker
# Polls the deployment API to monitor deployment progress

param(
    [int]$IntervalSeconds = 30,
    [int]$MaxWaitMinutes = 15
)

# Load environment variables
$envContent = Get-Content .env -ErrorAction SilentlyContinue
if ($envContent) {
    $apiKeyMatch = $envContent | Select-String -Pattern 'SUPER_MIND_API_KEY="([^"]+)"'
    $portalUrlMatch = $envContent | Select-String -Pattern 'STUDENT_PORTAL_URL="([^"]+)"'
    
    if ($apiKeyMatch) {
        $env:AI_BUILDER_TOKEN = $apiKeyMatch.Matches.Groups[1].Value
    }
    if ($portalUrlMatch) {
        $API_URL = $portalUrlMatch.Matches.Groups[1].Value
    } else {
        $API_URL = "https://space.ai-builders.com/backend"
    }
} else {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    exit 1
}

if (-not $env:AI_BUILDER_TOKEN) {
    Write-Host "Error: AI_BUILDER_TOKEN not found in .env" -ForegroundColor Red
    exit 1
}

# Get service name from deploy-config.json
$config = Get-Content "deploy-config.json" | ConvertFrom-Json
$serviceName = $config.service_name

$headers = @{
    "Authorization" = "Bearer $env:AI_BUILDER_TOKEN"
    "Content-Type" = "application/json"
}

$endTime = (Get-Date).AddMinutes($MaxWaitMinutes)
$startTime = Get-Date
$checkCount = 0

Write-Host ""
Write-Host "Deployment Status Monitor" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Service: $serviceName" -ForegroundColor Gray
Write-Host "Polling every: $IntervalSeconds seconds" -ForegroundColor Gray
Write-Host "Max wait time: $MaxWaitMinutes minutes" -ForegroundColor Gray
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

while ((Get-Date) -lt $endTime) {
    $checkCount++
    $elapsed = ((Get-Date) - $startTime).TotalMinutes
    
    try {
        $status = Invoke-RestMethod -Uri "$API_URL/v1/deployments/$serviceName" -Headers $headers -ErrorAction Stop
        
        $statusColor = switch ($status.status) {
            "HEALTHY" { "Green" }
            "UNHEALTHY" { "Red" }
            "ERROR" { "Red" }
            "DEGRADED" { "Yellow" }
            default { "Yellow" }
        }
        
        $elapsedMin = [math]::Round($elapsed, 1)
        Write-Host "[$elapsedMin min] Check #$checkCount - Status: " -NoNewline -ForegroundColor Gray
        Write-Host "$($status.status)" -ForegroundColor $statusColor
        
        if ($status.public_url) {
            Write-Host "  URL: $($status.public_url)" -ForegroundColor Cyan
        }
        
        if ($status.message) {
            Write-Host "  $($status.message)" -ForegroundColor Gray
        }
        
        # Check if deployment is complete
        if ($status.status -eq "HEALTHY") {
            Write-Host ""
            Write-Host "Deployment successful!" -ForegroundColor Green
            Write-Host "================================" -ForegroundColor Green
            Write-Host "Your app is live at:" -ForegroundColor Cyan
            Write-Host "  $($status.public_url)" -ForegroundColor White -BackgroundColor DarkGreen
            Write-Host "================================" -ForegroundColor Green
            Write-Host ""
            exit 0
        }
        
        if ($status.status -in @("UNHEALTHY", "ERROR")) {
            Write-Host ""
            Write-Host "Deployment failed!" -ForegroundColor Red
            Write-Host "================================" -ForegroundColor Red
            Write-Host "Status: $($status.status)" -ForegroundColor Red
            Write-Host "Message: $($status.message)" -ForegroundColor Yellow
            if ($status.public_url) {
                Write-Host "URL: $($status.public_url)" -ForegroundColor Gray
            }
            Write-Host "================================" -ForegroundColor Red
            Write-Host ""
            exit 1
        }
        
        # Show progress indicator
        Write-Host "  Waiting for deployment to complete..." -ForegroundColor Yellow
        Write-Host ""
        
    } catch {
        Write-Host "  Error checking status: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Retrying in $IntervalSeconds seconds..." -ForegroundColor Yellow
        Write-Host ""
    }
    
    if ((Get-Date) -lt $endTime) {
        Start-Sleep -Seconds $IntervalSeconds
    }
}

Write-Host ""
Write-Host "Maximum wait time exceeded." -ForegroundColor Yellow
Write-Host "Waited for $MaxWaitMinutes minutes. Deployment may still be in progress." -ForegroundColor Yellow
Write-Host "Check manually using: .\check-deployment.ps1" -ForegroundColor Gray
Write-Host "Or check the deployment portal for status updates." -ForegroundColor Gray
exit 2
