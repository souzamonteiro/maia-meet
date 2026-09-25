#include "maia/config.hpp"
#include <cstdlib>
#include <stdexcept>
#include <string_view>

namespace maia {
namespace {
uint16_t portFromEnv(const char* name, uint16_t fallback) {
    const char* raw = std::getenv(name);
    if (!raw) return fallback;
    const std::string value(raw);
    if (value.empty() || value.find_first_not_of("0123456789") != std::string::npos)
        throw std::runtime_error(std::string(name) + " must be a port between 1 and 65535");
    const auto port = std::stoul(value);
    if (port < 1 || port > 65535)
        throw std::runtime_error(std::string(name) + " must be a port between 1 and 65535");
    return static_cast<uint16_t>(port);
}
}
Config Config::fromEnv() {
    Config cfg;
    if (const char* env = std::getenv("MAIA_UDP_BIND")) cfg.udpBindAddress = env;
    cfg.udpPortMin = portFromEnv("MAIA_UDP_PORT_MIN", cfg.udpPortMin);
    cfg.udpPortMax = portFromEnv("MAIA_UDP_PORT_MAX", cfg.udpPortMax);
    if (cfg.udpPortMin > cfg.udpPortMax) throw std::runtime_error("MAIA_UDP_PORT_MIN must be <= MAIA_UDP_PORT_MAX");
    if (const char* env = std::getenv("MAIA_CONTROL_BIND")) cfg.controlAddress = env;
    cfg.controlPort = portFromEnv("MAIA_CONTROL_PORT", cfg.controlPort);
    if (const char* env = std::getenv("MAIA_LOG_LEVEL")) cfg.logLevel = env;
    return cfg;
}
} // namespace maia
