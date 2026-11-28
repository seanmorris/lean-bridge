# A JavaScript record with a leased Lean function

[Ordinary-source execution record](npm-function-fields-20261126/ordinary.json) ·
[Reviewed-interface execution record](npm-function-fields-20261126/reviewed.json)

Five applications installed `@example/tariff-quotes` and its runtime from
local npm archives, with lifecycle scripts disabled: Node JavaScript, strict
TypeScript compiled and executed in Node, a Chromium page, a mounted React
button and a dedicated browser worker. Each ran against both author routes.
For the three browser clients the harness checked the deployed Wasm files
against the installed component and runtime bytes, then served the built
site without its project or `node_modules`.

The [JavaScript client](../../tests/fixtures/structured-types/tariff-fields.mjs)
constructs a record, passes it through Lean, retains its function and repacks
it. Once the original handles are disposed, the retained function works both
directly and as a field on another input record. An escaped call-scoped
JavaScript function fails with status 10 both directly and through Lean;
the host callback is never entered. A callback can return a leased Lean
function for Lean to apply. A thrown application error reaches the caller as
the same object; after failure, a fresh valid call still returns 42.

The [strict TypeScript client](../../tests/fixtures/structured-types/tariff-fields.mts)
also invokes the retained function, checks both expired-borrow refusals and
recovers the original thrown object. Its negative compilation cases reject a
plain function posing as a returned lease and a scalar posing as a callable
reply.

| Installed client | Live identities before / while held / after disposal | Observed result |
| --- | --- | --- |
| Node JavaScript and Chromium page | 0 / 2 / 0 | Retained field 42; staged callback 44 |
| Mounted React and dedicated worker | 0 / 2 / 0 | Retained field 73; staged callback 75 |
| Executed strict TypeScript | 0 / 1 / 0 | Staged callback 42; repacked field 44 |

Counts come from the installed Wasm broker, not a JavaScript wrapper count.
They measure explicit disposal, not garbage collection. The field here holds
a scalar Lean function; it does not capture an application object or
register a JavaScript callback for later use.

Run `npm run test:npm-function-fields` with the npm target's author toolchain
and Playwright Chromium installed. Set `LEAN_BRIDGE_NPM_TARIFF_KEEP` to an
existing directory to retain the package sets. To repeat just the installs
and downstream checks, set `LEAN_BRIDGE_NPM_TARIFF_REPLAY` to the reported
handoff directory instead. The [harness](../../tests/helpers/npm-function-fields-installed.mjs)
verifies the receipts and installed compiler metadata on both paths.

## Passing a JavaScript function inside an input record

A second run used the same archives with a [caller-created record](../../tests/fixtures/structured-types/tariff-host-field.mjs).
Its `quote` function reads a mutable JavaScript object and calls a second
Lean function before returning. Changing the object's offset from 7 to 12
between calls changes the calculation: both 35 + 7 and 30 + 12 return 42.
Each call enters the host exactly once. A field that throws returns the
original error to its caller, and a fresh record still works afterwards.

Returning the caller's field through `echoTariff` does not extend its
borrow. Calling the escaped field directly or passing it back to Lean fails
with status 10 without another host entry. All five clients finished with
zero live Wasm identities. The [ordinary](npm-host-field-calls-20261126/ordinary.json)
and [reviewed](npm-host-field-calls-20261126/reviewed.json) records retain
these observations separately from the original leased-field run above.
