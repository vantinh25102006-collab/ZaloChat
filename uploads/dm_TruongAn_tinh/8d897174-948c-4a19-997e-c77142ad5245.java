import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

public class ChatCommon {

    public static final int TCP_PORT = 5000;

    public static final String SERVER_GROUP = "SERVER";

    public static final String SERVER_MCAST_IP = "239.1.1.1";

    public static final int SERVER_MCAST_PORT = 8000;

    public static final DateTimeFormatter TIME =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    public ChatCommon() {
    }

    // Ma hoa chuoi sang Base64
    public static String b64(String text) {
        return Base64.getEncoder().encodeToString(
                text.getBytes(StandardCharsets.UTF_8)
        );
    }

    // Giai ma Base64
    public static String ub64(String text) {
        return new String(
                Base64.getDecoder().decode(text),
                StandardCharsets.UTF_8
        );
    }

    // Lay thoi gian hien tai
    public static String now() {
        return LocalDateTime.now().format(TIME);
    }

    // Xu ly chuoi an toan
    public static String safe(String text) {
        return text == null
                ? ""
                : text.replace("|", "/").replace("\n", " ");
    }

    // =========================
    // CLASS CHAT MESSAGE
    // =========================
    public static class ChatMessage {

        public String scope;
        public String senderId;
        public String senderName;

        public String targetId;
        public String targetName;

        public String groupId;
        public String groupName;

        public String time;
        public String text;

        public String senderIp;

        public long seq;

        public ChatMessage() {
        }

        // Dong goi tin nhan thanh chuoi
        public String encode() {

            return String.join(
                    "|",
                    "CHAT",
                    ChatCommon.safe(this.scope),
                    ChatCommon.safe(this.senderId),
                    ChatCommon.b64(this.senderName),
                    ChatCommon.safe(this.targetId),
                    ChatCommon.b64(
                            this.targetName == null
                                    ? ""
                                    : this.targetName
                    ),
                    ChatCommon.safe(this.groupId),
                    ChatCommon.b64(
                            this.groupName == null
                                    ? ""
                                    : this.groupName
                    ),
                    ChatCommon.safe(this.time),
                    ChatCommon.b64(this.text),
                    ChatCommon.safe(this.senderIp),
                    String.valueOf(this.seq)
            );
        }

        // Giai ma tin nhan
        public static ChatMessage decode(String data) {

            try {

                String[] parts = data.split("\\|", -1);

                if (parts.length >= 12 && "CHAT".equals(parts[0])) {

                    ChatMessage message = new ChatMessage();

                    message.scope = parts[1];

                    message.senderId = parts[2];

                    message.senderName =
                            ChatCommon.ub64(parts[3]);

                    message.targetId = parts[4];

                    message.targetName =
                            ChatCommon.ub64(parts[5]);

                    message.groupId = parts[6];

                    message.groupName =
                            ChatCommon.ub64(parts[7]);

                    message.time = parts[8];

                    message.text =
                            ChatCommon.ub64(parts[9]);

                    message.senderIp = parts[10];

                    message.seq =
                            Long.parseLong(parts[11]);

                    return message;
                }

                return null;

            } catch (Exception e) {

                return null;
            }
        }

        // Hien thi tin nhan
        public String displayText() {

            return "[" + this.time + "] "
                    + this.senderName
                    + ": "
                    + this.text;
        }
    }
}