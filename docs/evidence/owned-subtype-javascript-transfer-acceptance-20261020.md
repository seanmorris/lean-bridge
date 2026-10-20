# Retained and transferred JavaScript owned-Subtype acceptance

This record extends the earlier borrowed-record acceptance with explicit retain,
transfer and installation-relocation behavior. It does not replace the earlier
artifact.

Both the ordinary-source package and the independently reviewed package were
reproduced, installed offline without author or build sources, physically moved
to a different directory and invoked unchanged through Node, strict TypeScript,
static pages, React Strict Mode and dedicated workers. Chromium, Firefox and
WebKit each ran every browser profile once plus two reruns while external
network access was blocked.

Each execution performs 18 checks. They establish that a borrowed result shares
the expected lifetime, explicit retention survives release of the original
aliases, invalid retained and transferred values reject without invalidating the
owner, transferred inputs are checked before handoff, a successful transfer
consumes only the selected owner, a retained sibling remains usable, and the
result can be disposed normally. The copied `Int` refinement is transported as
`bigint`; no proof object crosses the component boundary.

The canonical machine-readable artifact is
[`owned-subtype-javascript-transfer-acceptance-20261020.json`](owned-subtype-javascript-transfer-acceptance-20261020.json).
It pins the implementation commit, author route, archive reproduction,
source-removal, relocation, transfer-preflight result, observed values and all
18 browser executions.

Reproduce it at the pinned implementation commit with:

```sh
LEAN_BRIDGE_OWNED_SUBTYPE_JS_TEST=1 \
LEAN_BRIDGE_OWNED_SUBTYPE_BROWSER_TEST=1 \
node --test --test-concurrency=1 \
  tests/owned-subtype-javascript-packaging.test.mjs
```

This acceptance covers the tested acyclic JavaScript record in borrowed,
retained and transferred parameter/result flows. It does not establish owned
callbacks, recursive or generic owned graphs, other refined fields, other host
languages or hosted release-floor behavior.
