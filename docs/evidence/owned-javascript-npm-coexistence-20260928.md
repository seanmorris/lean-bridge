# Installed copied and owned npm coexistence

The two npm builders now produce byte-identical shared-runtime archives.
Their manifest objects previously had different property orders. The identity
calculation canonicalized those objects, but the archived `package.json` did not.
Two archives therefore shared a version while differing in bytes. A failing
regression reproduced the mismatch. The runtime assembler now canonicalizes
the archived manifest too.

The installed test independently compiles an owned API and a copied API with
nested options, results, products, records and byte arrays. It compares the
runtime archives, installs one runtime and both component archives offline,
then deletes the author and build directories. Strict TypeScript checks reject
using a copied value as a resource or a resource as a copied option.

Node executes owned-first, copied-first and concurrent imports. Chromium,
Firefox and WebKit repeat those orders in pages, React StrictMode and module
workers. Each consumer executes 22 checks three times. The browser bundles run
after removal of the installed packages and use only three Wasm assets: one
runtime and two components. External browser requests are blocked.

The probe observes actual Wasm instantiation and runtime counters. Every normal
run requires one memory, one runtime initialization, two library initializations
and no outstanding resource identities. It calls the copied API from an owned
callback and returned closure, preserves the original callback exception, and
verifies independent copied storage. Closing the owned component leaves copied
calls usable. Separate Node fault cases retire the heap with a live resource;
both APIs must reject further calls. The retired heap is quarantined until the
consumer process exits.

The new source receipt preserves the preceding installed-package receipt and
records the failing/passing manifest regression. Required CI retains a fourth
execution log for coexistence. No support-matrix cells are promoted.

Nix/Docker and signed publication for the owned npm profile, WIT/WASI ownership,
transferred inputs, anchored borrowed results and final cross-language acceptance
remain part of task 1219.
