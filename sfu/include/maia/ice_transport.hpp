#pragma once
#include "config.hpp"
#include <functional>
#include <string>
#include <juice/juice.h>

namespace maia {

class IceTransport {
public:
    using StateCallback = std::function<void(juice_state_t)>;
    using DataCallback  = std::function<void(const uint8_t*, size_t)>;
    using GatheringDoneCallback = std::function<void()>;
    
    explicit IceTransport(const Config& cfg);
    ~IceTransport();
    
    void onStateChange(StateCallback cb);
    void onData(DataCallback cb);
    void onGatheringDone(GatheringDoneCallback cb);
    
    void start();
    
    std::string getLocalDescription() const;
    std::string getLocalUfrag() const;
    std::string getLocalPwd() const;
    
    void setRemoteDescription(const std::string& sdpFrag); 
    void addRemoteCandidate(const std::string& candidate);
    
    void send(const uint8_t* data, size_t len);
    
private:
    juice_agent_t* agent_ = nullptr;
    StateCallback stateCallback_;
    DataCallback  dataCallback_;
    GatheringDoneCallback gatheringDoneCallback_;
    
    static void onStateChangeCb(juice_agent_t*, juice_state_t, void* user);
    static void onCandidateCb(juice_agent_t*, const char*, void* user);
    static void onGatheringDoneCb(juice_agent_t*, void* user);
    static void onRecvCb(juice_agent_t*, const char*, size_t, void* user);
};

} // namespace maia
