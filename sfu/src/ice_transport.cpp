#include "maia/ice_transport.hpp"
#include <stdexcept>
#include <cstring>

namespace maia {

IceTransport::IceTransport(const Config& cfg) {
    juice_config_t config;
    memset(&config, 0, sizeof(config));
    config.bind_address = cfg.udpBindAddress.c_str();
    config.local_port_range_begin = cfg.udpPortMin;
    config.local_port_range_end = cfg.udpPortMax;
    config.stun_server_host = "stun.l.google.com";
    config.stun_server_port = 19302;
    config.cb_state_changed = onStateChangeCb;
    config.cb_candidate = onCandidateCb;
    config.cb_gathering_done = onGatheringDoneCb;
    config.cb_recv = onRecvCb;
    config.user_ptr = this;

    agent_ = juice_create(&config);
    if (!agent_) {
        throw std::runtime_error("Failed to create juice agent");
    }
}

IceTransport::~IceTransport() {
    if (agent_) juice_destroy(agent_);
}

void IceTransport::onStateChange(StateCallback cb) { stateCallback_ = cb; }
void IceTransport::onData(DataCallback cb) { dataCallback_ = cb; }
void IceTransport::onGatheringDone(GatheringDoneCallback cb) { gatheringDoneCallback_ = cb; }

void IceTransport::start() {
    juice_gather_candidates(agent_);
}

std::string IceTransport::getLocalDescription() const {
    char sdp[2048] = {};
    juice_get_local_description(agent_, sdp, sizeof(sdp));
    return sdp;
}

// Parse a field (e.g. "ice-ufrag" or "ice-pwd") from an SDP/SDP-fragment string.
static std::string parseSdpField(const std::string& sdp, const std::string& attr) {
    const std::string prefix = "a=" + attr + ":";
    auto pos = sdp.find(prefix);
    if (pos == std::string::npos) return {};
    pos += prefix.size();
    auto end = sdp.find_first_of("\r\n", pos);
    return sdp.substr(pos, end - pos);
}

std::string IceTransport::getLocalUfrag() const {
    return parseSdpField(getLocalDescription(), "ice-ufrag");
}

std::string IceTransport::getLocalPwd() const {
    return parseSdpField(getLocalDescription(), "ice-pwd");
}

void IceTransport::setRemoteDescription(const std::string& sdpFrag) {
    juice_set_remote_description(agent_, sdpFrag.c_str());
}

void IceTransport::addRemoteCandidate(const std::string& candidate) {
    juice_add_remote_candidate(agent_, candidate.c_str());
}

void IceTransport::send(const uint8_t* data, size_t len) {
    juice_send(agent_, reinterpret_cast<const char*>(data), len);
}

void IceTransport::onStateChangeCb(juice_agent_t*, juice_state_t state, void* user) {
    auto self = static_cast<IceTransport*>(user);
    if (self->stateCallback_) self->stateCallback_(state);
}

void IceTransport::onCandidateCb(juice_agent_t*, const char*, void*) {
}

void IceTransport::onGatheringDoneCb(juice_agent_t*, void* user) {
    auto self = static_cast<IceTransport*>(user);
    if (self->gatheringDoneCallback_) self->gatheringDoneCallback_();
}

void IceTransport::onRecvCb(juice_agent_t*, const char* data, size_t len, void* user) {
    auto self = static_cast<IceTransport*>(user);
    if (self->dataCallback_) self->dataCallback_(reinterpret_cast<const uint8_t*>(data), len);
}

} // namespace maia
