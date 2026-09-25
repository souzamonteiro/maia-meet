#pragma once
#include "rtp_rewriter.hpp"
#include <string>
#include <map>
#include <mutex>

namespace maia {

struct Publication {
    std::string id;
    std::string participantId;
    std::string kind;
    uint32_t ssrc = 0;
};

struct Subscription {
    std::string id;
    std::string subscriberParticipantId;
    std::string publicationId;
    RtpRewriter rewriter;
};

struct ConferenceParticipant {
    std::string id;
    std::string displayName;
    std::string transportId;
    std::map<std::string, Publication> publications;
    std::map<std::string, Subscription> subscriptions;
};

class Conference {
public:
    explicit Conference(std::string id);
    const std::string& id() const;
    
    void addParticipant(ConferenceParticipant p);
    void removeParticipant(const std::string& participantId);
    ConferenceParticipant* getParticipant(const std::string& id);
    
    void addPublication(Publication pub);
    Publication* getPublication(const std::string& pubId);
    
private:
    std::string id_;
    std::map<std::string, ConferenceParticipant> participants_;
    std::map<std::string, Publication> publications_;
    std::mutex mutex_;
};

} // namespace maia
