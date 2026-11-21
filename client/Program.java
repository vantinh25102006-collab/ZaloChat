package client;

import java.io.Console;
import java.util.Arrays;
import java.util.Scanner;

/** Console UI: nhập thông tin, đăng nhập, nhận tin nền và gửi tin liên tục. */
public class Program {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String host = args.length > 0 ? args[0] : "localhost";
        int port = args.length > 1 ? Integer.parseInt(args[1]) : 5000;
        ChatClient client = new ChatClient(host, port);
        try {
            client.connect();
            System.out.println("\n===== SECURE TCP CHAT =====");
            System.out.print("Username: ");
            String username = scanner.nextLine().trim();
            char[] password;
            Console console = System.console();
            if (console != null) password = console.readPassword("Password: ");
            else { System.out.print("Password (terminal không hỗ trợ ẩn): "); password = scanner.nextLine().toCharArray(); }
            boolean ok = client.login(username, password);
            Arrays.fill(password, '\0');
            if (!ok) return;
            client.startReceiveLoop();
            System.out.println("Nhập tin nhắn để gửi. Gõ /exit để thoát.");
            while (true) {
                System.out.print("Bạn: ");
                String text = scanner.nextLine();
                if ("/exit".equalsIgnoreCase(text.trim())) break;
                if (!text.isBlank()) client.sendChat(text);
            }
        } catch (Exception e) {
            System.err.println("Client error: " + e.getMessage());
        } finally {
            client.close();
            scanner.close();
        }
    }
}
