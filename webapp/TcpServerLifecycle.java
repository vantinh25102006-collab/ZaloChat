package webapp;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import server.ChatServer;
import server.UserStore;
import webapp.runtime.ChatMessageBus;
import webapp.runtime.ChatPresenceRegistry;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Vòng đời TCP Server được Spring Boot quản lý; không cần chạy server.Program riêng. */
@Component
public class TcpServerLifecycle {
    private final ChatServer chatServer;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "secure-tcp-server");
        t.setDaemon(false);
        return t;
    });

    public TcpServerLifecycle(UserStore users, ChatMessageBus bus, ChatPresenceRegistry presence,
                              @Value("${chat.tcp.port:5000}") int port,
                              @Value("${chat.tls.keystore-password:}") String configuredPassword) {
        String password = configuredPassword;
        if (password.isBlank()) password = System.getenv().getOrDefault("CHAT_KEYSTORE_PASSWORD", "");
        if (password.isBlank()) {
            this.chatServer = null;
            System.out.println("[Spring Boot] CẢNH BÁO: Chưa cấu hình CHAT_KEYSTORE_PASSWORD hoặc chat.tls.keystore-password. TCP/TLS Server sẽ không khởi động (Web Server vẫn hoạt động bình thường).");
        } else {
            this.chatServer = new ChatServer(port, password, users, bus, presence);
        }
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void startTcpServer() {
        if (chatServer == null) return;
        java.util.concurrent.Future<?> task = executor.submit(() -> {
            try { chatServer.start(); }
            catch (Exception e) { throw new java.util.concurrent.CompletionException(e); }
        });
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(10);
        while (!chatServer.isRunning() && System.nanoTime() < deadline) {
            if (task.isDone()) {
                try { task.get(); }
                catch (Exception e) { throw new IllegalStateException("TCP/TLS Server startup failed", e); }
            }
            try { Thread.sleep(50); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
        }
        if (!chatServer.isRunning()) {
            chatServer.stop();
            throw new IllegalStateException("TCP/TLS Server không sẵn sàng sau 10 giây.");
        }
        System.out.println("[Spring Boot] TCP/TLS Server đã khởi động tại cổng " + chatServer.getPort());
    }

    @PreDestroy
    public void stopTcpServer() {
        if (chatServer != null) {
            chatServer.stop();
        }
        executor.shutdownNow();
    }
}
