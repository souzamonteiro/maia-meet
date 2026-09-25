#pragma once
#include "rtp_packet.hpp"

namespace maia {

class RtpRewriter {
public:
    void reset();
    void rewrite(RtpPacket& pkt);
private:
    bool initialized_ = false;
    uint16_t seqOffset_ = 0;
    uint32_t tsOffset_ = 0;
    uint16_t lastInSeq_ = 0;
    uint32_t lastInTs_ = 0;
    uint16_t lastOutSeq_ = 0;
    uint32_t lastOutTs_ = 0;
};

} // namespace maia
