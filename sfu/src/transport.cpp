#include "maia/transport.hpp"
#include "maia/rtp_packet.hpp"
#include <iostream>

namespace maia {

WebRtcTransport::WebRtcTransport(std::string id, const Config& cfg)
    : id_(std::move(id)), cfg_(cfg) {
    ice_ = std::make_unique<IceTransport>(cfg);
    dtls_ = std::make_unique<DtlsTransport>();
    srtp_ = std::make_unique<SrtpContext>();

    ice_->onStateChange([this](juice_state_t state) { onIceStateChange(state); });
    ice_->onData([this](const uint8_t* data, size_t len) { classifyAndDispatch(data, len); });
    ice_->onGatheringDone([this]() { transition(TransportState::ICE_GATHERING); });

    dtls_->setSendCallback([this](const uint8_t* data, size_t len) { ice_->send(data, len); });
    dtls_->onHandshakeComplete([this](DtlsTransport::KeyingMaterial km) { onDtlsHandshakeComplete(km); });
    
    ice_->start();
}

const std::string& WebRtcTransport::id() const { return id_; }
TransportState WebRtcTransport::state() const { return state_; }

TransportInfo WebRtcTransport::info() const {
    TransportInfo info;
    info.id = id_;
    info.iceUfrag = ice_->getLocalUfrag();
    info.icePwd = ice_->getLocalPwd();
    info.dtlsFingerprint = DtlsTransport::getFingerprint();
    info.sdpAnswer = buildSdpAnswer();
    return info;
}

void WebRtcTransport::setRemoteDescription(const std::string& sdp) {
    ice_->setRemoteDescription(sdp);
}

void WebRtcTransport::addIceCandidate(const std::string& candidate) {
    ice_->addRemoteCandidate(candidate);
}

void WebRtcTransport::sendRtp(const uint8_t* data, size_t len) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (state_ != TransportState::CONNECTED) return;
    
    if (len > 1400) return; // Leave room for SRTP authentication data.
    uint8_t buf[1500];
    memcpy(buf, data, len);
    int pLen = len;
    if (srtp_->protect(buf, &pLen)) {
        ice_->send(buf, pLen);
    }
}

void WebRtcTransport::sendRtcp(const uint8_t* data, size_t len) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (state_ != TransportState::CONNECTED) return;
    
    if (len > 1400) return; // Leave room for SRTP authentication data.
    uint8_t buf[1500];
    memcpy(buf, data, len);
    int pLen = len;
    if (srtp_->protectRtcp(buf, &pLen)) {
        ice_->send(buf, pLen);
    }
}

void WebRtcTransport::onPacket(const uint8_t* data, size_t len) {
    // Usually UdpServer dispatches ICE packets to here
    ice_->send(data, len);
}

void WebRtcTransport::onPublisherRtp(RtpCallback cb) {
    std::lock_guard<std::mutex> lock(mutex_);
    rtpCallback_ = std::move(cb);
}

void WebRtcTransport::close() {
    std::lock_guard<std::mutex> lock(mutex_);
    transition(TransportState::CLOSED);
}

void WebRtcTransport::transition(TransportState newState) {
    state_ = newState;
}

void WebRtcTransport::classifyAndDispatch(const uint8_t* data, size_t len) {
    if (len == 0) return;
    uint8_t b = data[0];
    if (b >= 20 && b <= 63) {
        dtls_->feedData(data, len);
    } else if (b >= 128 && b <= 191) {
        if (RtpPacket::isRtp(data, len)) {
            onRtp(data, len);
        } else if (RtpPacket::isRtcp(data, len)) {
            onRtcp(data, len);
        }
    }
}

void WebRtcTransport::onIceStateChange(juice_state_t state) {
    if (state == JUICE_STATE_CONNECTED) {
        transition(TransportState::ICE_CONNECTED);
        dtls_->startHandshake();
    } else if (state == JUICE_STATE_FAILED) {
        transition(TransportState::FAILED);
    }
}

void WebRtcTransport::onDtlsHandshakeComplete(DtlsTransport::KeyingMaterial km) {
    srtp_->init(km, false);
    transition(TransportState::CONNECTED);
}

void WebRtcTransport::onRtp(const uint8_t* data, size_t len) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (state_ != TransportState::CONNECTED) return;
    
    if (len > 1400) return; // Leave room for SRTP authentication data.
    uint8_t buf[1500];
    memcpy(buf, data, len);
    int pLen = len;
    if (srtp_->unprotect(buf, &pLen)) {
        if (rtpCallback_) rtpCallback_(buf, pLen);
    }
}

void WebRtcTransport::onRtcp(const uint8_t* data, size_t len) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (state_ != TransportState::CONNECTED) return;
    
    if (len > 1400) return; // Leave room for SRTP authentication data.
    uint8_t buf[1500];
    memcpy(buf, data, len);
    int pLen = len;
    srtp_->unprotectRtcp(buf, &pLen);
}

std::string WebRtcTransport::buildSdpAnswer() const {
    return "v=0\r\n"
           "o=- 0 0 IN IP4 0.0.0.0\r\n"
           "s=MaiaSFU\r\n"
           "t=0 0\r\n"
           "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
           "c=IN IP4 0.0.0.0\r\n"
           "a=rtcp:9 IN IP4 0.0.0.0\r\n"
           "a=ice-ufrag:" + ice_->getLocalUfrag() + "\r\n"
           "a=ice-pwd:" + ice_->getLocalPwd() + "\r\n"
           "a=fingerprint:sha-256 " + DtlsTransport::getFingerprint() + "\r\n"
           "a=setup:passive\r\n"
           "a=sendrecv\r\n"
           "a=rtpmap:111 opus/48000/2\r\n"
           "m=video 9 UDP/TLS/RTP/SAVPF 96\r\n"
           "c=IN IP4 0.0.0.0\r\n"
           "a=rtcp:9 IN IP4 0.0.0.0\r\n"
           "a=ice-ufrag:" + ice_->getLocalUfrag() + "\r\n"
           "a=ice-pwd:" + ice_->getLocalPwd() + "\r\n"
           "a=fingerprint:sha-256 " + DtlsTransport::getFingerprint() + "\r\n"
           "a=setup:passive\r\n"
           "a=sendrecv\r\n"
           "a=rtpmap:96 VP8/90000\r\n";
}

} // namespace maia
