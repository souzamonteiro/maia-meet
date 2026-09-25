#include "maia/dtls_transport.hpp"
#include <stdexcept>
#include <iostream>

namespace maia {

SSL_CTX* DtlsTransport::sslCtx_ = nullptr;
X509* DtlsTransport::cert_ = nullptr;
EVP_PKEY* DtlsTransport::pkey_ = nullptr;
std::string DtlsTransport::fingerprint_ = "";

void DtlsTransport::globalInit() {
    if (sslCtx_) return;
    SSL_library_init();
    SSL_load_error_strings();
    
    sslCtx_ = SSL_CTX_new(DTLS_server_method());
    if (!sslCtx_) throw std::runtime_error("Failed to create SSL_CTX");
    
    SSL_CTX_set_read_ahead(sslCtx_, 1);
    SSL_CTX_set_tlsext_use_srtp(sslCtx_, "SRTP_AES128_CM_SHA1_80");
    
    // Generate RSA-2048 key — EVP_RSA_gen is the modern API (OpenSSL 3.0+)
    pkey_ = EVP_RSA_gen(2048);
    if (!pkey_) throw std::runtime_error("Failed to generate RSA key");

    cert_ = X509_new();
    X509_set_version(cert_, 2);
    ASN1_INTEGER_set(X509_get_serialNumber(cert_), 1);
    X509_gmtime_adj(X509_get_notBefore(cert_), 0);
    X509_gmtime_adj(X509_get_notAfter(cert_), 31536000L);
    X509_set_pubkey(cert_, pkey_);
    
    X509_name_st* name = X509_get_subject_name(cert_);
    X509_NAME_add_entry_by_txt(name, "O", MBSTRING_ASC, (unsigned char*)"Maia", -1, -1, 0);
    X509_NAME_add_entry_by_txt(name, "CN", MBSTRING_ASC, (unsigned char*)"MaiaSFU", -1, -1, 0);
    X509_set_issuer_name(cert_, name);
    X509_sign(cert_, pkey_, EVP_sha256());
    
    SSL_CTX_use_certificate(sslCtx_, cert_);
    SSL_CTX_use_PrivateKey(sslCtx_, pkey_);
    
    unsigned char md[EVP_MAX_MD_SIZE];
    unsigned int n;
    X509_digest(cert_, EVP_sha256(), md, &n);
    char fp[100];
    for (unsigned int i = 0; i < n; i++) {
        sprintf(fp + (i*3), "%02X:", md[i]);
    }
    fp[n*3-1] = '\0';
    fingerprint_ = fp;
}

std::string DtlsTransport::getFingerprint() {
    return fingerprint_;
}

DtlsTransport::DtlsTransport() {
    ssl_ = SSL_new(sslCtx_);
    inBio_ = BIO_new(BIO_s_mem());
    outBio_ = BIO_new(BIO_s_mem());
    BIO_set_mem_eof_return(inBio_, -1);
    BIO_set_mem_eof_return(outBio_, -1);
    SSL_set_bio(ssl_, inBio_, outBio_);
    SSL_set_accept_state(ssl_);
}

DtlsTransport::~DtlsTransport() {
    if (ssl_) SSL_free(ssl_);
}

void DtlsTransport::onHandshakeComplete(HandshakeCallback cb) { handshakeCallback_ = cb; }

void DtlsTransport::feedData(const uint8_t* data, size_t len) {
    BIO_write(inBio_, data, len);
    if (!handshakeDone_) {
        doHandshake();
    } else {
        // Read decrypted data (not used for SFU since we just extract SRTP keys)
        uint8_t buf[2048];
        while (SSL_read(ssl_, buf, sizeof(buf)) > 0) {}
    }
    flushOutBio();
}

void DtlsTransport::setSendCallback(std::function<void(const uint8_t*, size_t)> cb) {
    sendCallback_ = cb;
}

void DtlsTransport::startHandshake() {
    doHandshake();
}

void DtlsTransport::doHandshake() {
    int ret = SSL_do_handshake(ssl_);
    if (ret == 1) {
        handshakeDone_ = true;
        extractKeyingMaterial();
    } else {
        int err = SSL_get_error(ssl_, ret);
        if (err != SSL_ERROR_WANT_READ && err != SSL_ERROR_WANT_WRITE) {
            std::cerr << "DTLS Handshake error " << err << std::endl;
        }
    }
    flushOutBio();
}

void DtlsTransport::extractKeyingMaterial() {
    KeyingMaterial km;
    uint8_t mat[60];
    SSL_export_keying_material(ssl_, mat, sizeof(mat), "EXTRACTOR-dtls_srtp", 19, nullptr, 0, 0);
    
    // Server is us, Client is remote
    memcpy(km.clientKey.data(), mat, 16);
    memcpy(km.serverKey.data(), mat + 16, 16);
    memcpy(km.clientSalt.data(), mat + 32, 14);
    memcpy(km.serverSalt.data(), mat + 46, 14);
    
    if (handshakeCallback_) handshakeCallback_(km);
}

void DtlsTransport::flushOutBio() {
    uint8_t buf[2048];
    int len;
    while ((len = BIO_read(outBio_, buf, sizeof(buf))) > 0) {
        if (sendCallback_) sendCallback_(buf, len);
    }
}

} // namespace maia
