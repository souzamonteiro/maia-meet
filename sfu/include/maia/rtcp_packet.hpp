#pragma once
#include <cstdint>
#include <cstddef>

namespace maia {

enum class RtcpType : uint8_t {
    SR = 200,
    RR = 201,
    SDES = 202,
    BYE = 203,
    APP = 204,
    RTPFB = 205, // NACK
    PSFB = 206   // PLI
};

struct RtcpPacket {
    static uint32_t getSenderSsrc(const uint8_t* data, size_t len);
    static uint32_t getMediaSsrc(const uint8_t* data, size_t len);
};

} // namespace maia
