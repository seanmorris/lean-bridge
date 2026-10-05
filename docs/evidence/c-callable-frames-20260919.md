# GCC 13 callable frame fix, 2026-09-19

[WIT CI job 105956500620](https://github.com/seanmorris/lean-bridge/actions/runs/35465204854/job/105956500620) failed while compiling the generated native C adapter with `-O2 -Wall -Wextra -Werror`. GCC reported `-Wdangling-pointer` when an inlined `lb_enter` stored a local call frame's address in `lb_current`. The step used `continue-on-error`; the final support gate correctly failed the job.

The same generated translation unit reproduces the failure with GCC 13.5.0 in `gcc@sha256:16ae525998c94df36a116c191524256b1d46e72d7a0e9aaf6c153455e40eb5b8`. GCC 12.2.0 accepts the original source. The call paths restore the previous frame before returning, but GCC 13 rejects the stack address escaping through thread-local storage.

The generator now allocates its 64 frames in thread-local storage. Entering a call selects and resets the next slot; leaving restores the previous frame and decrements the depth. Generated callers hold pointers to those slots. No stack frame address enters `lb_current`, and no warning is disabled. The pool costs about 66 KiB per thread per loaded 64-bit callable adapter and avoids per-call heap allocations.

## Validation

The complete regenerated translation unit compiles with GCC 13.5.0 at the same optimization and warning settings. The C contract suite passes 11 tests. Its new compiled regression checks all 64 slots, overflow without a depth change, repeated reuse, first-error preservation, nested unwinding and independent thread state.

The real installed WIT suite passes both ordinary-source and reviewed-IR builds after the change, with 4,905 component call attempts per path. That execution uses GCC 12.2.0, Lean 4.32.2, Wasmtime 42.0.1 and the local glibc 2.36 override. GCC 13 coverage here is compilation of the full generated translation unit; hosted CI performs the full installed run with its compiler.

| Source path | WIT archive SHA-256 | Package-set receipt SHA-256 |
| --- | --- | --- |
| Ordinary source | `d44f6c204c088ce6997c89ff3e1f896fae5eebc7f00bbf48049b561b5a409289` | `57a34613c5af89484b4513ef07da1f87b6f511f70a001b7ef909bf39f0b65ca0` |
| Reviewed IR | `b9270fbac99d4e2d75e83aa8986e07d796e4f79e9257872e7e480d998f678bcf` | `5fd58b5d41068d817c68a7d23d6547f5efe0789bd9e0d10f8292982b722988cf` |

```sh
node --test tests/c-callable-contract.test.mjs
LEAN_BRIDGE_WIT_CALLABLE_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/wit-callables.test.mjs
```

Set `LEAN_BRIDGE_FRAME_CC` to select a compiler for the frame regression. Use the glibc override only to reproduce this local environment; published builds retain their existing floor. Historical archive identities and type coverage remain unchanged. The inventory refreshes shared generator/test hashes and records this regression separately.
