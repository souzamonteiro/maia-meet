#pragma once
#include <functional>
#include <vector>
#include <string>
#include <array>
#include <openssl/ssl.h>
#include <openssl/err.h>

namespace maia {

class DtlsTransport {
public:
    struct KeyingMaterial {
        std::array<uint8_t, 16> clientKey;
        std::array<uint8_t, 14> clientSalt;
        std::array<uint8_t, 16> serverKey;
        std::array<uint8_t, 14> serverSalt;
    };
    
    static void globalInit();
    static std::string getFingerprint();
    
    using HandshakeCallback = std::function<void(KeyingMaterial)>;
    
    DtlsTransport();
    ~DtlsTransport();
    
    void onHandshakeComplete(HandshakeCallback cb);
    void feedData(const uint8_t* data, size_t len);
    void setSendCallback(std::function<void(const uint8_t*, size_t)> cb);
    void startHandshake();
    
private:
    static SSL_CTX*   sslCtx_;
    static X509*      cert_;
    static EVP_PKEY*  pkey_;
    static std::string fingerprint_;
    
    SSL*    ssl_   = nullptr;
    BIO*    inBio_ = nullptr;
    BIO*    outBio_= nullptr;
    
    HandshakeCallback handshakeCallback_;
    std::function<void(const uint8_t*, size_t)> sendCallback_;
    
    bool handshakeDone_ = false;
    void doHandshake();
    void extractKeyingMaterial();
    void flushOutBio();
};

} // namespace maia
