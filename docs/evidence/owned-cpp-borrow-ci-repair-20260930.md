# C++ borrow module inventory repair

The full core regression found two omissions after the C++ borrowed-result
milestone. `src/backends/cpp/owned-borrows.mjs` was missing from the explicit
typecheck inventory and both npm source allowlists. An installed CLI could not
analyze a package because importing the C++ generator raised
`ERR_MODULE_NOT_FOUND`.

The module now appears in the development and standalone CLI package allowlists.
It has the same strict-migration backlog classification as the neighboring C++
generators. The existing repository-free local, global, and `npm exec` installation
tests exercise the repaired import path. No runtime generator changed.

The [repair receipt](owned-cpp-borrow-ci-repair-20260930.json) authenticates these
source changes while preserving the C++ installed receipt byte-for-byte. Tests
reconstruct the earlier source identities and reject unrecorded changes. The type
index refreshes file hashes only; this repair promotes no new support cells.
