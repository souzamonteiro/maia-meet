#include "maia/rtp_rewriter.hpp"

namespace maia {

void RtpRewriter::reset() {
    initialized_ = false;
}

void RtpRewriter::rewrite(RtpPacket& pkt) {
    if (!initialized_) {
        seqOffset_ = pkt.sequenceNumber() - (lastOutSeq_ + 1);
        tsOffset_ = pkt.timestamp() - (lastOutTs_ + 90000); // approx
        initialized_ = true;
    }
    
    lastInSeq_ = pkt.sequenceNumber();
    lastInTs_ = pkt.timestamp();
    
    lastOutSeq_ = lastInSeq_ - seqOffset_;
    lastOutTs_ = lastInTs_ - tsOffset_;
    
    pkt.setSequenceNumber(lastOutSeq_);
    pkt.setTimestamp(lastOutTs_);
}

} // namespace maia
