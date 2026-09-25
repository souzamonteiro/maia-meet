#include "maia/rtp_packet.hpp"
#include <arpa/inet.h>

namespace maia {

bool RtpPacket::isRtp(const uint8_t* buf, size_t len) {
    if (len < MIN_HEADER_SIZE) return false;
    uint8_t pt = buf[1] & 0x7F;
    return (buf[0] >> 6 == 2) && (pt < 64 || pt >= 96);
}

bool RtpPacket::isRtcp(const uint8_t* buf, size_t len) {
    if (len < MIN_HEADER_SIZE) return false;
    uint8_t pt = buf[1] & 0x7F;
    return (buf[0] >> 6 == 2) && (pt >= 64 && pt < 96);
}

uint8_t RtpPacket::version() const { return data_[0] >> 6; }
bool RtpPacket::padding() const { return (data_[0] >> 5) & 1; }
bool RtpPacket::extension() const { return (data_[0] >> 4) & 1; }
uint8_t RtpPacket::csrcCount() const { return data_[0] & 0x0F; }
bool RtpPacket::marker() const { return (data_[1] >> 7) & 1; }
uint8_t RtpPacket::payloadType() const { return data_[1] & 0x7F; }
uint16_t RtpPacket::sequenceNumber() const { return ntohs(*reinterpret_cast<const uint16_t*>(data_ + 2)); }
uint32_t RtpPacket::timestamp() const { return ntohl(*reinterpret_cast<const uint32_t*>(data_ + 4)); }
uint32_t RtpPacket::ssrc() const { return ntohl(*reinterpret_cast<const uint32_t*>(data_ + 8)); }

const uint8_t* RtpPacket::payload() const {
    size_t offset = MIN_HEADER_SIZE + csrcCount() * 4;
    if (extension() && size_ > offset + 4) {
        uint16_t extLen = ntohs(*reinterpret_cast<const uint16_t*>(data_ + offset + 2));
        offset += 4 + extLen * 4;
    }
    return data_ + offset;
}

size_t RtpPacket::payloadSize() const {
    const uint8_t* p = payload();
    if (p >= data_ + size_) return 0;
    return (data_ + size_) - p;
}

void RtpPacket::setSequenceNumber(uint16_t seq) {
    *reinterpret_cast<uint16_t*>(data_ + 2) = htons(seq);
}

void RtpPacket::setTimestamp(uint32_t ts) {
    *reinterpret_cast<uint32_t*>(data_ + 4) = htonl(ts);
}

void RtpPacket::setSsrc(uint32_t ssrc) {
    *reinterpret_cast<uint32_t*>(data_ + 8) = htonl(ssrc);
}

} // namespace maia
