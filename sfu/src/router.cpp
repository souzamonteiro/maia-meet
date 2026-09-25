#include "maia/router.hpp"
#include "maia/rtp_packet.hpp"

namespace maia {

void Router::addPublisher(uint32_t ssrc, const std::string& publisherTransportId) {
    std::lock_guard<std::mutex> lock(mutex_);
    publishers_[ssrc] = publisherTransportId;
}

void Router::removePublisher(uint32_t ssrc) {
    std::lock_guard<std::mutex> lock(mutex_);
    publishers_.erase(ssrc);
    routes_.erase(ssrc);
}

void Router::addSubscription(uint32_t ssrc, WebRtcTransport* subscriberTransport, const std::string& subId) {
    std::lock_guard<std::mutex> lock(mutex_);
    SubscriberEntry entry;
    entry.subId = subId;
    entry.transport = subscriberTransport;
    routes_[ssrc].push_back(std::move(entry));
}

void Router::removeSubscription(const std::string& subId) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& [ssrc, subs] : routes_) {
        subs.erase(
            std::remove_if(subs.begin(), subs.end(), [&](const SubscriberEntry& e) { return e.subId == subId; }),
            subs.end()
        );
    }
}

void Router::route(uint32_t ssrc, const uint8_t* data, size_t len) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = routes_.find(ssrc);
    if (it == routes_.end()) return;
    
    for (auto& sub : it->second) {
        uint8_t buf[1500];
        memcpy(buf, data, len);
        RtpPacket pkt(buf, len);
        sub.rewriter.rewrite(pkt);
        sub.transport->sendRtp(buf, len);
    }
}

} // namespace maia
