# Real Nix owned npm acceptance

VO 1219. The default build runner invokes the pinned Nix component engine to
compile ordinary exports and independently reviewed ownership contracts. Host
Lean, Emscripten and compiler-header paths are deliberately unusable. The engine
reports its source-only boundary, and the author source remains unchanged.

Each case verifies the package-set receipt, relocates both npm archives,
removes the producer source and release, and installs offline without lifecycle
scripts. The installed API preserves resource identity inside records and
containers, exact integers, bytes and embedded NUL/Unicode. Callback borrows
expire after return. Returned closures run and release their lease. Callback
exceptions retain their original JavaScript identity. Explicit cleanup closes
the runtime after releasing the owner.

The Lean, Node and Emscripten derivations extract their pinned archives directly
into the final output. Generic unpacking followed by copying kept two SDK trees
and exhausted this host's available disk. Moving the unpacked tree still copied
it across the separate build-directory and store mounts. Three installation
tests run the actual recipe commands against fixture archives, checking bytes,
modes, symlinks, empty files, release markers and absence of a second tree.

The required Node consumer CI job runs all five tests with the production
shared runtime and preserves their complete output. Contract tests reject
disabled cases, swallowed failures, skipped execution and missing artifacts.

The receipt records the actual native Nix build and installed Node execution.
This host uses `sandbox = false`; OS sandbox isolation and owned-specific
Docker execution remain unverified. No registry received a write. This
milestone changes no installed type classifications or historical receipt.
WIT/WASI owned graph integration, transferred inputs, owner-anchored borrowed
results and final cross-language acceptance remain open.
