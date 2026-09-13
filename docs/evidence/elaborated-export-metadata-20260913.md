# Rich compiler-owned export metadata

VO1107 and VO1108 milestone, 2026-09-13.

## Implementation

Locked npm builds now obtain version 2 of the shared compiler report from fresh Lean interfaces. The extractor records exact declaration identities, visibility, export selection, documentation, UTF-16 source ranges, elaborated binders and result expressions. Its `component-scalars-v1` projection carries structural primitive types. JavaScript copies those types into Binding IR without parsing printed Lean expressions.

The report distinguishes unsupported binders, dependent and generic signatures, returned effects, proof-only exports, visibility and implementation-review failures. Theorems become references only when their elaborated statements directly use the declaration. Binding IR assurance arrays remain empty. The compiler-backed report does not expand the npm ABI or implement finite specializations.

The version-3 elaboration envelope binds compiler, extractor, snapshot and optional generated-source identities. Complete interface hashes cover `.olean`, `.olean.private` and `.olean.server` files. The engine checks these identities after extraction; target compilation must reproduce the entire envelope before linking. Existing source-project `.ilean` files supply no report fields. Extraction leaves package initializers disabled.

The CLI and engine source manifests include both new JavaScript modules. The Perl consumer workflow runs the compiler-only metadata suite with the pinned Lean compiler.

## Commands and coverage

```sh
source scripts/env.sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
  node --test tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/lake-wasm.test.mjs
LEAN_BRIDGE_PERL_NATIVE_TEST=1 \
LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/perl-native.test.mjs
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 \
  node --test --test-name-pattern='generated entry' tests/lake-generated-packages.test.mjs
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 \
  node --test --test-name-pattern='generated imports npm publication dry run reproduces' \
  tests/lake-generated-packages.test.mjs
```

The local glibc override applies to this host's Perl tests only; the production minimum remains 2.38. Native export extraction and its ABI retain their existing behavior. Local npm tests run the pinned Lean and Emscripten tools directly. Publication dry-run fixtures replace Nix command transport while executing real compilation, linking, packaging and verification. Nix engine execution belongs to consumer CI. These checks upload no packages.

The metadata suite checks canonical closed reports, source and invocation identity, structural runtime types, documentation and exact theorem references. Its relocation fixture includes callable aliases, private/protected definitions, an aliased IO result, an IO parameter, an array of IO values, an astral Unicode character and forged project `.ilean` data. Separate cases reject unsupported selected declarations and host-name collisions.

Fault injection requires the specific extractor error for failed execution and malformed JSON. A module-system fixture emits a real server sidecar and supplies its documentation and range; changing that file after extraction must produce an interface-drift error. Cancellation preserves the caller's abort reason. Every fault case checks removal of owned staging and unchanged author inputs.

All 23 locked-WASM checks pass, including six relocated installed-package cases, ten unsupported selections, target metadata drift, linker checks and publication dry runs. The four native regression groups also pass on Perl 5.38.2 threaded, including the installed program's 183 assertions through prebuilt and XS-only paths.

Generated-entry Shop produces identical archives from detached, relocated captures and passes its installed npm calls. Its post-build dependency-drift check passes. The publication dry run for captured public modules importing generated code also reproduces and verifies both clean builds.

Representative npm archive SHA-256 identities:

```text
Shop, captured: 968d7e3b3aa7116a6bad197bc6804adaf049507659d38e35a7cf8cde6590aa21
Shop, generated: e41e5e060176f958cee45ed6b6a7ea1f244a50b0eb9ab4ec4eab55e7840648a8
```

All 11 rich metadata checks pass as the unprivileged `nobody` user. The core profile passes 529 contracts, with four compiler-gated tests skipped there and executed separately above. All 62 documentation checks, 111 site tests, site type checking for 79 canonical pages, lint, the checked-JavaScript profile and 16 generated reference-page checks pass.

## Remaining work

The public `lean-bridge analyze` command remains source-only. Unlocked npm projects retain their existing planner, and native CPAN retains its existing metadata profile. Engine-backed CLI analysis and a shared native projection remain under VO1107/1108. Finite specializations, broader adapters and the full installed corpus remain dependent work. Neither task closes with this milestone.

No type/profile coverage state advances. Two existing type-inventory source hashes are refreshed for the extractor and analyzer contract test. The inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps. The milestone changes metadata and its checked projection without adding runtime type support.
