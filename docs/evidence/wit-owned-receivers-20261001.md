# WIT/WASI methods and properties

Acceptance requires `npm run test:owned-wit-receivers` to pass all 20 tests
without skips. The receipt binds that run to 16 reports and the sources that
generated the component, native adapter and installed packages.

Typed WIT functions take the receiver first. The compiled model preserves
the member kind, resource or aggregate owner, and original parameter indices.
The full fixture exercises 27 exports, including 16 members and 20 borrowed
results. A returned view follows its original receiver or selected parameter
owner. Consuming calls invalidate that owner's borrowed descendants; an
explicitly retained independent owner keeps its own lease.

Both ordinary and reviewed source run through compiled Lean and real Wasmtime
Component Model calls. Allocation-failure sweeps and address/undefined-behavior
sanitizers check cleanup. Ten compiled semantic mutations must fail their
consumer assertions; the restored implementation must pass again.

Resource-only APIs with and without transfers, and callback APIs without
result anchors, have separate runtime and installed-package checks. These
include Unit properties, cross-session rejection, canonical resource identity,
callback reentry and returned closures.

Installed CLI builds produce source-free offline releases. Consumers verify
the handoff, compile with pkg-config and use CMake after moving the package.
The gate exercises loaded-library conflicts, independent builds, deterministic
reassembly and the exact receiver example from the consumer guide. Reviewed
APIs also build a combined C and WIT release.

These packages embed Wasmtime and the native Lean runtime. They are not
standalone WASI programs or caller-owned-store adapters. Callback-result
lifetimes and the final cross-language container audit remain separate work.
Historical receipts stay unchanged; this receipt does not promote unrelated
support-matrix cells.
