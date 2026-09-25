.PHONY: all sfu sfu-debug sfu-release signaling install-deps dev-certs clean

all: check-signaling

signaling: check-signaling

# ---------------------------------------------------------------------------
# SFU (C++)
# ---------------------------------------------------------------------------

sfu: ## Build SFU (Debug)
	cmake -S sfu -B build/sfu -DCMAKE_BUILD_TYPE=Debug
	cmake --build build/sfu --parallel

sfu-debug: ## Build SFU with AddressSanitizer + UBSan
	cmake -S sfu -B build/sfu-debug --preset debug
	cmake --build build/sfu-debug --parallel

sfu-release: ## Build SFU optimized release
	cmake -S sfu -B build/sfu-release --preset release
	cmake --build build/sfu-release --parallel

# ---------------------------------------------------------------------------
# Signaling (Node.js)
# ---------------------------------------------------------------------------

install-deps: ## Install Node.js dependencies
	cd signaling && npm install

signaling-dev: install-deps ## Start signaling server in watch mode
	cd signaling && npm run dev

client-serve: signaling-start ## Serve client and WebSocket on the configured PORT

signaling-start: install-deps ## Start signaling server
	cd signaling && npm start

# ---------------------------------------------------------------------------
# Development tools
# ---------------------------------------------------------------------------

dev-certs: ## Generate self-signed TLS certs for local HTTPS development
	bash deploy/generate-dev-certs.sh

check-signaling: install-deps ## Syntax-check signaling source files
	node --check signaling/src/config.js
	node --check signaling/src/logger.js
	node --check signaling/src/rooms.js
	node --check signaling/src/participants.js
	node --check signaling/src/sfu-client.js
	node --check signaling/src/server.js
	@echo "All signaling files passed syntax check."

# ---------------------------------------------------------------------------
# Install system dependencies (Ubuntu 24.04)
# ---------------------------------------------------------------------------

install-system-deps: ## Install system packages needed to build the SFU
	sudo apt update
	sudo apt install -y \
		build-essential cmake ninja-build \
		libssl-dev \
		libsrtp2-dev \
		pkg-config

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

clean: ## Remove build artifacts
	rm -rf build signaling/node_modules deploy/certs

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

configure: ## Interactively configure ports and paths
	node deploy/configure.mjs

test: ## Run HTTP and signaling integration tests
	cd signaling && npm test
