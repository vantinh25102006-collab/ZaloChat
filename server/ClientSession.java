package server;

import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import model.ChatMessage;
import model.MessageType;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSession;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/** Xử lý một kết nối TLS: handshake, login, đọc JSON line, chat và cleanup. */
public class ClientSession implements Runnable {
    private static final int MAX_FRAME_BYTES = 4096;
    private final ChatServer server;
    private final SSLSocket socket;
    private final int clientId;
    private final UserStore userStore;
    private final Gson gson = new Gson();
    private final Object sendLock = new Object();
    private volatile String username;
    private volatile boolean authenticated;
    private volatile boolean closed;
    private InputStream input;
    private OutputStream output;

    public ClientSession(ChatServer server, SSLSocket socket, int clientId, UserStore userStore) {
        this.server = server; this.socket = socket; this.clientId = clientId; this.userStore = userStore;
    }

    public int getClientId() { return clientId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; this.authenticated = true; }

    @Override public void run() {
        String reason = "connection closed";
        try {
            socket.setUseClientMode(false);
            socket.startHandshake();
            socket.setSoTimeout(0);
            input = socket.getInputStream();
            output = socket.getOutputStream();
            SSLSession session = socket.getSession();
            System.out.printf("Client %d TLS OK: %s / %s%n", clientId,
                    session.getProtocol(), session.getCipherSuite());

            String line;
            while (!closed && (line = readFrame(input)) != null) {
                ChatMessage message;
                try {
                    message = gson.fromJson(line, ChatMessage.class);
                } catch (JsonParseException e) {
                    sendSystem("INVALID_JSON: JSON không hợp lệ.");
                    continue;
                }
                if (message == null || message.getType() == null) {
                    sendSystem("INVALID_MESSAGE: thiếu hoặc sai type.");
                    continue;
                }
                switch (message.getType()) {
                    case LOGIN -> handleLogin(message);
                    case MESSAGE -> handleChat(message);
                    case DISCONNECT -> { reason = "client requested disconnect"; return; }
                    default -> sendSystem("UNSUPPORTED_MESSAGE_TYPE");
                }
            }
        } catch (IOException e) {
            reason = "I/O or TLS error: " + e.getClass().getSimpleName();
            System.err.printf("Client %d connection error: %s%n", clientId, e.getMessage());
        } catch (Exception e) {
            reason = "unexpected error: " + e.getClass().getSimpleName();
            System.err.printf("Client %d handler error: %s%n", clientId, e.getMessage());
        } finally {
            server.removeClient(this, reason);
            if (!authenticated) closeResources();
        }
    }

    private void handleLogin(ChatMessage message) throws IOException {
        if (authenticated) { sendMessage(ChatMessage.loginResult(false, clientId, "Client đã đăng nhập.")); return; }
        String name = message.getUsername();
        String password = message.getPassword();
        boolean validFormat = name != null && name.matches("[A-Za-z0-9_]{3,24}")
                && password != null && password.length() >= 1 && password.length() <= 128;
        boolean valid = validFormat && userStore.authenticate(name, password);
        // Xóa tham chiếu password càng sớm càng tốt; tuyệt đối không log giá trị này.
        message.setPassword(null);
        if (!valid) {
            sendMessage(ChatMessage.loginResult(false, clientId, "Username hoặc Password không đúng."));
            return;
        }
        if (!server.register(this, name)) {
            sendMessage(ChatMessage.loginResult(false, clientId, "Tài khoản đang được đăng nhập ở nơi khác."));
            return;
        }
        sendMessage(ChatMessage.loginResult(true, clientId, "Đăng nhập thành công."));
        System.out.printf("Client %d authenticated as %s%n", clientId, name);
        server.broadcast(ChatMessage.message(MessageType.SYSTEM, "SERVER", clientId,
                name + " đã tham gia phòng chat."));
    }

    private void handleChat(ChatMessage message) throws IOException {
        if (!authenticated) { sendSystem("LOGIN_REQUIRED"); return; }
        String content = message.getContent();
        if (content == null || content.isBlank()) return;
        if (content.getBytes(StandardCharsets.UTF_8).length > 3000) {
            sendSystem("MESSAGE_TOO_LONG: tối đa 3000 byte nội dung.");
            return;
        }
        ChatMessage outgoing = ChatMessage.message(MessageType.MESSAGE, username, clientId, content.strip());
        outgoing.setConversationId("global");
        outgoing.setMessageId(java.util.UUID.randomUUID().toString());
        server.broadcast(outgoing);
    }

    public void sendMessage(ChatMessage message) throws IOException {
        if (closed || output == null) throw new IOException("Client stream is closed");
        byte[] payload = (gson.toJson(message) + "\n").getBytes(StandardCharsets.UTF_8);
        if (payload.length > MAX_FRAME_BYTES) throw new IOException("Outbound frame too large");
        synchronized (sendLock) {
            if (closed) throw new IOException("Client is closed");
            output.write(payload);
            output.flush();
        }
    }

    private void sendSystem(String content) throws IOException {
        sendMessage(ChatMessage.message(MessageType.SYSTEM, "SERVER", clientId, content));
    }

    /** Đọc đúng một frame newline, giới hạn 4 KB; TCP không bảo toàn ranh giới message. */
    private static String readFrame(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\n') break;
            if (buffer.size() >= MAX_FRAME_BYTES) throw new IOException("Frame exceeds 4 KB");
            if (b != '\r') buffer.write(b);
        }
        if (b == -1 && buffer.size() == 0) return null;
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(buffer.toByteArray())).toString();
        } catch (CharacterCodingException e) {
            throw new IOException("Invalid UTF-8 frame", e);
        }
    }

    public void closeResources() {
        if (closed) return;
        closed = true;
        synchronized (sendLock) {
            try { if (input != null) input.close(); } catch (IOException ignored) { }
            try { if (output != null) output.close(); } catch (IOException ignored) { }
            try { socket.close(); } catch (IOException ignored) { }
        }
    }
}
