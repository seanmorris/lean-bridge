# Recursive WIT package composition

Installed recursive and acyclic WIT packages pass 32 cross-package scenarios.
The tests build ordinary-source and independently reviewed packages, authenticate
their archives, relocate the installed libraries and remove the producers,
headers and compiler access before execution.

## Cross-package behavior

Each source path runs both library load orders with local and global visibility:

- Both packages use the same native Lean runtime and identity registry.
- Returned recursive values own independent storage. They remain readable and
  can be cleared after both sessions and library handles close.
- Conversion-limit errors leave outputs unchanged and both packages usable.
- Malformed recursive output retires the shared runtime. Both packages reject
  subsequent calls, while earlier owned results remain readable and clearable.
- Loading another WIT package after forking an initialized WIT host rejects
  before opening a Wasmtime engine. The parent continues to work.

A second test builds one release containing C and WIT archives. Separate C
translation units use each archive's public header and pkg-config metadata.
Both source paths execute the public APIs in both call orders, then verify
shared retirement and independent cleanup. These four scenarios use a private
test hook only to trigger retirement; consumers call the generated public APIs.

The test also compiles the exact [recursive consumer example](../consume/wit-wasi.md#recursive-copied-values)
from the guide. Both relocated executables print `next(leaf(71))` after closing
their sessions. Consumers do not install a separate Lean runtime.

## Defects reproduced and fixed

The separately compiled peer exports only a zero-argument function. Its generated
host originally failed compilation because `-Werror` rejected an unused
conversion scope. The generator now marks that scope used when no input needs it.

All eight original fork cases hung until the child's ten-second alarm fired.
The newly loaded host recorded the child's process ID and missed the inherited
Wasmtime state. Hosts now inspect the originating process of already-loaded
WIT hosts before checking dependencies or opening an engine. All eight cases
return an explicit after-fork error, and the parent remains usable. Consumers
must use `exec` to start a fresh process after `fork`.

## Evidence

The [execution record](wit-recursive-composition-20260924.json) contains the
original failures, installed archive receipts, executable identities and fresh
regression reports. The [integration record](wit-recursive-composition-integration-20260924.json)
binds the tested sources to commit `83be33f` through exact source transitions.
Earlier evidence records remain unchanged. CI requires both composition reports.

This milestone covers copied recursive values. Structured callback and closure
payloads, explicitly owned resource-containing aggregates, and final type-family
acceptance remain work in VO 1219. It does not publish packages to a registry.
