# Python callback sanitizer TLS repair

The first complete Python callback-result gate passed 12 of 13 tests. The
reviewed-IR host-callback case failed when GCC 12's LeakSanitizer tracer crashed
at process exit. That run is not accepted as a passing gate.

Repeated executions captured the same fault at address `0x4a38`. The captured
process map placed the instruction at offset `0xe80f0` in Debian's
`libasan.so.8.0.0`. `addr2line` resolved it to
`__lsan::ScanRangeForPointers` in `lsan_common.cpp`.

Pointer-range logging reproduced the failure in both the exercised probe and
the cold-start probe, which does not call a Lean export. Immediately before the
crash, LeakSanitizer recorded dynamic TLS beginning at `0x4a31` and ending at
`0x002800005b33`. Neither range describes the process's TLS mapping.

GCC 12's [TLS interceptor](https://github.com/gcc-mirror/gcc/blob/releases/gcc-12/libsanitizer/sanitizer_common/sanitizer_tls_get_addr.cpp)
guesses a pre-release glibc allocation header when a TLS address lies 16 bytes
past a page boundary. The [upstream issue](https://github.com/google/sanitizers/issues/1409)
documents that released glibc does not use that header. Allocation metadata can
therefore become a bogus TLS address and length. This explains the observed
invalid range and the dependence on allocation placement.

The test harness sets `intercept_tls_get_addr=0`. It does not disable leak
detection, TLS roots, loader-allocated roots, address checks or undefined-behavior
checks. GCC's [Linux leak scanner](https://github.com/gcc-mirror/gcc/blob/releases/gcc-12/libsanitizer/lsan/lsan_common.cpp)
also discovers dynamic TLS through loader allocations.

Each interpreter executes five detector controls:

- A buffer overflow must trigger AddressSanitizer.
- An invalid shift must trigger UndefinedBehaviorSanitizer.
- An unreferenced 73-byte allocation must trigger LeakSanitizer.
- An allocation held only in dynamic TLS must match the cold leak baseline.
- Clearing that TLS pointer must produce an 89-byte leak report.

The test TLS block exceeds glibc's static TLS surplus. These controls run against
the compiled boundary in CPython 3.11 with both supported typing configurations
and CPython 3.12. The repaired reviewed-IR host case passes all three setups,
with 10,770 semantic checks and 1,027 injected allocation failures per setup.
The repaired Python 3.12 stress run completed 100 cold starts and 20 exercised
runs. Every run preserved the exact normalized startup leak baseline, without
a tracer crash or address/undefined-behavior diagnostic.
The repaired full Python gate passed all 13 tests with no failures, skips or
cancellation in 2,637 seconds. Every runtime configuration executed all five
detector controls on all three interpreter setups.
