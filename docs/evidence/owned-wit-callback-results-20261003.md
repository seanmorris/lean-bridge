# Direct WIT callback-result acceptance

The frozen acceptance covers six direct Component Model executions: ordinary
Lean source and reviewed binding IR, each with no host callbacks, host callbacks,
and the combined ownership profile. All six components were produced from
compiled Lean and executed through Wasmtime.

The reports contain 45,634 runtime assertions and 750 injected allocation
failures. They exercise owned callback results, callback-result anchors,
transferred inputs, receiver exports, nested records and recursive values. Every
execution finishes with zero live owners and zero live identities. Three exact
raw TAP streams bind the six selected executions.

This milestone is deliberately narrower than installed-package acceptance. It
does not claim source-free or relocated consumption, process-lifetime or
sanitizer coverage, retained host callbacks, asynchronous delivery, registry
publication, or a prepared WIT package that exposes these callback-result APIs.

## Required check

Verify the immutable receipt, staging history, embedded reports, selected raw
TAP and complete source closure without the retained build worktree:

```sh
npm run test:owned-wit-callback-evidence
```

The evidence file is
[`owned-wit-callback-results-20261003.json`](owned-wit-callback-results-20261003.json).
Its `previous` field preserves the completed native-PHP acceptance, while
`sourceHistory` binds the original WIT runtime staging transition.
