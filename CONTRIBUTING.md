# Contributing

Maia Meet is in early architecture and implementation. Keep changes small and independently reviewable.

- C++: C++20, warnings enabled, RAII, explicit ownership, bounded buffers.
- JavaScript: ES modules, camelCase, no frontend framework.
- Protocol changes: update the corresponding document in `docs/` in the same commit.
- Security-sensitive code: prefer established libraries and add tests for failure paths.
- New architectural choices: add or update an ADR.

Before submitting a change, build the SFU, run signaling tests, and exercise relevant browser interoperability tests.
