#include "maia/conference_manager.hpp"

namespace maia {

Conference* ConferenceManager::getOrCreate(const std::string& conferenceId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = conferences_.find(conferenceId);
    if (it != conferences_.end()) {
        return it->second.get();
    }
    auto conf = std::make_unique<Conference>(conferenceId);
    auto ptr = conf.get();
    conferences_[conferenceId] = std::move(conf);
    return ptr;
}

Conference* ConferenceManager::get(const std::string& conferenceId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = conferences_.find(conferenceId);
    return it != conferences_.end() ? it->second.get() : nullptr;
}

void ConferenceManager::remove(const std::string& conferenceId) {
    std::lock_guard<std::mutex> lock(mutex_);
    conferences_.erase(conferenceId);
}

} // namespace maia
