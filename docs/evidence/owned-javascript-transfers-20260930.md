# JavaScript and TypeScript input transfers

VO task 1219. The accompanying JSON receipt records compiler inputs, generated
adapters, execution logs, installed archives and source history.

Ordinary author configuration and independently reviewed contracts compile 26
exports, including 20 consuming exports, for wasm32. Consuming models use schema
8 and private ABI 11. Borrow-only models and generated native adapters retain
their existing formats.

The JavaScript registry reserves each original result owner during conversion.
Native dispatch snapshots the reserved identities for each consuming argument,
validates every argument and atomically transfers those snapshots to the Lean
call. Its non-allocating handoff marks all original owners consumed and sets the
call-frame flag before entering Lean. Reentrant JavaScript reads that flag, so
aliases and sibling wrappers are already unusable inside callbacks. Independent
retains remain valid. Original storage remains pinned until the call returns.

The enabled gate is `npm run test:owned-javascript-transfers`. It covers:

- Both source paths, every export, recursive and mixed records, and empty cases.
- Duplicate owners across arguments, callback borrows, invalid fields, cycles,
  bounds, native allocation faults, JavaScript allocation and publication faults,
  and preserved callback exceptions.
- An installed author CLI and offline component/runtime installations after
  deleting producer sources and outputs.
- Byte-identical package reassembly and rejected capability/source mutations.
- Strict TypeScript, the exact consumer documentation example, and 130 checks
  per run in Node and Chromium, Firefox and WebKit pages, React and workers.
  Each browser context repeats the checks twice using the same Wasm assets.
- A combined reviewed C and JavaScript build with matching ownership contracts.

CI requires zero skipped tests and retains the private and installed reports.
The prior PHP-Wasm receipt remains unchanged. The support inventory refreshes
source hashes without promoting unrelated cells. This receipt does not claim
an independent clean rebuild, Docker acceptance, WIT/WASI transfers or
owner-anchored borrowed results.
