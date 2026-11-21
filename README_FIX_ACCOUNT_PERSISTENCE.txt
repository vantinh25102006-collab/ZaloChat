SECURE TCP CHAT - FULL PROJECT (ACCOUNT PERSISTENCE FIX)

This archive is the complete project. Extract the folder SecureTcpChat, then open a terminal in that folder (the same folder that contains pom.xml).

1) Verify that the account persistence source is present:
   Select-String -Path .\server\UserStore.java -Pattern "File tài khoản"
   It should print a line containing: [UserStore] File tài khoản

2) Build from source:
   mvn clean compile

3) Run:
   mvn spring-boot:run

4) On startup, the console prints the absolute path to data\users.json.
   After successful registration, it prints the number of saved accounts.
   The data\users.json file is created in the project working directory (unless CHAT_USERS_FILE or -Dchat.users.file overrides it).

5) Stop and restart the app. Registered accounts remain in data\users.json. This persists registered accounts only; it does not keep users logged in.

Web: http://localhost:8080
TCP/TLS: port 5000

Do not copy only individual files from this archive. Use this complete project folder so source files and configuration stay together.

Note: This archive has not been built in the user's Windows environment. Run the commands above and check the console output. Keep a backup of data\users.json.
