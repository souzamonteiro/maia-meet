#pragma once
#include <functional>
#include <string>
#include <atomic>
#include <sys/socket.h>
#include <netinet/in.h>

namespace maia {

class UdpServer {
public:
    using PacketCallback = std::function<void(const sockaddr_storage&, const uint8_t*, size_t)>;
    
    UdpServer(const std::string& bindAddress, uint16_t port);
    ~UdpServer();
    
    void onPacket(PacketCallback cb);
    void send(const sockaddr_storage& addr, const uint8_t* data, size_t len);
    
    void run();
    void stop();
    
private:
    int sockFd_ = -1;
    int epollFd_ = -1;
    int stopPipe_[2] = {-1, -1};
    PacketCallback callback_;
    std::atomic<bool> running_{false};
};

} // namespace maia
