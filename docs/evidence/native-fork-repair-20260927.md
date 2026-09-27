# Native recursive callback fork regression

VO task 1219. This repair changes the native test and its evidence integration.
The runtime and generated production bindings are unchanged.

The inherited-process probe expected NG_INVALID from closure validation.
The shared runtime now rejects the child before closure validation, so the
generated call returns NG_RUNTIME. CI and a local reproduction returned that
exact status. The corrected probe requires NG_RUNTIME, unchanged argument and
output storage, and continued parent-process use. A five-second child alarm
bounds a mutex regression. This does not add support for using Lean after fork.

The fresh ordinary-source and independently reviewed-IR runs execute both
ordinary and address/leak/undefined-sanitized callers. Each path records 26,746
carrier assertions and 68,613 call assertions per run, nine payload shapes,
depth 64, allocation-failure cleanup, and rejected cleanup mutations. The
receipt includes the compiler inputs needed to reconstruct the exact caller.
These are transport tests, not new installed-package acceptance claims.

The JSON receipt preserves the original process-origin receipt and all its
predecessors. Whole-file hashes authenticate each recorded source transition.
Unknown edits cannot be normalized into accepted historical content. The
current type inventory changes source hashes only; no support cells are
promoted.
