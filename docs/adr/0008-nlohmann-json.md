# ADR-0008 — C++ JSON Library: nlohmann/json

**Status:** Accepted

**Date:** 2026-09-25

## Context

Maia SFU needs to parse and generate JSON for its HTTP control API.

Options evaluated:

| Library | Style | Size | Notes |
|---|---|---|---|
| **nlohmann/json** | Header-only, intuitive API | ~1 MB header | Industry standard, excellent docs |
| RapidJSON | Header-only, verbose API | Moderate | High performance, less ergonomic |
| simdjson | Header-only, SIMD | Moderate | Fastest, but not needed at control-plane volumes |
| Manual (snprintf/sscanf) | None | 0 | Error-prone, maintenance burden |

## Decision

Use **nlohmann/json** (https://github.com/nlohmann/json) at a pinned tag via CMake FetchContent.

## Rationale

- Single-header, zero build complexity
- MIT license
- Used pervasively in the C++ community — well-understood by contributors
- The control API handles at most O(participants) JSON messages per second; performance is irrelevant at this scale
- Exception-safe and well-tested

## Consequences

- ~1 MB header is compiled into the SFU; compile times increase slightly
- nlohmann exceptions must be caught at API boundaries (already handled by cpp-httplib error handling)

