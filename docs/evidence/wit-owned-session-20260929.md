# Owned WIT public sessions and host callbacks

This milestone implements public, thread-bound sessions for owned structured
values over the generated WIT component. An independent C consumer uses semantic
records, containers, GMP integers, typed callback descriptors and opaque result
owners. The public header exposes neither Wasmtime resources nor Lean layouts.

Each exported operation and returned-closure invocation crosses a Component
Model call into an authenticated compiled Lean adapter. Local copy and retain
helpers manage result ownership. Each active call has its own Wasmtime store;
host callbacks can reenter without reentering the same component instance.
Before store teardown, output conversion acquires independent native leases and
copies value storage into the caller's result owner. Closing a session during a
callback rejects further calls and defers destruction until active calls return.

## Execution

The seven-case gate builds three independent consumers through both ordinary
compiler analysis and reviewed binding contracts:

- Owned values: records, aliases, arrays, lists, options, results, variants,
  recursive graphs, returned Lean closures and stale or foreign handles.
- Host callbacks: borrowed replies, returned owners, nested public calls,
  resource creation, releasing an input owner, callback failure, typed recovery,
  expired callback borrows and closing the session from inside a callback.
- Scalars: all 19 primitive types, exact large integers, embedded NUL and Unicode
  strings, byte arrays, float bit patterns and nested optional units.

Native and WIT scratch-allocation fault injection must preserve the caller's
output slots and leave no partial owner. Normal and AddressSanitizer/
UndefinedBehaviorSanitizer runs check the same observations. LeakSanitizer
output must match independent Lean controls. Mutations removing store cleanup
or independent result ownership must fail the public consumer.

The previous five-case converter/private-host gate also runs against these
sources. CI requires both gates, rejects skipped cases and retains their logs.
See [testing instructions](../contributing/testing.md).

## Scope

The [source-bound receipt](wit-owned-session-20260929.json) records both complete
test logs, current source identities and exact reversible changes from
`f2038781354eb853fefdd58de3995c996d6f7e22`. Earlier receipts remain unchanged.

Production package admission and relocated installed-package acceptance remain
open. This milestone does not add transferred inputs, owner-anchored borrowed
results or retained host callbacks. Installed support classifications do not
change.
