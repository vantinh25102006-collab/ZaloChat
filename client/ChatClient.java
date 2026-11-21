package client;

import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import model.ChatMessage;
import model.MessageType;

import javax.net.ssl.*;
import java.io.*;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

/** TLS client xác thực chứng chỉ Server bằng truststore chứa server.crt. */
public class ChatClient implements AutoCloseable {
    private static final int MAX_FRAME_BYTES = 4096;
    private final String host;
    private final int port;
    private final Gson gson = new Gson();
    private final Object sendLock = new Object();
    private volatile boolean connected;
    private SSLSocket socket;
    private InputStream input;
    private OutputStream output;
    private Thread receiveThread;

    public ChatClient(String host, int port) { this.host = host; this.port = port; }

    private SSLContext createSSLContext() throws Exception {
        KeyStore trustStore = KeyStore.getInstance("PKCS12");
        trustStore.load(null, null);
        try (InputStream in = new FileInputStream("client/certificates/server.crt")) {
            java.security.cert.Certificate cert = java.security.cert.CertificateFactory
                    .getInstance("X.509").generateCertificate(in);
            trustStore.setCertificateEntry("secure-chat-server", cert);
        }
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(trustStore);
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, tmf.getTrustManagers(), null);
        return context;
    }

    public void connect() throws Exception {
        SSLSocketFactory factory = createSSLContext().getSocketFactory();
        socket = (SSLSocket) factory.createSocket();
        socket.connect(new InetSocketAddress(host, port), 5000);
        socket.setKeepAlive(true);
        socket.setTcpNoDelay(true);
        socket.setSoTimeout(10_000);
        socket.setEnabledProtocols(new String[]{"TLSv1.3", "TLSv1.2"});
        SSLParameters parameters = socket.getSSLParameters();
        parameters.setEndpointIdentificationAlgorithm("HTTPS"); // kiểm tra SAN/hostname
        socket.setSSLParameters(parameters);
        socket.startHandshake();
        socket.setSoTimeout(0);
        input = socket.getInputStream();
        output = socket.getOutputStream();
        connected = true;
        SSLSession session = socket.getSession();
        System.out.printf("TLS connected: %s / %s%n", session.getProtocol(), session.getCipherSuite());
    }

    public boolean login(String username, char[] password) throws IOException {
        String secret = new String(password);
        java.util.Arrays.fill(password, '\0');
        sendMessage(ChatMessage.login(username, secret));
        // Chỉ luồng main đọc phản hồi login; receive loop chỉ được bật sau login.
        String json = readFrame(input);
        if (json == null) throw new IOException("Server đóng kết nối trong lúc đăng nhập");
        ChatMessage response = gson.fromJson(json, ChatMessage.class);
        if (response == null || response.getType() != MessageType.LOGIN_RESULT) {
            throw new IOException("Phản hồi đăng nhập không hợp lệ");
        }
        System.out.println(response.getContent());
        return response.isSuccess();
    }

    public void sendChat(String content) throws IOException {
        sendMessage(ChatMessage.message(MessageType.MESSAGE, null, 0, content));
    }

    private void sendMessage(ChatMessage message) throws IOException {
        if (!connected || output == null) throw new IOException("Chưa kết nối Server");
        byte[] data = (gson.toJson(message) + "\n").getBytes(StandardCharsets.UTF_8);
        if (data.length > MAX_FRAME_BYTES) throw new IOException("Thông điệp vượt quá 4 KB");
        synchronized (sendLock) {
            output.write(data);
            output.flush();
        }
    }

    public void startReceiveLoop() {
        if (receiveThread != null) return;
        receiveThread = new Thread(() -> {
            try {
                String line;
                while (connected && (line = readFrame(input)) != null) {
                    try {
                        ChatMessage message = gson.fromJson(line, ChatMessage.class);
                        if (message == null || message.getType() == null) continue;
                        if (message.getType() == MessageType.MESSAGE) {
                            System.out.printf("\n[%s] %s: %s%n", message.getTimestamp(),
                                    message.getUsername(), message.getContent());
                        } else if (message.getType() == MessageType.SYSTEM) {
                            System.out.println("\n[SYSTEM] " + message.getContent());
                        } else {
                            System.out.println("\n[SERVER] " + message.getContent());
                        }
                        System.out.print("Bạn: ");
                    } catch (JsonParseException e) {
                        System.err.println("Nhận được JSON không hợp lệ từ Server.");
                    }
                }
            } catch (IOException e) {
                if (connected) System.err.println("Mất kết nối: " + e.getMessage());
            } finally {
                connected = false;
            }
        }, "chat-receive-loop");
        receiveThread.setDaemon(true);
        receiveThread.start();
    }

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

    @Override public void close() {
        connected = false;
        try {
            if (output != null) {
                byte[] data = (gson.toJson(ChatMessage.message(MessageType.DISCONNECT, null, 0, "")) + "\n")
                        .getBytes(StandardCharsets.UTF_8);
                synchronized (sendLock) { output.write(data); output.flush(); }
            }
        } catch (IOException ignored) { }
        try { if (socket != null) socket.close(); } catch (IOException ignored) { }
    }
}
