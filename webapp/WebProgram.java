package webapp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.server.Ssl;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.ConfigurableServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Điểm khởi chạy duy nhất cho Web Server và TCP/TLS Server.
 * TCP Server được Spring quản lý bởi TcpServerLifecycle.
 */
@SpringBootApplication(scanBasePackages = {"webapp"})
public class WebProgram implements WebMvcConfigurer {

    private static final String KEYSTORE_PATH = "server/certificates/server.p12";

    public static void main(String[] args) throws Exception {
        // Truyền args thẳng vào Spring Boot; người dùng dùng --server.port=8080
        // Hỗ trợ dạng positional cũ: WebProgram webPort tcpPort password
        for (String arg : args) {
            if (!arg.startsWith("--") && !arg.startsWith("-")) {
                // positional args: đầu tiên là webPort, bỏ qua vì Spring tự đọc từ properties
                break;
            }
        }
        SpringApplication.run(WebProgram.class, args);
    }

    @Bean
    public WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> sslCustomizer(
            @Value("${chat.tls.keystore-password:}") String configuredPassword,
            @Value("${chat.web.tls.enabled:true}") boolean tlsEnabled) {
        return factory -> {
            if (!tlsEnabled) return;
            String password = configuredPassword;
            if (password.isBlank()) {
                password = System.getenv().getOrDefault("CHAT_KEYSTORE_PASSWORD", "");
            }
            Path ksPath = Path.of(KEYSTORE_PATH);
            if (!password.isBlank() && Files.isRegularFile(ksPath)) {
                Ssl ssl = new Ssl();
                ssl.setEnabled(true);
                ssl.setKeyStore(ksPath.toAbsolutePath().toString());
                ssl.setKeyStoreType("PKCS12");
                ssl.setKeyStorePassword(password);
                ssl.setKeyPassword(password);
                ssl.setKeyAlias("chatserver");
                ssl.setProtocol("TLS");
                ssl.setEnabledProtocols(new String[]{"TLSv1.3", "TLSv1.2"});
                factory.setSsl(ssl);
                System.out.println("[Spring Boot] Đã kích hoạt HTTPS / WSS (TLSv1.3, TLSv1.2) cho Webapp với chứng chỉ " + ksPath);
            } else {
                System.out.println("[Spring Boot] CẢNH BÁO: Chưa có CHAT_KEYSTORE_PASSWORD hoặc thiếu " + KEYSTORE_PATH
                        + " -> Webapp đang chạy ở chế độ HTTP/WS thường (không có TLS).");
            }
        };
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Phục vụ file tĩnh từ /static/ trong classpath
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/");
    }
}
