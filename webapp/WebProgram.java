package webapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.ConfigurableServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Điểm khởi chạy duy nhất cho Web Server và TCP/TLS Server.
 * TCP Server được Spring quản lý bởi TcpServerLifecycle.
 */
@SpringBootApplication(scanBasePackages = {"webapp"})
public class WebProgram implements WebMvcConfigurer {

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

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Phục vụ file tĩnh từ /static/ trong classpath
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/");
    }
}
