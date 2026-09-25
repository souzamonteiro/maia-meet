#pragma once
#include <cstdint>
#include <cstddef>

namespace maia {

struct RtpPacket {
    static constexpr size_t MIN_HEADER_SIZE = 12;
    static bool isRtp(const uint8_t* buf, size_t len);
    static bool isRtcp(const uint8_t* buf, size_t len);
    
    RtpPacket(uint8_t* data, size_t size) : data_(data), size_(size) {}
    
    uint8_t  version() const;
    bool     padding() const;
    bool     extension() const;
    uint8_t  csrcCount() const;
    bool     marker() const;
    uint8_t  payloadType() const;
    uint16_t sequenceNumber() const;
    uint32_t timestamp() const;
    uint32_t ssrc() const;
    const uint8_t* payload() const;
    size_t   payloadSize() const;
    
    void setSequenceNumber(uint16_t seq);
    void setTimestamp(uint32_t ts);
    void setSsrc(uint32_t ssrc);

    uint8_t* data() { return data_; }
    size_t size() const { return size_; }

private:
    uint8_t* data_;
    size_t   size_;
};

} // namespace maia
