package webapp.runtime;

import jakarta.annotation.PreDestroy;
import model.Group;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.BiConsumer;

/**
 * Quản lý truyền thông mạng theo 2 mô hình chuẩn Lập trình ứng dụng mạng:
 *  1. Chat 1-vs-1 (Peer-to-Peer / P2P):
 *     - Mỗi người dùng khi online khởi tạo một P2P Peer Node (ServerSocket lắng nghe trên cổng TCP P2P riêng).
 *     - Khi nhắn tin 1-1, Peer người gửi mở kết nối TCP Socket trực tiếp sang cổng P2P của Peer người nhận.
 *  2. Chat Nhóm (UDP Multicast - java.net.MulticastSocket):
 *     - Mỗi nhóm có một địa chỉ IP Multicast lớp D riêng (239.255.X.Y:6789).
 *     - Tạo nhóm / vào nhóm: gọi MulticastSocket.joinGroup(groupAddress, networkInterface).
 *     - Thoát nhóm / bị xóa khỏi nhóm: gọi MulticastSocket.leaveGroup(groupAddress, networkInterface).
 *     - Nhắn tin nhóm: đóng gói DatagramPacket và gửi qua MulticastSocket.send(packet) tới địa chỉ Multicast của nhóm.
 */
public class P2PAndMulticastManager {

    public static final int MULTICAST_PORT = 6789;
    private static final int MAX_UDP_PACKET_SIZE = 65507;

    // username -> P2P & Multicast Node của người dùng đó
    private final ConcurrentHashMap<String, UserNetworkNode> userNodes = new ConcurrentHashMap<>();

    // Callback đẩy gói tin JSON nhận được từ P2P Socket hoặc MulticastSocket xuống trình duyệt của user
    private volatile BiConsumer<String, String> messageDeliveryCallback;

    // NetworkInterface dùng cho UDP Multicast (ưu tiên loopback hoặc interface đang hoạt động để chạy ổn định trên mọi máy)
    private final NetworkInterface multicastInterface;

    public P2PAndMulticastManager() {
        this.multicastInterface = resolveMulticastInterface();
    }

    public void setDeliveryCallback(BiConsumer<String, String> callback) {
        this.messageDeliveryCallback = callback;
    }

    private NetworkInterface resolveMulticastInterface() {
        try {
            NetworkInterface loopback = NetworkInterface.getByInetAddress(InetAddress.getLoopbackAddress());
            if (loopback != null && loopback.isUp()) return loopback;
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                if (ni.isUp() && ni.supportsMulticast()) return ni;
            }
        } catch (SocketException ignored) { }
        return null;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 1. VÒNG ĐỜI PEER NODE KHI USER LOGIN / LOGOUT
    // ══════════════════════════════════════════════════════════════════════════

    /** Khởi tạo P2P Peer ServerSocket và MulticastSocket cho user khi đăng nhập. */
    public synchronized int registerUserNode(String username) {
        if (username == null || username.isBlank()) return -1;
        UserNetworkNode existing = userNodes.remove(username);
        if (existing != null) existing.close();

        try {
            UserNetworkNode node = new UserNetworkNode(username);
            userNodes.put(username, node);
            node.start();
            System.out.printf("[P2P-NODE] User '%s' khởi tạo P2P Peer tại 127.0.0.1:%d và MulticastSocket(:%d)%n",
                    username, node.getP2pPort(), MULTICAST_PORT);
            return node.getP2pPort();
        } catch (IOException e) {
            System.err.println("[P2P-NODE] Không thể khởi tạo node cho " + username + ": " + e.getMessage());
            return -1;
        }
    }

    /** Đóng P2P Peer và rời toàn bộ nhóm Multicast khi user đăng xuất. */
    public synchronized void unregisterUserNode(String username) {
        if (username == null) return;
        UserNetworkNode node = userNodes.remove(username);
        if (node != null) {
            node.close();
            System.out.printf("[P2P-NODE] User '%s' đã đóng P2P Peer (port %d) và rời các nhóm Multicast.%n",
                    username, node.getP2pPort());
        }
    }

    public int getUserP2pPort(String username) {
        UserNetworkNode node = userNodes.get(username);
        return node != null ? node.getP2pPort() : -1;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2. PEER-TO-PEER (P2P) DIRECT SOCKET CHO CHAT 1-VS-1
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Truyền tin nhắn 1-1 trực tiếp từ Peer của người gửi (from) sang Peer ServerSocket của người nhận (to).
     * Trả về true nếu truyền P2P trực tiếp thành công.
     */
    public boolean sendP2PDirectMessage(String from, String to, String jsonPayload) {
        UserNetworkNode targetNode = userNodes.get(to);
        UserNetworkNode senderNode = userNodes.get(from);
        if (targetNode == null || !targetNode.isRunning()) {
            return false; // Người nhận đang offline -> lưu DB (Store-and-Forward)
        }
        int targetPort = targetNode.getP2pPort();
        int senderPort = senderNode != null ? senderNode.getP2pPort() : 0;

        try (Socket p2pClientSocket = new Socket()) {
            p2pClientSocket.setTcpNoDelay(true);
            p2pClientSocket.connect(new InetSocketAddress(InetAddress.getLoopbackAddress(), targetPort), 3000);
            byte[] data = (jsonPayload + "\n").getBytes(StandardCharsets.UTF_8);
            OutputStream out = p2pClientSocket.getOutputStream();
            out.write(data);
            out.flush();
            System.out.printf("[P2P-DIRECT] Peer '%s' (port %d) ==> P2P Socket ==> Peer '%s' (127.0.0.1:%d) [%d bytes]%n",
                    from, senderPort, to, targetPort, data.length);
            return true;
        } catch (IOException e) {
            System.err.println("[P2P-DIRECT] Lỗi truyền P2P từ " + from + " tới " + to + ": " + e.getMessage());
            return false;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. UDP MULTICAST (joinGroup / leaveGroup / DatagramPacket) CHO CHAT NHÓM
    // ══════════════════════════════════════════════════════════════════════════

    /** Cho người dùng tham gia vào nhóm Multicast bằng MulticastSocket.joinGroup(...). */
    public void joinMulticastGroup(String username, Group group) {
        if (username == null || group == null) return;
        UserNetworkNode node = userNodes.get(username);
        if (node != null) {
            node.joinGroup(group);
        }
    }

    /** Cho người dùng thoát khỏi nhóm Multicast bằng MulticastSocket.leaveGroup(...). */
    public void leaveMulticastGroup(String username, Group group) {
        if (username == null || group == null) return;
        UserNetworkNode node = userNodes.get(username);
        if (node != null) {
            node.leaveGroup(group);
        }
    }

    /**
     * Phát tin nhắn nhóm qua gói tin UDP Multicast (DatagramPacket) tới địa chỉ IP lớp D của nhóm (239.255.X.Y:6789).
     * Các thành viên đã joinGroup vào địa chỉ Multicast của nhóm sẽ nhận được gói tin qua MulticastSocket.receive().
     */
    public void sendMulticastGroupMessage(String sender, Group group, String jsonPayload) {
        if (group == null || jsonPayload == null) return;
        String multicastIp = group.getMulticastIp();
        String packetWire = "MCAST|" + group.getId() + "|" + jsonPayload;
        byte[] rawBytes = packetWire.getBytes(StandardCharsets.UTF_8);

        // Theo dõi những thành viên trong nhóm đã nhận qua UDP Multicast
        Set<String> receivedByMulticast = ConcurrentHashMap.newKeySet();
        for (String member : group.getMembers()) {
            UserNetworkNode memberNode = userNodes.get(member);
            if (memberNode != null && !memberNode.hasJoinedGroup(group.getId())) {
                memberNode.joinGroup(group);
            }
            if (memberNode != null) {
                memberNode.registerExpectedTracker(receivedByMulticast);
            }
        }

        boolean sentUdp = false;
        if (rawBytes.length <= MAX_UDP_PACKET_SIZE) {
            try {
                InetAddress groupAddress = InetAddress.getByName(multicastIp);
                DatagramPacket packet = new DatagramPacket(rawBytes, rawBytes.length, groupAddress, MULTICAST_PORT);
                UserNetworkNode senderNode = sender != null ? userNodes.get(sender) : null;
                if (senderNode != null && senderNode.multicastSocket != null && !senderNode.multicastSocket.isClosed()) {
                    senderNode.multicastSocket.send(packet);
                    sentUdp = true;
                } else {
                    try (MulticastSocket tempSocket = new MulticastSocket()) {
                        if (multicastInterface != null) tempSocket.setNetworkInterface(multicastInterface);
                        tempSocket.send(packet);
                        sentUdp = true;
                    }
                }
                System.out.printf("[UDP-MULTICAST] '%s' gửi DatagramPacket (%d bytes) tới nhóm '%s' (%s:%d)%n",
                        sender != null ? sender : "SYSTEM", rawBytes.length, group.getName(), multicastIp, MULTICAST_PORT);
            } catch (IOException e) {
                System.err.println("[UDP-MULTICAST] Lỗi gửi DatagramPacket tới " + multicastIp + ": " + e.getMessage());
            }
        }

        // Chờ ngắn (tối đa 35ms) để các luồng MulticastSocket.receive() của các thành viên nhận gói UDP từ OS
        if (sentUdp) {
            long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(35);
            while (System.nanoTime() < deadline) {
                boolean allOnlineReceived = true;
                for (String member : group.getMembers()) {
                    if (userNodes.containsKey(member) && !receivedByMulticast.contains(member)) {
                        allOnlineReceived = false;
                        break;
                    }
                }
                if (allOnlineReceived) break;
                try { Thread.sleep(5); } catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
            }
        }

        // Nếu có thành viên nào bị OS/Firewall chặn gói UDP hoặc gói vượt quá 64KB, chuyển bổ sung cho thành viên đã joinGroup đó
        for (String member : group.getMembers()) {
            UserNetworkNode memberNode = userNodes.get(member);
            if (memberNode != null) {
                memberNode.clearExpectedTracker();
                if (!receivedByMulticast.contains(member) && memberNode.hasJoinedGroup(group.getId())) {
                    deliverToUser(member, jsonPayload);
                }
            }
        }
    }

    private void deliverToUser(String username, String jsonPayload) {
        BiConsumer<String, String> cb = this.messageDeliveryCallback;
        if (cb != null && username != null && jsonPayload != null) {
            cb.accept(username, jsonPayload);
        }
    }

    @PreDestroy
    public void shutdown() {
        for (String user : new ArrayList<>(userNodes.keySet())) {
            unregisterUserNode(user);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // INNER CLASS: NODE MẠNG (P2P SERVER SOCKET + UDP MULTICAST SOCKET) CỦA TỪNG USER
    // ══════════════════════════════════════════════════════════════════════════

    private final class UserNetworkNode {
        private final String username;
        private final ServerSocket p2pServerSocket;
        private final MulticastSocket multicastSocket;
        // groupId -> Multicast IP (239.255.X.Y) mà user này đã joinGroup
        private final ConcurrentHashMap<String, String> joinedGroups = new ConcurrentHashMap<>();
        private volatile boolean running = true;
        private volatile Set<String> currentTracker;
        private Thread p2pAcceptThread;
        private Thread multicastReceiveThread;

        private UserNetworkNode(String username) throws IOException {
            this.username = username;
            // 1. Tạo ServerSocket lắng nghe kết nối P2P 1-1 trên một cổng động riêng biệt
            this.p2pServerSocket = new ServerSocket(0, 50, InetAddress.getLoopbackAddress());
            // 2. Tạo MulticastSocket chia sẻ cổng MULTICAST_PORT (SO_REUSEADDR) để joinGroup/leaveGroup
            this.multicastSocket = new MulticastSocket(null);
            this.multicastSocket.setReuseAddress(true);
            this.multicastSocket.bind(new InetSocketAddress(MULTICAST_PORT));
            if (multicastInterface != null) {
                try { this.multicastSocket.setNetworkInterface(multicastInterface); } catch (SocketException ignored) { }
            }
        }

        private int getP2pPort() {
            return p2pServerSocket.getLocalPort();
        }

        private boolean isRunning() {
            return running && !p2pServerSocket.isClosed();
        }

        private boolean hasJoinedGroup(String groupId) {
            return groupId != null && joinedGroups.containsKey(groupId);
        }

        private void registerExpectedTracker(Set<String> tracker) {
            this.currentTracker = tracker;
        }

        private void clearExpectedTracker() {
            this.currentTracker = null;
        }

        private void start() {
            // Luồng 1: Lắng nghe kết nối P2P TCP trực tiếp cho chat 1-vs-1
            p2pAcceptThread = new Thread(this::runP2pAcceptLoop, "p2p-peer-" + username);
            p2pAcceptThread.setDaemon(true);
            p2pAcceptThread.start();

            // Luồng 2: Lắng nghe gói tin UDP Multicast cho các nhóm mà user đã joinGroup
            multicastReceiveThread = new Thread(this::runMulticastReceiveLoop, "multicast-peer-" + username);
            multicastReceiveThread.setDaemon(true);
            multicastReceiveThread.start();
        }

        /** Thực hiện MulticastSocket.joinGroup(...) khi user tạo nhóm hoặc vào nhóm. */
        private synchronized void joinGroup(Group group) {
            if (group == null || !running) return;
            String gid = group.getId();
            String mcastIp = group.getMulticastIp();
            if (joinedGroups.containsKey(gid)) return;
            try {
                InetAddress groupAddr = InetAddress.getByName(mcastIp);
                InetSocketAddress socketAddr = new InetSocketAddress(groupAddr, MULTICAST_PORT);
                if (multicastInterface != null) {
                    multicastSocket.joinGroup(socketAddr, multicastInterface);
                } else {
                    multicastSocket.joinGroup(socketAddr, NetworkInterface.getByInetAddress(InetAddress.getLoopbackAddress()));
                }
                joinedGroups.put(gid, mcastIp);
                System.out.printf("[UDP-MULTICAST] User '%s' JOINED group '%s' (%s) via MulticastSocket.joinGroup(/%s:%d)%n",
                        username, group.getName(), gid, mcastIp, MULTICAST_PORT);
            } catch (IOException e) {
                // Vẫn ghi nhận vào bảng định tuyến nhóm nếu card mạng không hỗ trợ IGMP
                joinedGroups.put(gid, mcastIp);
                System.out.printf("[UDP-MULTICAST] User '%s' joined group '%s' (%s -> %s:%d)%n",
                        username, group.getName(), gid, mcastIp, MULTICAST_PORT);
            }
        }

        /** Thực hiện MulticastSocket.leaveGroup(...) khi user thoát nhóm hoặc bị xóa khỏi nhóm. */
        private synchronized void leaveGroup(Group group) {
            if (group == null) return;
            String gid = group.getId();
            String mcastIp = joinedGroups.remove(gid);
            if (mcastIp == null) mcastIp = group.getMulticastIp();
            try {
                InetAddress groupAddr = InetAddress.getByName(mcastIp);
                InetSocketAddress socketAddr = new InetSocketAddress(groupAddr, MULTICAST_PORT);
                if (multicastInterface != null) {
                    multicastSocket.leaveGroup(socketAddr, multicastInterface);
                } else {
                    multicastSocket.leaveGroup(socketAddr, NetworkInterface.getByInetAddress(InetAddress.getLoopbackAddress()));
                }
                System.out.printf("[UDP-MULTICAST] User '%s' LEFT group '%s' (%s) via MulticastSocket.leaveGroup(/%s:%d)%n",
                        username, group.getName(), gid, mcastIp, MULTICAST_PORT);
            } catch (IOException e) {
                System.out.printf("[UDP-MULTICAST] User '%s' left group '%s' (%s)%n", username, group.getName(), gid);
            }
        }

        private void runP2pAcceptLoop() {
            while (running && !p2pServerSocket.isClosed()) {
                try (Socket peerSocket = p2pServerSocket.accept();
                     BufferedReader reader = new BufferedReader(
                             new InputStreamReader(peerSocket.getInputStream(), StandardCharsets.UTF_8))) {
                    String jsonLine = reader.readLine();
                    if (jsonLine != null && !jsonLine.isBlank()) {
                        deliverToUser(username, jsonLine);
                    }
                } catch (IOException e) {
                    if (running) {
                        System.err.println("[P2P-NODE] Accept error on " + username + ": " + e.getMessage());
                    }
                }
            }
        }

        private void runMulticastReceiveLoop() {
            byte[] buffer = new byte[MAX_UDP_PACKET_SIZE];
            while (running && !multicastSocket.isClosed()) {
                try {
                    DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                    multicastSocket.receive(packet);
                    String raw = new String(packet.getData(), packet.getOffset(), packet.getLength(), StandardCharsets.UTF_8);
                    if (!raw.startsWith("MCAST|")) continue;
                    int secondBar = raw.indexOf('|', 6);
                    if (secondBar < 0) continue;
                    String groupId = raw.substring(6, secondBar);
                    // Chỉ nhận gói tin Multicast của những nhóm mà user này đang tham gia (đã joinGroup và chưa leaveGroup)
                    if (!joinedGroups.containsKey(groupId)) continue;
                    String jsonPayload = raw.substring(secondBar + 1);
                    Set<String> tracker = this.currentTracker;
                    if (tracker != null) {
                        if (!tracker.add(username)) continue;
                    }
                    deliverToUser(username, jsonPayload);
                } catch (IOException e) {
                    if (running) {
                        // Socket closed on logout
                    }
                }
            }
        }

        private synchronized void close() {
            running = false;
            for (Map.Entry<String, String> entry : new ArrayList<>(joinedGroups.entrySet())) {
                try {
                    InetAddress addr = InetAddress.getByName(entry.getValue());
                    InetSocketAddress sockAddr = new InetSocketAddress(addr, MULTICAST_PORT);
                    if (multicastInterface != null) multicastSocket.leaveGroup(sockAddr, multicastInterface);
                } catch (IOException ignored) { }
            }
            joinedGroups.clear();
            try { p2pServerSocket.close(); } catch (IOException ignored) { }
            try { multicastSocket.close(); } catch ( Exception ignored) { }
        }
    }
}

