package webapp;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import server.UserStore;
import webapp.runtime.ChatMessageBus;
import webapp.runtime.ChatPresenceRegistry;
import webapp.runtime.EmbeddedFtpServer;
import webapp.runtime.P2PAndMulticastManager;

@Configuration
public class ChatRuntimeConfiguration {
    @Bean public UserStore userStore() { return new UserStore(); }
    @Bean public ChatMessageBus chatMessageBus() { return new ChatMessageBus(); }
    @Bean public ChatPresenceRegistry chatPresenceRegistry() { return new ChatPresenceRegistry(); }
    @Bean public P2PAndMulticastManager p2pAndMulticastManager() { return new P2PAndMulticastManager(); }
    @Bean(destroyMethod = "shutdown") public EmbeddedFtpServer embeddedFtpServer() { return new EmbeddedFtpServer(); }
}
