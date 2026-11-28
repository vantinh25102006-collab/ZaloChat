# Script kiểm tra cú pháp JS và đồng bộ static files sang target/classes/static
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))

Write-Host "[1/2] Kiểm tra cú pháp static/app.js..." -ForegroundColor Cyan
node --check "$ProjectRoot\static\app.js"

Write-Host "[2/2] Đồng bộ static/app.js và static/index.html sang target/classes/static/..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$ProjectRoot\target\classes\static" | Out-Null
Copy-Item -Force "$ProjectRoot\static\app.js" "$ProjectRoot\target\classes\static\app.js"
Copy-Item -Force "$ProjectRoot\static\index.html" "$ProjectRoot\target\classes\static\index.html"

Write-Host "Hoàn tất đồng bộ Frontend thành công!" -ForegroundColor Green

