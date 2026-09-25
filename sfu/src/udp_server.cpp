#include "maia/udp_server.hpp"
#include <sys/epoll.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdexcept>
#include <arpa/inet.h>
#include <iostream>

namespace maia {

UdpServer::UdpServer(const std::string& bindAddress, uint16_t port) {
    sockFd_ = socket(AF_INET, SOCK_DGRAM | SOCK_NONBLOCK, 0);
    if (sockFd_ < 0) throw std::runtime_error("Failed to create socket");
    
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    inet_pton(AF_INET, bindAddress.c_str(), &addr.sin_addr);
    
    if (bind(sockFd_, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        throw std::runtime_error("Failed to bind socket");
    }
    
    epollFd_ = epoll_create1(0);
    if (pipe2(stopPipe_, O_NONBLOCK) < 0) throw std::runtime_error("Failed to create pipe");
    
    epoll_event ev{};
    ev.events = EPOLLIN;
    ev.data.fd = sockFd_;
    epoll_ctl(epollFd_, EPOLL_CTL_ADD, sockFd_, &ev);
    
    ev.data.fd = stopPipe_[0];
    epoll_ctl(epollFd_, EPOLL_CTL_ADD, stopPipe_[0], &ev);
}

UdpServer::~UdpServer() {
    stop();
    if (sockFd_ >= 0) close(sockFd_);
    if (epollFd_ >= 0) close(epollFd_);
    if (stopPipe_[0] >= 0) close(stopPipe_[0]);
    if (stopPipe_[1] >= 0) close(stopPipe_[1]);
}

void UdpServer::onPacket(PacketCallback cb) { callback_ = std::move(cb); }

void UdpServer::send(const sockaddr_storage& addr, const uint8_t* data, size_t len) {
    sendto(sockFd_, data, len, 0, (const struct sockaddr*)&addr, sizeof(addr));
}

void UdpServer::run() {
    running_ = true;
    epoll_event events[10];
    uint8_t buf[8192];
    
    while (running_) {
        int n = epoll_wait(epollFd_, events, 10, -1);
        for (int i = 0; i < n; i++) {
            if (events[i].data.fd == stopPipe_[0]) {
                running_ = false;
                break;
            }
            if (events[i].data.fd == sockFd_) {
                sockaddr_storage srcAddr;
                socklen_t addrLen = sizeof(srcAddr);
                ssize_t len = recvfrom(sockFd_, buf, sizeof(buf), 0, (struct sockaddr*)&srcAddr, &addrLen);
                if (len > 0 && callback_) {
                    callback_(srcAddr, buf, len);
                }
            }
        }
    }
}

void UdpServer::stop() {
    if (!running_) return;
    running_ = false;
    char c = 0;
    write(stopPipe_[1], &c, 1);
}

} // namespace maia
