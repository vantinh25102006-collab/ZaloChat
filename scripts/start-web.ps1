#!/usr/bin/env pwsh
# ============================================================
# start-web.ps1 - Khởi động ZChat Web Server
# Sử dụng: .\scripts\start-web.ps1
#          .\scripts\start-web.ps1 -Port 8080 -KeystorePass "yourpass"
# ============================================================

param(
    [int]$Port = 8080,
    [string]$KeystorePass = ""
)

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ZChat Web Server - Khởi động" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Kiểm tra Java
$java = Get-Command java -ErrorAction SilentlyContinue
if (-not $java) {
    Write-Host "LỖI: Không tìm thấy Java. Hãy cài Java 17+." -ForegroundColor Red
    exit 1
}
$javaVersion = java -version 2>&1 | Select-String "version"
Write-Host "Java: $javaVersion" -ForegroundColor Green

# Kiểm tra Maven
$mvn = Get-Command mvn -ErrorAction SilentlyContinue
if (-not $mvn) {
    Write-Host "LỖI: Không tìm thấy Maven." -ForegroundColor Red
    exit 1
}

# Build
Write-Host "`nBuilding..." -ForegroundColor Yellow
mvn package -DskipTests -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "LỖI: Build thất bại." -ForegroundColor Red
    exit 1
}
Write-Host "Build thành công!" -ForegroundColor Green

# Tạo thư mục uploads
New-Item -ItemType Directory -Force -Path "$RootDir\uploads" | Out-Null

# Set env
if ($KeystorePass) {
    $env:CHAT_KEYSTORE_PASSWORD = $KeystorePass
}
if ([string]::IsNullOrWhiteSpace($env:CHAT_KEYSTORE_PASSWORD)) {
    $secure = Read-Host "Nhap CHAT_KEYSTORE_PASSWORD (mat khau da tao server.p12)"
    if ([string]::IsNullOrWhiteSpace($secure)) {
        Write-Host "LOI: Can mat khau keystore de khoi dong TCP/TLS Server." -ForegroundColor Red
        exit 1
    }
    $env:CHAT_KEYSTORE_PASSWORD = $secure
}
if (-not (Test-Path "$RootDir\server\certificates\server.p12")) {
    Write-Host "LOI: Khong tim thay server/certificates/server.p12. Hay chay generate-certificate.ps1 truoc." -ForegroundColor Red
    exit 1
}

Write-Host "`nKhởi động Web + TCP/TLS Server (Web :$Port, TCP :5000)" -ForegroundColor Cyan
Write-Host "Nhấn Ctrl+C để dừng`n" -ForegroundColor Gray

# Chạy jar
$jar = Get-ChildItem "$RootDir\target\*.jar" | Where-Object { $_.Name -notlike "*sources*" } | Select-Object -First 1
if (-not $jar) {
    Write-Host "LỖI: Không tìm thấy file JAR trong target/" -ForegroundColor Red
    exit 1
}

java -jar $jar.FullName --server.port=$Port

