#include "maia/control_server.hpp"
#include <nlohmann/json.hpp>
#include <stdexcept>

using json = nlohmann::json;

namespace maia {

ControlServer::ControlServer(const Config& cfg, ConferenceManager& conferences, Router& router)
    : cfg_(cfg), conferences_(conferences), router_(router) {
    server_ = std::make_unique<httplib::Server>();
    // A second instance must not share this private control API port.
    server_->set_socket_options([](socket_t socket) {
        int reuse = 1;
        setsockopt(socket, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
    });
    setupRoutes();
}

ControlServer::~ControlServer() { stop(); }

void ControlServer::start() {
    if (!server_->bind_to_port(cfg_.controlAddress, cfg_.controlPort))
        throw std::runtime_error("Cannot bind SFU control address/port");
    thread_ = std::thread([this]() { server_->listen_after_bind(); });
}

void ControlServer::stop() {
    server_->stop();
    if (thread_.joinable()) thread_.join();
}

void ControlServer::setupRoutes() {
    server_->Post("/transports", [this](const httplib::Request&, httplib::Response& res) {
        std::string id = "tr_" + std::to_string(std::rand());
        auto transport = std::make_shared<WebRtcTransport>(id, cfg_);
        transports_[id] = transport;
        
        auto info = transport->info();
        json j = {
            {"transportId", info.id},
            {"iceUfrag", info.iceUfrag},
            {"icePwd", info.icePwd},
            {"dtlsFingerprint", info.dtlsFingerprint},
            {"sdpAnswer", info.sdpAnswer}
        };
        res.set_content(j.dump(), "application/json");
    });
    
    server_->Delete(R"(/transports/(.*))", [this](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        if (transports_.erase(id)) {
            res.status = 200;
        } else {
            res.status = 404;
        }
    });
    
    server_->Post(R"(/transports/(.*)/remote-description)", [this](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        auto it = transports_.find(id);
        if (it != transports_.end()) {
            json j = json::parse(req.body);
            it->second->setRemoteDescription(j["sdp"]);
            res.status = 200;
        } else {
            res.status = 404;
        }
    });
    
    server_->Post(R"(/transports/(.*)/ice-candidate)", [this](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        auto it = transports_.find(id);
        if (it != transports_.end()) {
            json j = json::parse(req.body);
            it->second->addIceCandidate(j["candidate"]);
            res.status = 200;
        } else {
            res.status = 404;
        }
    });
    
    server_->Get("/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(R"({"status": "ok"})", "application/json");
    });
}

} // namespace maia
