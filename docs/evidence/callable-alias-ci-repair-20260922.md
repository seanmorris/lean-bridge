# Callable alias graph CI repair

Downstream run 35785263397 failed its shared compiler/Lake job on the long-alias
callback fixture. The same failure reproduced locally: native metadata reported
the signature supported, while the test expected rejection at the old alias
depth limit.

Finite type extraction now separates nominal alias depth from inline value
nesting. A long alias chain ending in UInt32 can therefore appear as a graph
inside a callback. The callback target resolver only understood expanded alias
trees, leaving that graph unresolved. The component profile then rejected the
same primitive callable that the native report had accepted.

`callableTarget` now follows bounded alias references in the closed table to a
primitive target. It preserves compound graphs for their existing adapter gates.
Both profiles expose the long-chain fixture as a primitive callable, with
borrowed input and leased result ownership. The cross-profile API identities
match. Separate cases still reject 33 nested Array layers and callbacks hidden
inside copied arrays or records; resource aliases keep resource ownership.

```sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
  node --test tests/compiler-callable-aliases.test.mjs
```

All 37 fresh compiler regression tests pass after the reproduced failure.
Rebuilt recursive, alias and variant npm packages pass on ordinary and reviewed
source paths in Node, executed strict TypeScript, and Chromium/Firefox/WebKit
pages, React and workers. Each recursive JavaScript execution performs 199,675
checks, including 46 rejection cases with recovery.

The [new installed receipt](npm-recursive-callable-repair-20260922.json) records
those final-source builds and binds the unchanged original receipt by hash.
It does not rewrite historical archives or source hashes. This repair does not
enable compound callbacks or promote installed coverage.
