# Ordinary-source C/C++ arrays and records

VO1216 extends the native C/C++ adapter to recursively copied arrays and acyclic records. Lean 4.32.2 supplies the checked native representations, record constructors and field accessors. Neither the public C API nor the C++ wrapper exposes Lean object layout.

## Acceptance

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_C_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec --test-concurrency=1 \
  tests/native-c-family.test.mjs tests/native-c-copied.test.mjs
node --test --test-reporter=spec \
  tests/c-generator.test.mjs tests/cpp-generator.test.mjs
```

The local profile uses GCC/G++ 12, CMake 3.25.1 and glibc 2.36 on Linux x86-64. Production packages retain the glibc 2.38 floor. Lean is pinned to commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`.

Parcel and Archive each build from two source locations. The tests compare their C and C++ archives byte-for-byte, hide the source trees, extract the packages, verify their inventories, and execute C11 and C++20 consumers through both pkg-config and CMake. The consumer PATH contains only `/usr/bin:/bin`; no Lean or Perl installation is used. Archive reverses its leaf record's field order and uses a UInt64 single-field record where Parcel uses UInt32.

The fixtures exercise all 16 primitive array element types and record fields, empty arrays and records, scalar-represented records, arrays of records, nested arrays, and records containing both records and arrays. Checks include signed minima, unsigned maxima, multi-limb Nat/Int values, embedded NUL and Unicode, NaN/infinity/signed zero, distinct owned results, mixed-argument calls and concurrent callers. Invalid Unit fields, malformed nested UTF-8, null data and overflowing lengths are rejected without changing the output slot.

The allocation test substitutes only the C adapter's allocator calls. It fails each output allocation in sequence while executing the actual compiled Lean component, verifies the error status and unchanged output, and counts zero remaining owned buffers after every failure. A separate C++ test throws on the outer vector allocation and each subsequent string allocation; every path releases all C-owned children. A result that exceeds the shared budget after copying its first element also releases the partial result.

The primitive Mosaic/Survey acceptance and reviewed Alpha C/C++ tests remain regression checks. The copied-value extension adds 44 installed-tested inventory cells: array and record input/result/field positions, plus the 16 primitive field positions, for C and C++. It does not advance callback, optional, variant, managed-language, Wasm or other-platform cells.

The copied-value suite passed all three top-level checks. These are the exact locally installed archives from the final run:

| Archive | SHA-256 |
| --- | --- |
| `parcel-c-1.0.0-c.tar.gz` | `cf30606039d71e474cc0d76c0929d3f23f29dde3c585caa3569072bfcbb2bd99` |
| `parcel-cpp-1.0.0-cpp.tar.gz` | `536dac74829f16b077275d348c450ff3405bfc1bf50c0b11bab67cfeb369fd89` |
| `archive-c-1.0.0-c.tar.gz` | `aa371738520179510d4ca21341a9b7db38fde4ac517162714ad4fe802dac8e35` |
| `archive-cpp-1.0.0-cpp.tar.gz` | `f85de05c224e1a653419c81e9cf418e069f9c32268ed26709036446fd5224db0` |

The four primitive regression checks also passed. Their regenerated archives are:

| Archive | SHA-256 |
| --- | --- |
| `mosaic-c-2.0.0-c.tar.gz` | `85f698a6f63f2586afffa1f429d2b6d764a673f970571f35eea3d4a3ee545c71` |
| `mosaic-cpp-2.0.0-cpp.tar.gz` | `fc0f907498868b8b99a40eaada832e71ce0e8165be12647157e5102c3aff47df` |
| `survey-c-2.0.0-c.tar.gz` | `f28906f689ff0811f46c31fb3661a382eed54afb48cc569f9356cf4c8c9e005e` |
| `survey-cpp-2.0.0-cpp.tar.gz` | `a8727b4323345510d7fd142ce73517e2e486f96109888cd09e4f2ba537dcb08b` |

## Limits

Only pure copied values are admitted. Type nesting is limited to 32, and recursive types are rejected. Input and output share a 16 MiB conversion budget covering payloads, array slots, copied record storage and output array ownership headers. Lean's internal working memory is outside that conversion limit. Copied results require deep clear in C and use ordinary ownership in C++.

This acceptance prepares local archives. It does not publish packages, deploy Pages, or establish signed release provenance.
