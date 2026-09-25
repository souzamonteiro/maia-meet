# ADR-0006 — ICE Library: libjuice

**Status:** Accepted

**Date:** 2026-09-25

## Context

Maia SFU requires an ICE/STUN implementation. Three options were evaluated:

| Option | License | Size | Complexity | Notes |
|---|---|---|---|---|
| **libjuice** | MIT | ~5 KLOC | Low | Focused ICE/STUN library, easy to embed via CMake FetchContent |
| libnice | LGPL-2.1 | ~60 KLOC | High | GLib dependency, complex API, not designed for server use |
| Project-owned STUN stub | — | — | Very low | Would not implement full ICE, unsuitable for production |

## Decision

Use **libjuice** (https://github.com/paullouisageneau/libjuice) at a pinned release tag via CMake FetchContent.

## Rationale

- MIT license is compatible with Apache-2.0 project license
- No GNOME/GLib dependency — keeps the build simple
- Designed explicitly for server-side WebRTC ICE
- Small, auditable codebase
- Actively maintained by a WebRTC library author (also maintains libdatachannel)
- FetchContent integration avoids system package version fragmentation

## Consequences

- libjuice is downloaded and built from source during CMake configuration
- CI requires internet access for initial build (or cache via CMake package registry)
- If libjuice becomes unmaintained, migration to another library is isolated to `ice_transport.cpp`

