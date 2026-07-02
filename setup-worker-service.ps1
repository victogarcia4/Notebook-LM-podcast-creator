# Setup Podcast Worker as Windows background service using PM2
# Run this once to install the worker as a persistent background service

Write-Host "🚀 Setting up Podcast Worker as background service..." -ForegroundColor Cyan

# Check if PM2 is installed globally
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue

if (-not $pm2Installed) {
    Write-Host "📦 Installing PM2 globally..." -ForegroundColor Yellow
    npm install -g pm2
    npm install -g pm2-windows-startup

    Write-Host "🔧 Configuring PM2 to start on Windows boot..." -ForegroundColor Yellow
    pm2-startup install
}

# Stop existing worker if running
Write-Host "🛑 Stopping existing worker (if any)..." -ForegroundColor Yellow
pm2 stop podcast-worker 2>$null
pm2 delete podcast-worker 2>$null

# Start the worker with PM2
Write-Host "▶️ Starting worker with PM2..." -ForegroundColor Green
pm2 start npm --name "podcast-worker" -- run worker

# Save PM2 configuration
Write-Host "💾 Saving PM2 configuration..." -ForegroundColor Green
pm2 save

Write-Host ""
Write-Host "✅ Podcast Worker is now running as a background service!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Useful commands:" -ForegroundColor Cyan
Write-Host "  pm2 status           - Check worker status"
Write-Host "  pm2 logs podcast-worker  - View worker logs"
Write-Host "  pm2 restart podcast-worker  - Restart worker"
Write-Host "  pm2 stop podcast-worker     - Stop worker"
Write-Host "  pm2 start podcast-worker    - Start worker"
Write-Host ""
Write-Host "🔄 The worker will automatically start when Windows boots!" -ForegroundColor Green
