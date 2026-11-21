param(
    [string]$LanIp = "",
    [string]$Password = ""
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ServerCertDir = Join-Path $Root "server/certificates"
$ClientCertDir = Join-Path $Root "client/certificates"
New-Item -ItemType Directory -Force -Path $ServerCertDir, $ClientCertDir | Out-Null
if ([string]::IsNullOrWhiteSpace($Password)) {
    $Secure = Read-Host "Nhap mat khau keystore (toi thieu 12 ky tu)" -AsSecureString
    $Ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr) }
}
if ($Password.Length -lt 12) { throw "Mat khau keystore phai co it nhat 12 ky tu." }
$Keytool = "keytool"
$San = "dns:localhost,ip:127.0.0.1"
if (-not [string]::IsNullOrWhiteSpace($LanIp)) { $San += ",ip:$LanIp" }
$P12 = Join-Path $ServerCertDir "server.p12"
$Crt = Join-Path $ServerCertDir "server.crt"
$ClientCrt = Join-Path $ClientCertDir "server.crt"
if (Test-Path $P12) { Remove-Item $P12 -Force }
if (Test-Path $Crt) { Remove-Item $Crt -Force }
& $Keytool -genkeypair -alias chatserver -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 365 `
    -storetype PKCS12 -keystore $P12 -storepass $Password -keypass $Password `
    -dname "CN=localhost, OU=SecureTcpChat, O=LearningProject, L=HoChiMinhCity, ST=HoChiMinhCity, C=VN" `
    -ext "SAN=$San"
if ($LASTEXITCODE -ne 0) { throw "Tao keystore that bai." }
& $Keytool -exportcert -alias chatserver -keystore $P12 -storetype PKCS12 `
    -storepass $Password -file $Crt -rfc
if ($LASTEXITCODE -ne 0) { throw "Xuat public certificate that bai." }
Copy-Item $Crt $ClientCrt -Force
Write-Host "Da tao server.p12 (chi Server) va server.crt (Server + Client)." -ForegroundColor Green
Write-Host "SAN: $San"
Write-Host "Luu mat khau nay vao bien moi truong CHAT_KEYSTORE_PASSWORD truoc khi chay Server."
Write-Host "Khong gui server.p12 cho Client va khong commit server.p12 len Git."
