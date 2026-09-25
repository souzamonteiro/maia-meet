#pragma once
#include "config.hpp"
#include "ice_transport.hpp"
#include "dtls_transport.hpp"
#include "srtp_context.hpp"
#include <string>
#include <memory>
#include <mutex>

namespace maia {

enum class TransportState {
    NEW, ICE_GATHERING, ICE_CONNECTING, ICE_CONNECTED,
    DTLS_CONNECTING, DTLS_CONNECTED, SRTP_READY, CONNECTED, CLOSED, FAILED
};

struct TransportInfo {
    std::string id;
    std::string iceUfrag;
    std::string icePwd;
    std::string dtlsFingerprint;
    std::string sdpAnswer; 
};

class WebRtcTransport {
public:
    explicit WebRtcTransport(std::string id, const Config& cfg);
    
    const std::string& id() const;
    TransportState state() const;
    TransportInfo info() const;
    
    void setRemoteDescription(const std::string& sdp);
    void addIceCandidate(const std::string& candidate);
    
    void sendRtp(const uint8_t* data, size_t len);
    void sendRtcp(const uint8_t* data, size_t len);
    
    void onPacket(const uint8_t* data, size_t len);
    
    using RtpCallback = std::function<void(const uint8_t*, size_t)>;
    void onPublisherRtp(RtpCallback cb);
    
    void close();
    
private:
    std::string id_;
    Config cfg_;
    TransportState state_ = TransportState::NEW;
    
    std::unique_ptr<IceTransport>  ice_;
    std::unique_ptr<DtlsTransport> dtls_;
    std::unique_ptr<SrtpContext>   srtp_;
    
    RtpCallback rtpCallback_;
    
    void transition(TransportState newState);
    void classifyAndDispatch(const uint8_t* data, size_t len);
    void onIceData(const uint8_t* data, size_t len);
    void onIceStateChange(juice_state_t state);
    void onDtlsHandshakeComplete(DtlsTransport::KeyingMaterial km);
    void onRtp(const uint8_t* data, size_t len);
    void onRtcp(const uint8_t* data, size_t len);
    
    std::string buildSdpAnswer() const;
    
    std::mutex mutex_;
};

} // namespace maia
