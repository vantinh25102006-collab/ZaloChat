package server;

/** Điểm khởi chạy Server. Đặt CHAT_KEYSTORE_PASSWORD trong biến môi trường. */
public class Program {
    public static void main(String[] args) {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : ChatServer.DEFAULT_PORT;
        String password = System.getenv("CHAT_KEYSTORE_PASSWORD");
        if (password == null || password.isBlank()) {
            System.err.println("Thiếu biến môi trường CHAT_KEYSTORE_PASSWORD. Hãy đặt mật khẩu keystore trước khi chạy.");
            System.exit(1);
        }
        ChatServer server = new ChatServer(port, password);
        Runtime.getRuntime().addShutdownHook(new Thread(server::stop, "server-shutdown"));
        try { server.start(); }
        catch (Exception e) {
            System.err.println("Không thể khởi động Server: " + e.getMessage());
            server.stop();
            System.exit(1);
        }
    }
}
