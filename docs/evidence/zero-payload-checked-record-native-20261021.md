# Zero-payload checked records in C and C++

The immutable [hosted evidence archive](zero-payload-checked-record-native-20261021/index.json) records all four ordinary-source, reviewed-IR, full and result-only C/C++ package selections from [GitHub Actions run 39548744700](https://github.com/seanmorris/lean-bridge/actions/runs/39548744700). The archived artifact is `12324250671`; its SHA-256 is `5d847958a88f7104ed9c6a762b9254490ac7784fbd63f6e7c80b219c1db18728`.

Each selection reproduces the complete packages from two author roots, removes the author sources, installs without network access, relocates the installed tree and replays unchanged C11/GMP and C++20/Boost callers. The run used Ubuntu 24.04, x64, glibc 2.39 and a declared glibc 2.38 package floor.

The fixture distinguishes these values:

- proof-only `Witness`, checked through a selected nullary Lean constructor;
- `Token`, whose `Unit` field remains present;
- plain empty `Marker`;
- `Option Witness`, including explicit absence;
- arrays of zero-payload values; and
- the active and inactive branches of `Mark`.

C gives `Witness` one non-semantic `uint8_t` storage byte because a C structure cannot have zero size. The byte carries no Lean field, proof or application value. C++ exposes `Witness` as a nominal empty structure. Neither representation is null, absent or interchangeable with `Marker` or `Token`.

Full packages run the exact selected nullary constructor on checked inputs, preserve rejected caller values and recover on the next valid call. Result-only packages project Lean-produced proof-erased values without input-constructor metadata.

The archive retains every package, receipt, report, caller observation, terminal TAP stream, control result and exact producer, consumer, checker and archiver source closure at revision `ecbec51d2a49e3146b996b0369e7dbe74e2d6db9`. The independent verifier is [`tests/helpers/zero-payload-checked-record-native-evidence.mjs`](../../tests/helpers/zero-payload-checked-record-native-evidence.mjs).

This evidence promotes copied parameter and result sites for the named fixtures in C and C++. It does not promote fields, callbacks, owned positions, other zero-payload shapes or another host. Lean, C/C++, GMP, Boost, the linker and the operating system remain trusted external toolchains.
