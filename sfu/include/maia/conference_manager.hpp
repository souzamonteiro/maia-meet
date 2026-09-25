#pragma once
#include "conference.hpp"
#include <map>
#include <memory>
#include <mutex>
#include <string>

namespace maia {

class ConferenceManager {
public:
    Conference* getOrCreate(const std::string& conferenceId);
    Conference* get(const std::string& conferenceId);
    void remove(const std::string& conferenceId);
private:
    std::map<std::string, std::unique_ptr<Conference>> conferences_;
    std::mutex mutex_;
};

} // namespace maia
