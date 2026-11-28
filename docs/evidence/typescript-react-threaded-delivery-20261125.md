# Async tasks and iterators in installed TypeScript and React clients

These clients use the two retained Workshop releases from the
[threaded host regression](javascript-threaded-host-regression-9431fd5.json).
Each starts with the verified npm package receipt, installs the named runtime
and component offline, and checks the author route in the installed compiler
metadata. This replays the recorded packages; it is not a new Lean build or
a hosted result.

| Author route | Local client executions and binary hashes |
| --- | --- |
| Ordinary Lean project | [Node and Chromium results](typescript-react-threaded-delivery-20261125/ordinary.json) |
| Reviewed interface | [Node and Chromium results](typescript-react-threaded-delivery-20261125/reviewed.json) |

The [TypeScript program at the recorded revision](https://github.com/seanmorris/lean-bridge/blob/c0e7f54fba9c814db0c49a64c7ac4bd93b43f416/tests/fixtures/javascript-threaded-host/installed-delivery.mts)
compiles with strict checks, then runs in Node. Its async iterator makes no
host read while an independent task runs. Early break finalizes the cursor;
natural exhaustion finalizes a second cursor without an extra read on the next
demand. A failed pull delivers the generated step error. Canceling a task
whose host callback is pending succeeds exactly once. Delivering its old reply
does not change the result of the next task.

The [React component at the recorded revision](https://github.com/seanmorris/lean-bridge/blob/c0e7f54fba9c814db0c49a64c7ac4bd93b43f416/tests/fixtures/javascript-threaded-host/react-delivery.mjs)
mounts in a cross-origin-isolated Chromium page. Its first click renders
`8:1:0`: the task returned 8, one item was yielded and the Lean finalizer reset
the meter to 0. A second click starts a task with a pending host reply. An
actual unmount cancels the task. The caller observes `operation-cancelled`,
the DOM is empty and the late reply makes no state update. Another task on
the same binding returns 3. Neither program leaves pending operations,
notifications, native owners, frames, allocations, host pins, or host errors.

The browser deployment uses ES module workers. Its two Wasm hashes match
the installed runtime and component, and the install tree is removed before
Chromium opens the bundle. The reports identify the client sources, compiler
and framework versions, and each exact package receipt.

For a new source build, run `npm run test:javascript-threaded-host-installed`
with the pinned threaded SDK. To replay an existing pair of Workshop handoffs
without rebuilding, point `LEAN_BRIDGE_JS_DELIVERY_RELEASES` at the directory
containing `ordinary/packages/npm/` and `reviewed/packages/npm/`, then run:

```sh
node --test --test-name-pattern='compiled TypeScript and mounted React' \
  tests/helpers/javascript-threaded-host-installed.mjs
```
