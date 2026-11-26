# A one-shot callback can’t run twice

Five clients installed [Budget](../../tests/fixtures/javascript-once-callback/Budget.lean)
and its runtime: Node, executed strict TypeScript, Chromium, a mounted React
handler, and a dedicated worker. The [ordinary](npm-once-callback-20261126/ordinary.json)
and [reviewed](npm-once-callback-20261126/reviewed.json) receipts identify
the original archives and application sources. Both installed interfaces
declare parameter `f` of `Budget.probe` as `once` and `g` as `many`.

The [client](../../tests/fixtures/javascript-once-callback/calls.mjs)
observed the following on each route:

- Lean called `f` once, let that callback await an independent registration,
  called `g` twice, then tried `f` again. The second request failed with
  `callback-already-invoked`; the host entered `f` only once.
- Lean caught the first application exception and retried the *same*
  registration. The retry failed with the policy error without running the
  function again. A separate uncaught application rejection preserved the
  original error object.
- Supplying the same function in two one-shot slots let each slot invoke it
  once. Supplying it on a third, fresh task still worked. Every client ended
  with zero frames, allocations, pending calls, notifications, and native owners.

The [author setting](../publish/npm.md#build-a-threaded-npm-handoff) applies
to a registration on the npm task owner. It does not limit the number of
times application code can call a JavaScript function directly.

Run `npm run test:javascript-once-callback` with `LEAN_BRIDGE_TEST_TASK_INPUTS`
set to the [threaded SDK](threaded-task-probe.md#prepare-the-author-sdk) and
Playwright Chromium installed. Set `LEAN_BRIDGE_NPM_ONCE_CALLBACK_KEEP` to
an existing directory to retain both handoffs; set
`LEAN_BRIDGE_NPM_ONCE_CALLBACK_REPLAY` to that handoff to test its packages again.
