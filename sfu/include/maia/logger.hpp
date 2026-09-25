#pragma once
#include <iostream>
#include <mutex>
#include <string>
#include <sstream>

namespace maia {

class Logger {
public:
    static Logger& instance() {
        static Logger inst;
        return inst;
    }

    template<typename... Args>
    void log(const std::string& level, const std::string& transportId, uint32_t ssrc, const std::string& msg, Args... args) {
        std::lock_guard<std::mutex> lock(mutex_);
        std::cerr << "[" << level << "] transportId=" << transportId << " ssrc=" << ssrc << " " << msg;
        printArgs(args...);
        std::cerr << std::endl;
    }

private:
    std::mutex mutex_;
    void printArgs() {}
    template<typename T, typename... Rest>
    void printArgs(T key, Rest... rest) {
        std::cerr << " " << key;
        printArgs(rest...);
    }
};

#define LOG_INFO(tid, ssrc, msg, ...) maia::Logger::instance().log("INFO", tid, ssrc, msg, ##__VA_ARGS__)
#define LOG_WARN(tid, ssrc, msg, ...) maia::Logger::instance().log("WARN", tid, ssrc, msg, ##__VA_ARGS__)
#define LOG_ERROR(tid, ssrc, msg, ...) maia::Logger::instance().log("ERROR", tid, ssrc, msg, ##__VA_ARGS__)
#define LOG_DEBUG(tid, ssrc, msg, ...) maia::Logger::instance().log("DEBUG", tid, ssrc, msg, ##__VA_ARGS__)

} // namespace maia
