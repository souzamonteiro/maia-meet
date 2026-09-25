#include "maia/srtp_context.hpp"
#include <cstring>
#include <stdexcept>

namespace maia {

SrtpContext::~SrtpContext() {
    if (sendSession_) srtp_dealloc(sendSession_);
    if (recvSession_) srtp_dealloc(recvSession_);
}

void SrtpContext::init(const DtlsTransport::KeyingMaterial& km, bool isClient) {
    // The SFU is always the DTLS server (passive).
    // isClient=true means the browser is the DTLS client, which is always the case.
    //
    // DTLS-SRTP keying material layout (RFC 5764 §4.2):
    //   client_write_key  [16]
    //   server_write_key  [16]
    //   client_write_salt [14]
    //   server_write_salt [14]
    //
    // Inbound (browser → SFU): use client_write_key + client_write_salt
    // Outbound (SFU → browser): use server_write_key + server_write_salt

    // Receive session: inbound SRTP from browser
    {
        uint8_t recvKey[30];
        if (isClient) {
            // Browser is client; we receive using client keying material
            memcpy(recvKey,      km.clientKey.data(),  16);
            memcpy(recvKey + 16, km.clientSalt.data(), 14);
        } else {
            memcpy(recvKey,      km.serverKey.data(),  16);
            memcpy(recvKey + 16, km.serverSalt.data(), 14);
        }

        srtp_policy_t policy;
        memset(&policy, 0, sizeof(policy));
        srtp_crypto_policy_set_aes_cm_128_hmac_sha1_80(&policy.rtp);
        srtp_crypto_policy_set_aes_cm_128_hmac_sha1_80(&policy.rtcp);
        policy.ssrc.type   = ssrc_any_inbound;
        policy.key         = recvKey;
        policy.window_size = 128;
        policy.allow_repeat_tx = 0;
        policy.next = nullptr;

        srtp_err_status_t stat = srtp_create(&recvSession_, &policy);
        if (stat != srtp_err_status_ok) {
            throw std::runtime_error("Failed to create SRTP recv session");
        }
    }

    // Send session: outbound SRTP toward browser
    {
        uint8_t sendKey[30];
        if (isClient) {
            // We send using server keying material
            memcpy(sendKey,      km.serverKey.data(),  16);
            memcpy(sendKey + 16, km.serverSalt.data(), 14);
        } else {
            memcpy(sendKey,      km.clientKey.data(),  16);
            memcpy(sendKey + 16, km.clientSalt.data(), 14);
        }

        srtp_policy_t policy;
        memset(&policy, 0, sizeof(policy));
        srtp_crypto_policy_set_aes_cm_128_hmac_sha1_80(&policy.rtp);
        srtp_crypto_policy_set_aes_cm_128_hmac_sha1_80(&policy.rtcp);
        policy.ssrc.type   = ssrc_any_outbound;
        policy.key         = sendKey;
        policy.window_size = 128;
        policy.allow_repeat_tx = 1; // allow retransmission
        policy.next = nullptr;

        srtp_err_status_t stat = srtp_create(&sendSession_, &policy);
        if (stat != srtp_err_status_ok) {
            if (recvSession_) { srtp_dealloc(recvSession_); recvSession_ = nullptr; }
            throw std::runtime_error("Failed to create SRTP send session");
        }
    }

    initialized_ = true;
}

bool SrtpContext::protect(uint8_t* buf, int* len) {
    if (!initialized_) return false;
    return srtp_protect(sendSession_, buf, len) == srtp_err_status_ok;
}

bool SrtpContext::unprotect(uint8_t* buf, int* len) {
    if (!initialized_) return false;
    return srtp_unprotect(recvSession_, buf, len) == srtp_err_status_ok;
}

bool SrtpContext::protectRtcp(uint8_t* buf, int* len) {
    if (!initialized_) return false;
    return srtp_protect_rtcp(sendSession_, buf, len) == srtp_err_status_ok;
}

bool SrtpContext::unprotectRtcp(uint8_t* buf, int* len) {
    if (!initialized_) return false;
    return srtp_unprotect_rtcp(recvSession_, buf, len) == srtp_err_status_ok;
}

} // namespace maia
