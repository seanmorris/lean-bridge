# PHP-Wasm consuming inputs

The [execution receipt](owned-php-wasm-transfers-20260930.json) records ordinary
source configuration and compiler-checked reviewed contracts for 26 exports.
Twenty exports consume resource-containing inputs.

The consuming adapter reserves each original shared result lease and prepares
its input snapshot before the Lean call. Validation failures preserve the
inputs. Native handoff consumes the whole lease, including assignment aliases
and sibling fields. Independently retained leases survive. Callback reentry sees
the consumed state immediately. A callback borrow must be retained before it
can be transferred.

Private wasm32 tests exercise every export under weak and strict PHP callers.
They cover recursive and mixed values, captured closures, duplicate owners,
allocation failures before and after handoff, retained exceptions, and sixteen
request termination/recovery cases per source path. Cleanup checks require zero
tracked allocations, native identities and active call scopes.

Installed tests build with the packaged CLI and its pinned PHP-Wasm compiler
inputs. They compare independent relocated builds and package reassembly,
reject altered contracts and generated sources, remove the producer tree, then
install the original npm and Composer archives offline. Node and Chromium run
both autoload arrangements, startup and lazy loading, and weak and strict PHP.
Each consumer exercises all 26 exports and checks recovery in a fresh request.

The documentation test builds C and PHP-Wasm together, compares their transfer
contracts, removes the producer, verifies the handoff receipt, and runs the
unmodified Composer example. Its output is `42`, `42`, then `closed`.

Run the gate with `npm run test:owned-php-wasm-transfers` after installing the
pinned PHP-Wasm compiler and host inputs. CI retains the private, installed and
documentation reports. Earlier evidence receipts remain unchanged. This
milestone does not promote unrelated support cells or claim owner-anchored
borrowed results, Docker acceptance, or another consumer's transfer support.
