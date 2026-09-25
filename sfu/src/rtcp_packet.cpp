#include "maia/rtcp_packet.hpp"
#include <arpa/inet.h>

namespace maia {

uint32_t RtcpPacket::getSenderSsrc(const uint8_t* data, size_t len) {
    if (len < 8) return 0;
    return ntohl(*reinterpret_cast<const uint32_t*>(data + 4));
}

uint32_t RtcpPacket::getMediaSsrc(const uint8_t* data, size_t len) {
    if (len < 12) return 0;
    return ntohl(*reinterpret_cast<const uint32_t*>(data + 8));
}

} // namespace maia
