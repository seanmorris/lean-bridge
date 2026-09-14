# Ordinary-source RubyGems copied values

VO1216 adds source-named Ruby APIs and prepared gems for ordinary Lean projects. This milestone is based on `b78844ba12ff4947e1741e5ad206adb489318690`; the type inventory binds its implementation and acceptance to source hashes.

## Acceptance

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_RUBY_TEST=1 \
LEAN_BRIDGE_RUBY=/app/.toolchains/ruby33/bin/ruby \
LEAN_BRIDGE_GEM=/app/.toolchains/ruby33/bin/gem \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec tests/native-ruby.test.mjs
```

All four top-level checks pass. The local profile uses MRI Ruby 3.3.12, RubyGems 3.5.22, Fiddle 1.1.2, GCC 12 and glibc 2.36 on Linux x86-64. The production floor remains glibc 2.38. Lean 4.32.2 is pinned to commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. The Ruby source archive was checked against the [official release checksum](https://www.ruby-lang.org/en/news/2026/07/16/ruby-3-3-12-released/).

Willow and Aspen each export 41 functions and build from two relocated source trees. Their gem archives match byte-for-byte. Both source locations are hidden before RubyGems installs the original archive into an isolated gem home with `--local`. Consumers have no Lean compiler, C compiler or native-path override. Gem installation runs no native extension build.

Installed calls cover all sixteen primitive input, result, array-element and record-field mappings. The fixtures also exercise nested arrays and records, empty records, arrays of empty records, scalar-represented records, and independently owned returned arrays. Aspen reverses its leaf record's field order and uses UInt64 where Willow's single-field record uses UInt32.

Value checks include unsigned maxima, signed minima, 4096-bit integers, zero, Unicode with embedded NUL, binary strings, binary32 rounding, NaN classification, infinities and signed zero. Invalid numeric ranges, implicit numeric coercions, negative Nat, nil, malformed text, incompatible string encodings and copy-budget overflow throw. Repeated oversized results exercise native failure cleanup. Threaded calls and GC compaction preserve results.

Test-only fault injection raises during input allocation and result decoding. The suite checks that every captured scratch allocation is freed and the compiled deep output-clear function is called. Modified native libraries fail before loading; changed C adapter artifacts fail package assembly. A missing Ruby executable leaves no partial release. Invalid ambient Ruby options do not affect the isolated packager. Two installed gems are first imported concurrently in five fresh Ruby processes. Each observes one runtime initialization, two component initializations and two attached components. Generated Ruby string literals also escape interpolation markers; a separate MRI check preserves those markers as data.

| Artifact | SHA-256 |
| --- | --- |
| `willow-api-2.0.0.rc.1-x86_64-linux.gem` | `4e486d14b5230fa8304df94c7ad291f0cb9e9d9de902bea273c8278c7a4b02b7` |
| `aspen-api-2.0.0.rc.1-x86_64-linux.gem` | `36013920c63eb5e4904eaacf6287c402d62ebff79993ea883f5c1762bc713557` |

## Scope

Each fixture also projects a reproducible C archive from the same native compilation. The seven-target Shop regression installs npm, CPAN, C, C++, NuGet, Maven and RubyGems outputs from one native and one Wasm compilation. The mixed runner invokes real compilers through an injected Nix-command transport; the local check does not execute Nix itself.

The type inventory adds 54 ordinary-source Ruby cells: input, result and field positions for sixteen primitives, arrays and copied records. Other profiles and reviewed-IR observations do not advance. The separate Alpha resource/callback fixture retains its existing API.

Only pure, acyclic copied types up to 32 levels are admitted. Ruby input scratch and native input/output conversions have separate 16 MiB budgets. These budgets do not bound Lean's working memory or Ruby object overhead. Native handles remain loaded for the process lifetime. Ractors and collectible library unloading are not supported. The failure tests inject selected allocation errors, not every possible runtime failure.

Gems contain generated Ruby sources, compiled native libraries, compiler evidence and dependency license notices. Generic package-set receipts and signed publication integration remain under VO1240. No registry upload or Pages deployment occurs in this acceptance.
