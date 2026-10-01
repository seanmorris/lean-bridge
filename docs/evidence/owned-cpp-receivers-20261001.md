# C++ methods, properties and receiver-bound results

VO task: 1219. This milestone projects compiler-checked receiver declarations
into nominal C++ members and prepared C++20 packages.

Methods use snake-case names on `Value<T>`. Properties are zero-argument const
accessors. Consuming receivers require rvalues; ordinary lvalues and const
receivers cannot invoke them. Record fields retain their existing meanings.
Non-consuming resource members that do not require a whole owner also work on
resource leaves, including call-scoped callback arguments.

A borrowed result follows the declared receiver or another parameter's original
owner. Member dispatch does not insert a retain. Empty constructors and recursive
values preserve whole-owner lifetimes, and releasing or consuming an anchor
expires its descendants. Explicit retention creates independent ownership.
Resource-only receiver APIs also work without borrowed results or host callbacks,
with and without consuming methods.

## Verification

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-cpp-receivers
```

The ten-test gate requires both ordinary source and reviewed IR. It compiles
public member syntax, executes sixteen receiver exports among twenty-seven
exports through fresh Lean, and exercises callbacks, copied properties,
recursive values, transfers, allocation failures and sanitizer cleanup. Three
compiled broken adapters must fail the original consumer assertions; restoring
the generated source must pass again.

Installed tests use the offline-installed CLI, build twice independently and
compare original archive bytes. They reject forged native and C++ receiver
contracts and changed generated sources even after rehashing the files. After
removing producer and source directories, they install the archives offline,
relocate the package and run pkg-config, CMake and the
[documented example](../consume/cpp.md#methods-and-properties).

The [machine-readable receipt](owned-cpp-receivers-20261001.json) binds the
execution reports, compiler inputs, generated API, CLI inventory and original
archives to exact source hashes. CI requires all ten tests without skips and
retains the full log and eight reports. Earlier receipts remain unchanged.

## Remaining work

Receiver projections for other backends, callback-result anchors and the final
cross-language installed-package/container audit remain open. This milestone
does not promote type-support cells or authorize registry publication.
