package webapp.runtime;

import model.ChatMessage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/** Bus sự kiện chung: tin nhắn global từ TCP và Web đều đi qua cùng một điểm. */
public class ChatMessageBus {
    private final CopyOnWriteArrayList<Consumer<ChatMessage>> listeners = new CopyOnWriteArrayList<>();
    public void subscribe(Consumer<ChatMessage> listener) { listeners.add(listener); }
    public void publish(ChatMessage message) {
        for (Consumer<ChatMessage> listener : listeners) {
            try { listener.accept(message); }
            catch (RuntimeException e) { System.err.println("Chat event listener error: " + e.getMessage()); }
        }
    }
}
