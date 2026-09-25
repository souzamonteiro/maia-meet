#pragma once
#include "dtls_transport.hpp"
#include <srtp2/srtp.h>
#include <cstdint>

namespace maia {

// SrtpContext maintains two libsrtp sessions: one for protecting outbound RTP
// and one for unprotecting inbound RTP. This is required because libsrtp
// needs to know the SSRC direction for correct key/salt assignment.
class SrtpContext {
public:
    SrtpContext() {
        static bool srtpInitialized = false;
        if (!srtpInitialized) {
            srtp_init();
            srtpInitialized = true;
        }
    }
    ~SrtpContext();

    // isClient: true if the remote peer is the DTLS client (browser).
    // The SFU is always the DTLS server (passive), so isClient=true for the
    // browser's perspective — we use the client keying material for inbound
    // (unprotect) and server keying material for outbound (protect).
    void init(const DtlsTransport::KeyingMaterial& km, bool isClient);

    // Returns false if operation fails (malformed/replayed packet, etc.)
    bool protect(uint8_t* buf, int* len);       // RTP outbound
    bool unprotect(uint8_t* buf, int* len);     // RTP inbound
    bool protectRtcp(uint8_t* buf, int* len);   // RTCP outbound
    bool unprotectRtcp(uint8_t* buf, int* len); // RTCP inbound

private:
    srtp_t sendSession_ = nullptr;  // for protect (outbound)
    srtp_t recvSession_ = nullptr;  // for unprotect (inbound)
    bool initialized_ = false;
};

} // namespace maia
