#include "maia/config.hpp"
#include "maia/dtls_transport.hpp"
#include "maia/conference_manager.hpp"
#include "maia/router.hpp"
#include "maia/control_server.hpp"
#include "maia/udp_server.hpp"
#include <iostream>
#include <csignal>
#include <thread>
#include <chrono>
#include <atomic>

using namespace maia;

std::atomic<bool> keepRunning{true};
void sigHandler(int) { keepRunning = false; }

int main() try {
    DtlsTransport::globalInit();
    Config cfg = Config::fromEnv();

    ConferenceManager conferences;
    Router router;

    ControlServer control(cfg, conferences, router);
    control.start();

    std::cout << "Experimental Maia SFU control=" << cfg.controlAddress << ":" << cfg.controlPort
              << " ICE UDP range=" << cfg.udpPortMin << "-" << cfg.udpPortMax << "\n";

    signal(SIGTERM, sigHandler);
    signal(SIGINT, sigHandler);

    // libjuice owns the ICE sockets; do not reserve a dummy media socket.

    while (keepRunning) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    control.stop();

    return 0;
}
 catch (const std::exception& error) {
    std::cerr << "Maia SFU startup failed: " << error.what() << "\n";
    return 1;
}
