# Nested checked records in C and C++, 16 October 2026

This archive establishes installed C and C++ support for the tested nested checked-record boundary on both author routes and in full and result-only packages. The exact archive index is [`nested-checked-record-native-20261016/index.json`](nested-checked-record-native-20261016/index.json), with SHA-256 `902f0f40499a7dfad2cfc8c4ba7bad8e1789d0a4eaf32b09fbee24746bbd268c`.

The fixture's `Packet` contains `digit : Fin 10` and a checked `Nat` subtype field. Each public input site independently selects the `Packet` constructor and the nested subtype constructor. Full packages exercise direct and repeated parameters, `Array`, `List`, `Option`, products, both `Except` branches, an enclosing `Holder.packet` field and the active `Choice.packet.value` branch. Result-only packages project `Array Packet` and `Option Packet` without input-constructor metadata.

## Accepted matrix

| Author route | API | C checks | C++ checks | Rejections | Replays |
| --- | --- | ---: | ---: | ---: | ---: |
| Ordinary source | Full | 3369 | 3884 | 524 / 526 | 4 per package |
| Ordinary source | Result only | 768 | 1280 | 0 | 4 per package |
| Reviewed IR | Full | 3369 | 3884 | 524 / 526 | 4 per package |
| Reviewed IR | Result only | 768 | 1280 | 0 | 4 per package |

Each selection reproduces complete C and C++ packages from two independent author roots. The test then removes the author roots, installs both packages offline, runs independent C11/GMP and C++20 consumers, physically relocates each installed tree and runs the unchanged consumers again. Full-package rejection checks preserve the complete caller graph and the existing C output before a later valid call proves recovery.

The archive contains eight package archives, every original report and destructive control record, and the exact producer sources. Its verifier hashes all 673 indexed files and replays the report, resource, model, package and missing-record controls. Ordinary selections have 31 record controls; reviewed selections have 33. Every selection also has 34 report controls, five resource controls, four model controls and two package controls.

The accepted runs used Linux x64, glibc 2.36, GCC 12.2.0 and a maximum admitted load of 12. They do not establish execution at the release floor of glibc 2.38. The required [recurring workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-native.yml) rebuilds all four selections on Ubuntu 24.04 with the glibc 2.38 floor and retains complete or partial records.

## Boundary

This evidence covers the archived acyclic `Packet`, `Holder` and `Choice` forms through the listed copied containers. Generic, recursive and inherited checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Constructor and source entry counts and peak memory were not measured.

Run the archive verifier with:

```sh
node --test --test-concurrency=1 \
  --test-name-pattern='nested checked-record native archive' \
  tests/nested-checked-records.test.mjs
```
