# Compiled Rust arrays and records

VO1219 adds installed collection checks for original ordinary-source and
independently reviewed Cargo packages. The 35-export contract covers all nineteen
primitives, seven record types and 24 fixed Array nesting levels.

## Installed validation

Use the pinned Rust/Cargo 1.90.0 toolchain and author toolchain described in
[contributor testing](../contributing/testing.md):

```sh
LEAN_BRIDGE_RUST_COLLECTION_TEST=1 node --test tests/rust-collections.test.mjs
node --test tests/rust-collection-contract.test.mjs tests/rust-collection-evidence.test.mjs
```

Both source paths pass 321,191 assertions across 3,274 public calls and twelve
runtime rejections per execution. Fifteen invalid callers fail with their
expected compiler diagnostics. The [machine-readable record](rust-collections-20260922.json)
retains signatures, original archives, installed files, locked dependencies,
compiler identities, public caller hashes and independent build logs.

The suite removes the author project before installing the original crate. It
uses an empty Cargo home, exact vendored dependencies and offline resolution.
The C driver permits linking but rejects compilation. Cargo compiles the public
Rust consumer against the prepared crate without Lean or C compilation.

All 26 installed receipt files, the complete 27-file crate snapshot and four
native libraries retain their recorded identities. The fourteen vendored
dependencies also remain unchanged. Separate copies contain failure probes;
the original crate is never patched.

After compilation, the suite removes the handoff, package sources, dependencies,
consumer sources, Cargo home and build output. Only the relocated public caller
and documentation-example executables remain. The public caller runs twice more
without compilers. Each process releases its extracted runtime assets and registry
at normal exit. The documentation executable prints its independently checked
output after the same source removal.

An independent rebuild reproduced original archives, installed package contents,
dependency identities, public observations and compiler diagnostics. Consumer binaries may
contain build-directory paths; their hashes record the executed binaries rather
than establish cross-directory binary reproducibility.

## Public values and failures

Borrowed slices become owned vectors on output. Named structs retain public typed
fields, nominal identity, empty and one-field cases and declared field order.
Generated structs derive `Clone`, `Debug` and `PartialEq`; nested vectors compare
by contents. Floating-point equality follows Rust: NaNs are unequal to themselves,
and signed zeros compare equal. Transport checks separately verify preserved bits.

Cases cover 5,121-bit integers, fixed-width limits, both floating-point widths,
subnormals, infinities, NaNs, signed zero, Unicode, embedded NUL and byte vectors.
Lean independently checks primitive elements and record fields. Returned mutable
storage is independent. Four threads repeat 512 public calls.

Five tests run in a separate instrumented copy of each original crate. They check
112 host allocation-error checkpoints and the same checkpoints under unwinding,
plus 1,546 real-native allocation-error or panic checks. Each started aggregate
call clears its native output once and releases tracked scratch. A later valid
call succeeds after each injected native-call failure.

The separate host-only conversion test runs four tests without loading Lean.
It checks every primitive, all seven records, deep arrays, invalid native values,
copy budgets and cleanup. It compiles the public caller and fifteen invalid
callers, but does not claim to execute them against Lean. Its report explicitly
marks the native failure test as compiled but not executed.

## Coverage

The inventory advances 22 reviewed-path cells: six Array/record positions and
sixteen primitive record fields. Earlier ordinary-source, character, platform-word
and callable evidence retains its scope. This milestone changes collection tests
and documentation; it does not change the Rust adapter implementation.

Copies remain acyclic, with a 32-level schema limit and separate 16 MiB Rust
conversion and native input/output accounting budgets. These do not bound every
Rust allocation or Lean working memory. Cleanup covers errors and unwinding,
not process abort. Recursive copied values, compound callable payloads and
explicitly owned aggregates remain unfinished work.
