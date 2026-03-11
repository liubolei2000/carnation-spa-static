# Carnation Spa - Pack for Raspberry Pi 5
# Run: powershell -ExecutionPolicy Bypass -File pack-for-pi.ps1

$ProjectName = "carnation-spa"
$ParentDir   = Split-Path -Parent (Get-Location)
$OutputZip   = Join-Path $ParentDir "${ProjectName}-pi.zip"

Write-Host ""
Write-Host "========================================"
Write-Host " Carnation Spa - Pack for Raspberry Pi"
Write-Host "========================================"
Write-Host ""

if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: Run this script from the project root directory!" -ForegroundColor Red
    exit 1
}

if (Test-Path $OutputZip) {
    Remove-Item $OutputZip -Force
    Write-Host "Removed old zip file." -ForegroundColor Yellow
}

# Directories/files to exclude from the package
$ExcludeDirs  = @("node_modules", ".next", ".git", "carnation-uploads")
$ExcludeFiles = @(".env.local", ".env", ".env.production", ".env.development")

$SourcePath = (Get-Location).Path
$TempRoot   = Join-Path $env:TEMP "carnation-pack-$(Get-Random)"
$TempDest   = Join-Path $TempRoot $ProjectName

Write-Host "Copying files (excluding node_modules / .next / .env* ..." -ForegroundColor Cyan

New-Item -ItemType Directory -Path $TempDest -Force | Out-Null

Get-ChildItem -Path $SourcePath | ForEach-Object {
    $item = $_
    $name = $item.Name

    if ($item.PSIsContainer -and $ExcludeDirs -contains $name) {
        Write-Host "  skip: $name/" -ForegroundColor DarkGray
        return
    }
    if (-not $item.PSIsContainer -and $ExcludeFiles -contains $name) {
        Write-Host "  skip: $name" -ForegroundColor DarkGray
        return
    }
    if (-not $item.PSIsContainer -and $name -match '^\.(env)') {
        Write-Host "  skip: $name" -ForegroundColor DarkGray
        return
    }

    $dest = Join-Path $TempDest $name
    if ($item.PSIsContainer) {
        Copy-Item -Path $item.FullName -Destination $dest -Recurse -Force
    } else {
        Copy-Item -Path $item.FullName -Destination $dest -Force
    }
}

Write-Host "Compressing..." -ForegroundColor Cyan
Compress-Archive -Path $TempDest -DestinationPath $OutputZip -CompressionLevel Optimal

Remove-Item $TempRoot -Recurse -Force

$ZipSize = [math]::Round((Get-Item $OutputZip).Length / 1MB, 1)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Done! Package created." -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "  File: $OutputZip"
Write-Host "  Size: ${ZipSize} MB"
Write-Host ""
Write-Host "--- How to deploy to Raspberry Pi ---"
Write-Host ""
Write-Host "Option 1: USB Drive"
Write-Host "  Copy carnation-spa-pi.zip to USB, plug into Pi, then:"
Write-Host "    unzip /media/pi/<USB_NAME>/carnation-spa-pi.zip -d /home/pi/"
Write-Host "    cd /home/pi/carnation-spa"
Write-Host "    bash deploy.sh"
Write-Host ""
Write-Host "Option 2: SCP (replace 192.168.1.100 with your Pi's IP)"
Write-Host "  On this PC (PowerShell):"
Write-Host "    scp ""$OutputZip"" pi@192.168.1.100:/home/pi/"
Write-Host "  On Pi (SSH):"
Write-Host "    cd /home/pi"
Write-Host "    unzip carnation-spa-pi.zip"
Write-Host "    cd carnation-spa"
Write-Host "    bash deploy.sh"
Write-Host ""
Write-Host "deploy.sh will automatically:"
Write-Host "  - Install Node.js 20, PostgreSQL, PM2"
Write-Host "  - Create database, generate secrets"
Write-Host "  - Ask for Twilio credentials and domain"
Write-Host "  - Run npm install, prisma migrate, npm build"
Write-Host "  - Set up PM2 process with auto-restart"
Write-Host "  - Install cloudflared (Cloudflare Tunnel)"
Write-Host ""
