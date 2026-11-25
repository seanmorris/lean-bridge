# Installed C++ host-object packages

An offline-installed candidate CLI built three Linux x86-64 C++20 archives
with Lean 4.32.2. The reviewed package reproduced the ordinary package's
public binding IR. Removing a compiled host-member dependency from the review
made the CLI refuse the build without producing a package-set receipt.

| Source route | Archive SHA-256 | Package-set receipt SHA-256 |
| --- | --- | --- |
| Ordinary | `33ce363d6b28d8d0ff90ed8271baace535f34b872ac5dbfb02d327e69aa5f55e` | `3bb4af3527ba3730c5bee9e6a4dc41839eedcc642f1e888b9fe80e3ea5fe3c36` |
| Independent peer | `ce5fcdba3a8775ec439e8425e47fe0e0bd751579bb97a036d90d4e6cae2ffff4` | `7c4b96ade768a20e16178d07461fc582a5bd35f4f5ee162897292aa049b587d6` |
| Reviewed | `2a008ee3b109d90cf0ff304bd0578efcb0cc7c650b5ffd7a6fabcbe22061be1d` | `73093138e712efe0714e549f57476a455a7968b6d3d9a76e17944d9a9c44b37a` |

The [test](../../tests/helpers/c-host-packages.mjs) verified each package-set
receipt, checked every inventoried file in the extracted package, and compared
the archived binding IR and elaboration evidence with the release sidecars.
It removed the producer projects and CLI install before building consumers.

The [C++ application](../../tests/fixtures/c-host-members/consumer.cpp) ran
eight times: ordinary or reviewed with the peer, each in both link orders,
using pkg-config and CMake. Every process ran with an empty library override
and no compiler on its executable search path. Loader inspection found both
components, one host-object domain, the broker and Lean itself under the two
relocated installs.

Each run checked shared ownership and mutation across components, original
exception identity through reentry, an IO error, typed EIO failures, returned
`Except` values, embedded NUL and binary data, and integers wider than 256
bits. It also checked wrong-thread/fork rejection, deferred close, and exact
destruction after retirement. These are synchronous C++ host-object results;
they do not establish host-object behavior on asynchronous workers.

Run `npm run test:cpp-host-packages` to rebuild; set
`LEAN_BRIDGE_CPP_HOST_REPLAY` to the directory containing the three releases
to verify them and rerun downstream consumption without the Lean producer.
