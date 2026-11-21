package server;

import model.ChatMessage;
import model.MessageType;
import webapp.runtime.ChatMessageBus;
import webapp.runtime.ChatPresenceRegistry;

import javax.net.ssl.*;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.SocketException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** SSL/TLS TCP server; một ClientSession chạy trong một worker riêng. */
public class ChatServer {
    public static final int DEFAULT_PORT = 5000;
    private static final int HANDSHAKE_TIMEOUT_MS = 10_000;
    private static final String KEYSTORE_PATH = "server/certificates/server.p12";

    private final int port;
    private final String keyStorePassword;
    private final UserStore userStore;
    private final ChatMessageBus messageBus;
    private final ChatPresenceRegistry presence;
    private final ConcurrentHashMap<Integer, ClientSession> clients = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Integer> onlineUsers = new ConcurrentHashMap<>();
    private final AtomicInteger nextClientId = new AtomicInteger(0);
    private final ExecutorService workers = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "chat-client-worker");
        t.setDaemon(false);
        return t;
    });
    private volatile SSLServerSocket serverSocket;
    private volatile boolean running;

    public ChatServer(int port, String keyStorePassword) {
        this(port, keyStorePassword, new UserStore(), new ChatMessageBus(), new ChatPresenceRegistry());
    }

    public ChatServer(int port, String keyStorePassword, UserStore userStore,
                      ChatMessageBus messageBus, ChatPresenceRegistry presence) {
        this.port = port;
        this.keyStorePassword = keyStorePassword;
        this.userStore = userStore;
        this.messageBus = messageBus;
        this.presence = presence;
        this.messageBus.subscribe(this::broadcastToTcpClients);
    }

    private SSLContext createSSLContext() throws Exception {
        Path path = Path.of(KEYSTORE_PATH);
        if (!Files.isRegularFile(path)) {
            throw new IllegalStateException("Không tìm thấy " + path.toAbsolutePath()
                    + ". Hãy chạy scripts\\generate-certificate.ps1 trước.");
        }
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(path.toFile())) {
            keyStore.load(in, keyStorePassword.toCharArray());
        }
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(keyStore, keyStorePassword.toCharArray());
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(kmf.getKeyManagers(), null, null);
        return context;
    }

    public void start() throws Exception {
        SSLContext context = createSSLContext();
        SSLServerSocketFactory factory = context.getServerSocketFactory();
        serverSocket = (SSLServerSocket) factory.createServerSocket(port, 100);
        serverSocket.setReuseAddress(true);
        serverSocket.setEnabledProtocols(new String[]{"TLSv1.3", "TLSv1.2"});
        serverSocket.setNeedClientAuth(false); // TLS một chiều: Client xác thực chứng chỉ Server.
        running = true;
        System.out.println("========================================");
        System.out.println(" SECURE TCP CHAT SERVER - TLS");
        System.out.println(" Listening on port " + port);
        System.out.println(" Protocols: TLSv1.3 / TLSv1.2");
        System.out.println("========================================");

        while (running) {
            try {
                SSLSocket socket = (SSLSocket) serverSocket.accept();
                int clientId = nextClientId.incrementAndGet();
                socket.setKeepAlive(true);
                socket.setTcpNoDelay(true);
                socket.setSoTimeout(HANDSHAKE_TIMEOUT_MS);
                System.out.printf("Client %d accepted from %s%n", clientId,
                        socket.getInetAddress().getHostAddress());
                workers.execute(new ClientSession(this, socket, clientId, userStore));
            } catch (SocketException e) {
                if (running) System.err.println("Accept socket error: " + e.getMessage());
            } catch (RejectedExecutionException e) {
                System.err.println("Không thể tạo tác vụ xử lý Client: " + e.getMessage());
            }
        }
    }

    /** Đăng ký đồng thời username và clientId; từ chối username đang online. */
    public boolean register(ClientSession session, String username) {
        if (!presence.login(username)) return false;
        Integer previous = onlineUsers.putIfAbsent(username, session.getClientId());
        if (previous != null) { presence.logout(username); return false; }
        clients.put(session.getClientId(), session);
        session.setUsername(username);
        return true;
    }

    public void removeClient(ClientSession session, String reason) {
        if (!clients.remove(session.getClientId(), session)) return;
        String username = session.getUsername();
        if (username != null) { onlineUsers.remove(username, session.getClientId()); presence.logout(username); }
        session.closeResources();
        if (username != null) {
            System.out.printf("Client %d (%s) disconnected: %s%n", session.getClientId(), username, reason);
            broadcast(ChatMessage.message(MessageType.SYSTEM, "SERVER", session.getClientId(),
                    username + " đã rời phòng chat."));
        } else {
            System.out.printf("Client %d disconnected: %s%n", session.getClientId(), reason);
        }
    }

    public void broadcast(ChatMessage message) {
        messageBus.publish(message);
    }

    /** Đầu nhận TCP của bus dùng chung; không publish ngược lại để tránh vòng lặp. */
    private void broadcastToTcpClients(ChatMessage message) {
        ClientSession[] snapshot = clients.values().toArray(new ClientSession[0]);
        for (ClientSession client : snapshot) {
            try { client.sendMessage(message); }
            catch (IOException e) { removeClient(client, "send failed"); }
        }
    }

    public boolean isRunning() { return running; }
    public int getPort() { return port; }

    public void stop() {
        running = false;
        try { if (serverSocket != null) serverSocket.close(); } catch (IOException ignored) { }
        for (ClientSession session : clients.values().toArray(new ClientSession[0])) {
            removeClient(session, "server stopping");
        }
        workers.shutdownNow();
    }
}
