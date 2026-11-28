package webapp.runtime;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.FileTime;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Máy chủ FTP tích hợp (RFC 959) chạy tại cổng 2121.
 * - Phục vụ thư mục gốc: uploads/
 * - Hỗ trợ các lệnh FTP chuẩn: USER, PASS, SYST, FEAT, OPTS, PWD, CWD, CDUP,
 *   TYPE, PASV, EPSV, PORT, LIST, NLST, STOR, RETR, DELE, MKD, SIZE, NOOP, QUIT.
 * - Đi kèm FTP Client nội bộ để FileController truyền tải (STOR / RETR / DELE)
 *   qua giao thức FTP trên cổng 2121, đồng thời tương thích với FileZilla / Windows Explorer (ftp://localhost:2121).
 */
public class EmbeddedFtpServer {

    public static final int DEFAULT_FTP_PORT = 2121;
    public static final String DEFAULT_FTP_USER = "zchat";
    public static final String DEFAULT_FTP_PASS = "zchat2121";

    private final int port;
    private final Path rootDir;
    private final ExecutorService clientPool = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "ftp-worker-2121");
        t.setDaemon(true);
        return t;
    });

    private volatile boolean running = false;
    private ServerSocket serverSocket;

    public EmbeddedFtpServer() {
        this(DEFAULT_FTP_PORT, Path.of("uploads"));
    }

    public EmbeddedFtpServer(int port, Path rootDir) {
        this.port = port;
        this.rootDir = rootDir.toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootDir);
        } catch (IOException ignored) {
        }
        startServer();
    }

    public synchronized void startServer() {
        if (running) return;
        try {
            serverSocket = new ServerSocket();
            serverSocket.setReuseAddress(true);
            serverSocket.bind(new InetSocketAddress("0.0.0.0", port));
            running = true;

            Thread acceptThread = new Thread(this::acceptLoop, "ftp-server-acceptor-" + port);
            acceptThread.setDaemon(true);
            acceptThread.start();
            System.out.println("[FTP-Server] Đã khởi chạy FTP Server tại cổng " + port
                    + " (Thư mục gốc: " + rootDir + " | URL: ftp://localhost:" + port + ")");
        } catch (BindException be) {
            System.out.println("[FTP-Server] Cổng " + port + " đã có FTP Server đang lắng nghe, tái sử dụng kết nối FTP hiện có.");
        } catch (IOException e) {
            System.err.println("[FTP-Server] Không thể khởi động FTP Server trên cổng " + port + ": " + e.getMessage());
        }
    }

    private void acceptLoop() {
        while (running && serverSocket != null && !serverSocket.isClosed()) {
            try {
                Socket client = serverSocket.accept();
                client.setSoTimeout(60_000);
                clientPool.submit(new FtpClientHandler(client, rootDir));
            } catch (IOException e) {
                if (running) {
                    System.err.println("[FTP-Server] Lỗi nhận kết nối FTP: " + e.getMessage());
                }
            }
        }
    }

    public int getPort() {
        return port;
    }

    public Path getRootDir() {
        return rootDir;
    }

    public boolean isRunning() {
        return running;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FTP CLIENT NỘI BỘ (Giao tiếp trực tiếp với FTP Server cổng 2121)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Tải file lên FTP Server cổng 2121 bằng lệnh FTP chuẩn (USER -> PASS -> TYPE I -> MKD/CWD -> PASV -> STOR).
     *
     * @param subDir   Thư mục con bên trong uploads (ví dụ: "dm_an_tinh", "group_123", "avatars" hoặc "" nếu ở gốc)
     * @param filename Tên file lưu trữ trên FTP Server
     * @param data     Nội dung byte của file
     * @return true nếu truyền qua FTP Server thành công
     */
    public boolean uploadViaFtp(String subDir, String filename, byte[] data) {
        try (FtpMiniClient client = new FtpMiniClient("127.0.0.1", port)) {
            client.login(DEFAULT_FTP_USER, DEFAULT_FTP_PASS);
            client.setBinaryMode();
            if (subDir != null && !subDir.isBlank()) {
                for (String part : subDir.replace('\\', '/').split("/")) {
                    if (part.isBlank()) continue;
                    client.makeDir(part);
                    client.changeDir(part);
                }
            }
            client.storeFile(filename, data);
            System.out.println("[FTP-Client -> 127.0.0.1:" + port + "] STOR thành công: "
                    + (subDir != null && !subDir.isBlank() ? subDir + "/" : "") + filename
                    + " (" + data.length + " bytes)");
            return true;
        } catch (Exception e) {
            System.err.println("[FTP-Client] Lỗi upload qua FTP cổng " + port + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Tải file từ FTP Server cổng 2121 bằng lệnh FTP chuẩn (USER -> PASS -> TYPE I -> PASV -> RETR).
     *
     * @param relativePath Đường dẫn tương đối so với thư mục uploads/ (ví dụ: "dm_an_tinh/uuid.docx")
     * @return Mảng byte của file, hoặc null nếu không lấy được qua FTP
     */
    public byte[] downloadViaFtp(String relativePath) {
        String cleanRel = normalizeRelativePath(relativePath);
        if (cleanRel == null || cleanRel.isBlank()) return null;
        try (FtpMiniClient client = new FtpMiniClient("127.0.0.1", port)) {
            client.login(DEFAULT_FTP_USER, DEFAULT_FTP_PASS);
            client.setBinaryMode();
            byte[] bytes = client.retrieveFile(cleanRel);
            if (bytes != null) {
                System.out.println("[FTP-Client -> 127.0.0.1:" + port + "] RETR thành công: "
                        + cleanRel + " (" + bytes.length + " bytes)");
            }
            return bytes;
        } catch (Exception e) {
            System.err.println("[FTP-Client] Lỗi download qua FTP cổng " + port + ": " + e.getMessage());
            return null;
        }
    }

    /**
     * Xóa file trên FTP Server cổng 2121 bằng lệnh FTP DELE.
     */
    public boolean deleteViaFtp(String relativePath) {
        String cleanRel = normalizeRelativePath(relativePath);
        if (cleanRel == null || cleanRel.isBlank()) return false;
        try (FtpMiniClient client = new FtpMiniClient("127.0.0.1", port)) {
            client.login(DEFAULT_FTP_USER, DEFAULT_FTP_PASS);
            boolean ok = client.deleteFile(cleanRel);
            if (ok) {
                System.out.println("[FTP-Client -> 127.0.0.1:" + port + "] DELE thành công: " + cleanRel);
            }
            return ok;
        } catch (Exception e) {
            return false;
        }
    }

    public String toRelativeFtpPath(Path path) {
        if (path == null) return null;
        Path abs = path.toAbsolutePath().normalize();
        if (abs.startsWith(rootDir)) {
            return rootDir.relativize(abs).toString().replace('\\', '/');
        }
        return normalizeRelativePath(path.toString());
    }

    private String normalizeRelativePath(String rawPath) {
        if (rawPath == null) return null;
        String p = rawPath.replace('\\', '/').strip();
        if (p.startsWith("uploads/")) {
            p = p.substring("uploads/".length());
        }
        while (p.startsWith("/")) p = p.substring(1);
        return p;
    }

    public synchronized void shutdown() {
        running = false;
        if (serverSocket != null) {
            try { serverSocket.close(); } catch (IOException ignored) {}
        }
        clientPool.shutdownNow();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // XỬ LÝ PHIÊN KẾT NỐI FTP (RFC 959 Control & Data Connection)
    // ═══════════════════════════════════════════════════════════════════════

    private static class FtpClientHandler implements Runnable {
        private final Socket controlSocket;
        private final Path rootDir;
        private Path currentDir;
        private BufferedReader reader;
        private PrintWriter writer;

        private String pendingUser = null;
        private boolean authenticated = false;
        private ServerSocket passiveServer = null;
        private InetSocketAddress activeTarget = null;

        FtpClientHandler(Socket controlSocket, Path rootDir) {
            this.controlSocket = controlSocket;
            this.rootDir = rootDir;
            this.currentDir = rootDir;
        }

        @Override
        public void run() {
            try {
                reader = new BufferedReader(new InputStreamReader(controlSocket.getInputStream(), StandardCharsets.UTF_8));
                writer = new PrintWriter(new OutputStreamWriter(controlSocket.getOutputStream(), StandardCharsets.UTF_8), true);

                reply(220, "ZChat Embedded FTP Server (Port 2121) Ready.");

                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.strip();
                    if (line.isEmpty()) continue;

                    int sp = line.indexOf(' ');
                    String cmd = (sp >= 0 ? line.substring(0, sp) : line).toUpperCase(Locale.ROOT);
                    String arg = sp >= 0 ? line.substring(sp + 1).strip() : "";

                    if (!handleCommand(cmd, arg)) {
                        break;
                    }
                }
            } catch (IOException ignored) {
            } finally {
                closePassiveServer();
                try { controlSocket.close(); } catch (IOException ignored) {}
            }
        }

        private boolean handleCommand(String cmd, String arg) throws IOException {
            switch (cmd) {
                case "USER" -> {
                    pendingUser = arg.isBlank() ? "anonymous" : arg;
                    reply(331, "User name okay, need password for " + pendingUser + ".");
                }
                case "PASS" -> {
                    if (pendingUser == null) {
                        reply(503, "Login with USER first.");
                    } else {
                        authenticated = true;
                        reply(230, "User " + pendingUser + " logged in, proceed.");
                    }
                }
                case "SYST" -> reply(215, "UNIX Type: L8");
                case "FEAT" -> {
                    writer.print("211-Features:\r\n");
                    writer.print(" UTF8\r\n");
                    writer.print(" PASV\r\n");
                    writer.print(" EPSV\r\n");
                    writer.print(" SIZE\r\n");
                    writer.print("211 End\r\n");
                    writer.flush();
                }
                case "OPTS" -> reply(200, "OPTS UTF8 ON ok.");
                case "NOOP" -> reply(200, "NOOP ok.");
                case "TYPE" -> reply(200, "Type set to " + (arg.isEmpty() ? "I" : arg) + ".");
                case "PWD", "XPWD" -> {
                    if (!checkAuth()) return true;
                    String rel = "/" + rootDir.relativize(currentDir).toString().replace('\\', '/');
                    if (rel.endsWith("/") && rel.length() > 1) rel = rel.substring(0, rel.length() - 1);
                    reply(257, "\"" + rel + "\" is current directory.");
                }
                case "CDUP", "XCUP" -> {
                    if (!checkAuth()) return true;
                    if (currentDir.getParent() != null && currentDir.getParent().startsWith(rootDir)) {
                        currentDir = currentDir.getParent();
                    } else {
                        currentDir = rootDir;
                    }
                    reply(250, "CDUP command successful.");
                }
                case "CWD", "XCWD" -> {
                    if (!checkAuth()) return true;
                    Path target = resolveSafePath(arg);
                    if (target != null && Files.isDirectory(target)) {
                        currentDir = target;
                        reply(250, "Directory successfully changed.");
                    } else {
                        reply(550, "Failed to change directory.");
                    }
                }
                case "MKD", "XMKD" -> {
                    if (!checkAuth()) return true;
                    Path target = resolveSafePath(arg);
                    if (target == null) {
                        reply(550, "Invalid directory path.");
                    } else {
                        try {
                            Files.createDirectories(target);
                            reply(257, "\"" + arg + "\" directory created.");
                        } catch (IOException e) {
                            reply(550, "Could not create directory.");
                        }
                    }
                }
                case "SIZE" -> {
                    if (!checkAuth()) return true;
                    Path target = resolveSafePath(arg);
                    if (target != null && Files.isRegularFile(target)) {
                        reply(213, String.valueOf(Files.size(target)));
                    } else {
                        reply(550, "Could not get file size.");
                    }
                }
                case "PASV" -> {
                    if (!checkAuth()) return true;
                    closePassiveServer();
                    passiveServer = new ServerSocket(0, 5, controlSocket.getLocalAddress());
                    passiveServer.setSoTimeout(30_000);
                    byte[] addr = controlSocket.getLocalAddress().getAddress();
                    if (addr.length != 4) addr = new byte[]{127, 0, 0, 1};
                    int p = passiveServer.getLocalPort();
                    int p1 = (p >> 8) & 0xFF;
                    int p2 = p & 0xFF;
                    reply(227, String.format("Entering Passive Mode (%d,%d,%d,%d,%d,%d).",
                            addr[0] & 0xFF, addr[1] & 0xFF, addr[2] & 0xFF, addr[3] & 0xFF, p1, p2));
                }
                case "EPSV" -> {
                    if (!checkAuth()) return true;
                    closePassiveServer();
                    passiveServer = new ServerSocket(0, 5, controlSocket.getLocalAddress());
                    passiveServer.setSoTimeout(30_000);
                    reply(229, "Entering Extended Passive Mode (|||" + passiveServer.getLocalPort() + "|).");
                }
                case "PORT" -> {
                    if (!checkAuth()) return true;
                    closePassiveServer();
                    String[] parts = arg.split(",");
                    if (parts.length == 6) {
                        String host = parts[0] + "." + parts[1] + "." + parts[2] + "." + parts[3];
                        int p = (Integer.parseInt(parts[4]) << 8) + Integer.parseInt(parts[5]);
                        activeTarget = new InetSocketAddress(host, p);
                        reply(200, "PORT command successful.");
                    } else {
                        reply(501, "Syntax error in parameters.");
                    }
                }
                case "LIST", "NLST" -> {
                    if (!checkAuth()) return true;
                    Path listTarget = (arg.isBlank() || arg.startsWith("-")) ? currentDir : resolveSafePath(arg);
                    if (listTarget == null || !Files.exists(listTarget)) {
                        reply(550, "Path not found.");
                        return true;
                    }
                    reply(150, "Opening data connection for directory list.");
                    try (Socket dataSocket = openDataSocket();
                         PrintWriter dataOut = new PrintWriter(new OutputStreamWriter(dataSocket.getOutputStream(), StandardCharsets.UTF_8), true)) {
                        SimpleDateFormat df = new SimpleDateFormat("MMM dd HH:mm", Locale.US);
                        try (var stream = Files.list(listTarget)) {
                            for (Path entry : stream.toList()) {
                                String name = entry.getFileName().toString();
                                if ("NLST".equals(cmd)) {
                                    dataOut.print(name + "\r\n");
                                } else {
                                    boolean isDir = Files.isDirectory(entry);
                                    long sz = isDir ? 0L : Files.size(entry);
                                    FileTime ft = Files.getLastModifiedTime(entry);
                                    String perms = isDir ? "drwxr-xr-x" : "-rw-r--r--";
                                    dataOut.printf("%s 1 zchat zchat %10d %s %s\r\n",
                                            perms, sz, df.format(new Date(ft.toMillis())), name);
                                }
                            }
                        }
                        dataOut.flush();
                        reply(226, "Transfer complete.");
                    } catch (IOException e) {
                        reply(425, "Can't open data connection.");
                    } finally {
                        closePassiveServer();
                    }
                }
                case "STOR" -> {
                    if (!checkAuth()) return true;
                    Path target = resolveSafePath(arg);
                    if (target == null) {
                        reply(550, "Invalid file path.");
                        return true;
                    }
                    Files.createDirectories(target.getParent());
                    reply(150, "Opening binary mode data connection for " + arg);
                    try (Socket dataSocket = openDataSocket();
                         InputStream in = dataSocket.getInputStream();
                         OutputStream out = Files.newOutputStream(target, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
                        in.transferTo(out);
                        reply(226, "Transfer complete.");
                    } catch (IOException e) {
                        reply(426, "Data transfer failed: " + e.getMessage());
                    } finally {
                        closePassiveServer();
                    }
                }
                case "RETR" -> {
                    if (!checkAuth()) return true;
                    Path target = resolveSafePath(arg);
                    if (target == null || !Files.isRegularFile(target)) {
                        reply(550, "File not found.");
                        return true;
                    }
                    reply(150, "Opening binary mode data connection for " + arg + " (" + Files.size(target) + " bytes).");
                    try (Socket dataSocket = openDataSocket();
                         InputStream in = Files.newInputStream(target);
                         OutputStream out = dataSocket.getOutputStream()) {
                        in.transferTo(out);
                        out.flush();
                        reply(226, "Transfer complete.");
                    } catch (IOException e) {
                        reply(426, "Data transfer failed: " + e.getMessage());
                    } finally {
                        closePassiveServer();
                    }
                }
                case "DELE" -> {
                    if (!checkAuth()) return true;
                    Path target = resolveSafePath(arg);
                    if (target != null && Files.exists(target) && Files.isRegularFile(target)) {
                        Files.deleteIfExists(target);
                        reply(250, "File deleted successfully.");
                    } else {
                        reply(550, "File not found.");
                    }
                }
                case "QUIT" -> {
                    reply(221, "Goodbye.");
                    return false;
                }
                default -> reply(502, "Command not implemented: " + cmd);
            }
            return true;
        }

        private boolean checkAuth() {
            if (!authenticated) {
                reply(530, "Please login with USER and PASS.");
                return false;
            }
            return true;
        }

        private Path resolveSafePath(String arg) {
            if (arg == null || arg.isBlank()) return currentDir;
            String cleaned = arg.replace('\\', '/').strip();
            Path base = cleaned.startsWith("/") ? rootDir : currentDir;
            while (cleaned.startsWith("/")) cleaned = cleaned.substring(1);
            Path resolved = base.resolve(cleaned).toAbsolutePath().normalize();
            return resolved.startsWith(rootDir) ? resolved : null;
        }

        private Socket openDataSocket() throws IOException {
            if (passiveServer != null) {
                return passiveServer.accept();
            }
            if (activeTarget != null) {
                Socket s = new Socket();
                s.connect(activeTarget, 15_000);
                activeTarget = null;
                return s;
            }
            throw new IOException("No PASV or PORT data connection configured.");
        }

        private void closePassiveServer() {
            if (passiveServer != null) {
                try { passiveServer.close(); } catch (IOException ignored) {}
                passiveServer = null;
            }
        }

        private void reply(int code, String message) {
            writer.print(code + " " + message + "\r\n");
            writer.flush();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MINI FTP CLIENT (Kết nối tới cổng 2121 theo giao thức RFC 959)
    // ═══════════════════════════════════════════════════════════════════════

    private static class FtpMiniClient implements Closeable {
        private final Socket control;
        private final BufferedReader reader;
        private final PrintWriter writer;

        FtpMiniClient(String host, int port) throws IOException {
            this.control = new Socket();
            this.control.connect(new InetSocketAddress(host, port), 5000);
            this.control.setSoTimeout(15000);
            this.reader = new BufferedReader(new InputStreamReader(control.getInputStream(), StandardCharsets.UTF_8));
            this.writer = new PrintWriter(new OutputStreamWriter(control.getOutputStream(), StandardCharsets.UTF_8), true);
            readResponse(); // 220 Greeting
        }

        void login(String user, String pass) throws IOException {
            sendCommand("USER " + user);
            String r = sendCommand("PASS " + pass);
            if (!r.startsWith("230")) {
                throw new IOException("FTP login failed: " + r);
            }
        }

        void setBinaryMode() throws IOException {
            sendCommand("TYPE I");
        }

        void makeDir(String dir) throws IOException {
            sendCommand("MKD " + dir);
        }

        void changeDir(String dir) throws IOException {
            String r = sendCommand("CWD " + dir);
            if (!r.startsWith("250")) {
                throw new IOException("FTP CWD failed: " + r);
            }
        }

        void storeFile(String filename, byte[] data) throws IOException {
            int dataPort = enterExtendedPassiveMode();
            try (Socket dataSocket = new Socket("127.0.0.1", dataPort)) {
                String r = sendCommand("STOR " + filename);
                if (!r.startsWith("150") && !r.startsWith("125")) {
                    throw new IOException("FTP STOR rejected: " + r);
                }
                OutputStream out = dataSocket.getOutputStream();
                out.write(data);
                out.flush();
            }
            String done = readResponse();
            if (!done.startsWith("226")) {
                throw new IOException("FTP STOR did not complete: " + done);
            }
        }

        byte[] retrieveFile(String path) throws IOException {
            int dataPort = enterExtendedPassiveMode();
            byte[] result;
            try (Socket dataSocket = new Socket("127.0.0.1", dataPort)) {
                String r = sendCommand("RETR " + path);
                if (!r.startsWith("150") && !r.startsWith("125")) {
                    return null;
                }
                result = dataSocket.getInputStream().readAllBytes();
            }
            String done = readResponse();
            return done.startsWith("226") ? result : null;
        }

        boolean deleteFile(String path) throws IOException {
            String r = sendCommand("DELE " + path);
            return r.startsWith("250");
        }

        private int enterExtendedPassiveMode() throws IOException {
            String r = sendCommand("EPSV");
            // 229 Entering Extended Passive Mode (|||port|).
            int start = r.indexOf("|||");
            int end = r.indexOf("|)", start + 3);
            if (start >= 0 && end > start) {
                return Integer.parseInt(r.substring(start + 3, end));
            }
            throw new IOException("Failed to parse EPSV response: " + r);
        }

        private String sendCommand(String cmd) throws IOException {
            writer.print(cmd + "\r\n");
            writer.flush();
            return readResponse();
        }

        private String readResponse() throws IOException {
            String first = reader.readLine();
            if (first == null) throw new EOFException("FTP connection closed.");
            if (first.length() >= 4 && first.charAt(3) == '-') {
                String code = first.substring(0, 3);
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith(code + " ")) return line;
                }
            }
            return first;
        }

        @Override
        public void close() {
            try {
                writer.print("QUIT\r\n");
                writer.flush();
            } catch (Exception ignored) {}
            try { control.close(); } catch (IOException ignored) {}
        }
    }

    /** Cho phép chạy độc lập FTP Server trên cổng 2121 khi cần. */
    public static void main(String[] args) throws InterruptedException {
        int p = args.length > 0 ? Integer.parseInt(args[0]) : DEFAULT_FTP_PORT;
        EmbeddedFtpServer server = new EmbeddedFtpServer(p, Path.of("uploads"));
        while (server.isRunning()) {
            Thread.sleep(60_000L);
        }
    }
}

