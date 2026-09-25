#pragma once
#include "config.hpp"
#include "conference_manager.hpp"
#include "router.hpp"
#include "transport.hpp"
#include <httplib.h>
#include <thread>
#include <memory>
#include <map>
#include <string>

namespace maia {

class ControlServer {
public:
    ControlServer(const Config& cfg, ConferenceManager& conferences, Router& router);
    ~ControlServer();
    
    void start();
    void stop();
    
private:
    Config cfg_;
    ConferenceManager& conferences_;
    Router& router_;
    std::unique_ptr<httplib::Server> server_;
    std::thread thread_;
    std::map<std::string, std::shared_ptr<WebRtcTransport>> transports_;
    
    void setupRoutes();
};

} // namespace maia
