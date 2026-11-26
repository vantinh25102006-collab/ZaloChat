@echo off
setlocal

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "CERT_DIR=%ROOT%\server\certificates"
set "CLIENT_CERT_DIR=%ROOT%\client\certificates"

if not defined CHAT_KEYSTORE_PASSWORD (
  echo ERROR: Set CHAT_KEYSTORE_PASSWORD in this CMD session first.
  exit /b 1
)

where keytool >nul 2>nul
if errorlevel 1 (
  echo ERROR: keytool was not found. Add the JDK bin folder to PATH.
  exit /b 1
)

if not exist "%CERT_DIR%" mkdir "%CERT_DIR%"
if not exist "%CLIENT_CERT_DIR%" mkdir "%CLIENT_CERT_DIR%"

if exist "%CERT_DIR%\server.p12" (
  echo ERROR: server.p12 already exists. Keep it, or remove it manually before regenerating.
  exit /b 1
)

keytool -genkeypair -alias chatserver -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 365 -storetype PKCS12 -keystore "%CERT_DIR%\server.p12" -storepass:env CHAT_KEYSTORE_PASSWORD -keypass:env CHAT_KEYSTORE_PASSWORD -dname "CN=localhost, OU=SecureTcpChat, O=LearningProject, L=HoChiMinhCity, ST=HoChiMinhCity, C=VN" -ext "SAN=dns:localhost,ip:127.0.0.1" -noprompt
if errorlevel 1 exit /b 1

keytool -exportcert -alias chatserver -keystore "%CERT_DIR%\server.p12" -storetype PKCS12 -storepass:env CHAT_KEYSTORE_PASSWORD -file "%CERT_DIR%\server.crt" -rfc
if errorlevel 1 exit /b 1

copy /Y "%CERT_DIR%\server.crt" "%CLIENT_CERT_DIR%\server.crt" >nul
if errorlevel 1 exit /b 1

echo TLS certificates created. Do not commit server.p12 or the keystore password.
endlocal
