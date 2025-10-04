# Test Instagram Notification System
# Run this script to test if everything is working

Write-Host "🧪 Testing Instagram Notification System..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Check environment variables
Write-Host "✓ Checking environment variables..." -ForegroundColor Yellow
$envPath = ".env.local"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    
    if ($envContent -match "RESEND_API_KEY=re_") {
        Write-Host "  ✅ RESEND_API_KEY is set" -ForegroundColor Green
    } else {
        Write-Host "  ❌ RESEND_API_KEY not found" -ForegroundColor Red
    }
    
    if ($envContent -match "CRON_SECRET=") {
        Write-Host "  ✅ CRON_SECRET is set" -ForegroundColor Green
    } else {
        Write-Host "  ❌ CRON_SECRET not found" -ForegroundColor Red
    }
    
    if ($envContent -match "NEXT_PUBLIC_BASE_URL=") {
        Write-Host "  ✅ NEXT_PUBLIC_BASE_URL is set" -ForegroundColor Green
    } else {
        Write-Host "  ❌ NEXT_PUBLIC_BASE_URL not found" -ForegroundColor Red
    }
} else {
    Write-Host "  ❌ .env.local file not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "✓ Checking if dev server is running..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "  ✅ Dev server is running on http://localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Dev server is not running. Run 'npm run dev' first" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Checking notification service..." -ForegroundColor Yellow
if (Test-Path "lib/notification-service.ts") {
    Write-Host "  ✅ Notification service file exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ Notification service file not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "✓ Checking cron endpoint..." -ForegroundColor Yellow
if (Test-Path "app/api/instagram/cron/route.ts") {
    Write-Host "  ✅ Cron endpoint exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ Cron endpoint not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "✓ Checking mark-published endpoint..." -ForegroundColor Yellow
if (Test-Path "app/api/instagram/mark-published/route.ts") {
    Write-Host "  ✅ Mark-published endpoint exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ Mark-published endpoint not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ System Check Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Go to http://localhost:3000/dashboard/social-media" -ForegroundColor White
Write-Host "  2. Create a test post" -ForegroundColor White
Write-Host "  3. Set schedule for 2 minutes from now" -ForegroundColor White
Write-Host "  4. Click 'Mark as Scheduled'" -ForegroundColor White
Write-Host "  5. Wait 2 minutes for the email reminder!" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Or manually trigger the cron job now:" -ForegroundColor Cyan
Write-Host "  curl http://localhost:3000/api/instagram/cron -H ""Authorization: Bearer $($envContent -match 'CRON_SECRET=(.+)' | Out-Null; $matches[1].Trim())""" -ForegroundColor Yellow
Write-Host ""
Write-Host "📧 Check your email (the one registered with Clerk) for the reminder!" -ForegroundColor Cyan
Write-Host ""
