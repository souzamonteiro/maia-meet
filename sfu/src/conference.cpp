#include "maia/conference.hpp"

namespace maia {

Conference::Conference(std::string id) : id_(std::move(id)) {}
const std::string& Conference::id() const { return id_; }

void Conference::addParticipant(ConferenceParticipant p) {
    std::lock_guard<std::mutex> lock(mutex_);
    participants_[p.id] = std::move(p);
}

void Conference::removeParticipant(const std::string& participantId) {
    std::lock_guard<std::mutex> lock(mutex_);
    participants_.erase(participantId);
}

ConferenceParticipant* Conference::getParticipant(const std::string& id) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = participants_.find(id);
    return it != participants_.end() ? &it->second : nullptr;
}

void Conference::addPublication(Publication pub) {
    std::lock_guard<std::mutex> lock(mutex_);
    publications_[pub.id] = std::move(pub);
}

Publication* Conference::getPublication(const std::string& pubId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = publications_.find(pubId);
    return it != publications_.end() ? &it->second : nullptr;
}

} // namespace maia
