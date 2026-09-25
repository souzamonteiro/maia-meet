#pragma once
#include "transport.hpp"
#include "rtp_rewriter.hpp"
#include <map>
#include <vector>
#include <mutex>

namespace maia {

class Router {
public:
    void addPublisher(uint32_t ssrc, const std::string& publisherTransportId);
    void removePublisher(uint32_t ssrc);
    
    void addSubscription(uint32_t ssrc, WebRtcTransport* subscriberTransport, const std::string& subId);
    void removeSubscription(const std::string& subId);
    
    void route(uint32_t ssrc, const uint8_t* data, size_t len);
    
private:
    struct SubscriberEntry {
        std::string subId;
        WebRtcTransport* transport;
        RtpRewriter rewriter;
    };
    
    std::map<uint32_t, std::string> publishers_;
    std::map<uint32_t, std::vector<SubscriberEntry>> routes_;
    std::mutex mutex_;
};

} // namespace maia
