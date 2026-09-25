#pragma once
#include <string>
#include <cstdint>

namespace maia {

struct Config {
    std::string udpBindAddress = "0.0.0.0";
    uint16_t udpPortMin = 10000;
    uint16_t udpPortMax = 10100;
    std::string controlAddress = "127.0.0.1";
    uint16_t controlPort = 3082;
    std::string logLevel = "info"; // debug, info, warn, error
    static Config fromEnv(); // reads env vars MAIA_UDP_BIND, MAIA_UDP_PORT_MIN, etc.
};

} // namespace maia
