# Native Zend callback probe repair

VO task 1219. Downstream run 36442697009 failed the native PHP Fiber probe at
commit `4c13a5f`. GCC reported two inlined locals as potentially clobbered by
`longjmp`. The same test passed with GCC 12.2 and reproduced both CI errors with
GCC 13.5.

The test probe now puts its `zend_try` boundary in a callback helper. Mutable
status and output values live in the caller's frame, outside the function that
owns `setjmp`. The caller prepares and releases the borrow as before. This also
avoids reading changed automatic values in the function returning from
`longjmp`. Production Zend generation, optimization and fatal warnings are
unchanged. Native observations now identify the C compiler.

The repaired probe executes with GCC 12 and GCC 13. Both runs cover weak and
strict PHP calls, real Fiber entry, deferred destruction, allocation failures,
and four rejected lifetime mutations. Each PHP mode completes 417 checks and
leaves no live identities, leases or scopes.

The pinned PHP-Wasm host executes the same probe with 403 checks per PHP mode.
Fourteen request-abort cases cover normal shutdown, exit, direct and nested
bailouts, destructor aborts and shutdown inside a callback. Each request leaves
empty ownership state and the next request can create and use a fresh Lean
value. This host cannot start Fibers; the native companion supplies that check.

The [repair receipt](owned-zend-bailout-repair-20260928.json) retains the original
GCC failure, both passing compiler runs, the wasm32 checks, exact source hashes
and reversible changes. Earlier receipts remain unchanged. This repair makes
no installed-support promotions.
