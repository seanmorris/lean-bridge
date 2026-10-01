# Native PHP borrowed results

Plan node: 1219. The [execution receipt](owned-php-borrows-20261001.json)
binds compiler inputs, generated sources, installed packages and consumer
observations to this source revision. Earlier receipts remain unchanged.

Packages with anchored results expose whole `Value` owners. `get()` checks
the original owner, `share()` keeps another root for that owner, and `retain()`
makes an independent owner. Closing the last root expires borrowed descendants,
including empty arrays and `None`. Resource views extracted through `get()`
borrow the whole owner. Consuming calls hand off the original native slot.

Run the complete gate with:

```sh
source scripts/env.sh
npm run test:owned-php-borrows
```

All ten tests pass without skips. Both ordinary-source and reviewed-IR probes
execute 2,332 checks across 26 public exports, including 19 anchored results and
four consuming exports. They cover recursive values, empty owners, shared
roots, independent retains, canonical resource identity, callbacks, returned
closures, reentry, and fork/Fiber rejection. Fault injection exercises PHP
checkpoints and native allocations before and after consuming handoff. Each
probe retains 379 exceptions while checking cleanup. Final native allocation
and identity counts are zero. Five deliberately broken PHP implementations must
parse successfully and then fail the semantic consumer assertions.

Both Composer archives install offline after removing the producer. The
installed consumers execute after removing the handoff and relocating the
installation. Each path passes 176 checks in weak and strict PHP modes, twice
per mode. The loader verifies private GMP, all five compiled libraries, and
automatic shutdown with no live identities. The gate rejects changed,
symlinked and missing libraries and nine forged package contracts or artifacts.
Reassembling each archive produces identical bytes.

A separate borrow-only probe executes empty-value lifetime checks on both
compiler paths. The unchanged documentation example executes from a relocated,
combined C/Composer release and prints `42`, `expired`, `42`.

Anchored packages use PHP ownership and binding manifest schema 3. The
verifier reconstructs generated PHP and C sources from authenticated compiler
inputs and compares the installed inventory with the package receipt.
Unanchored packages retain their prior generated API and source bytes.

Receiver-anchored and callback-result-anchored contracts, PHP-Wasm, the remaining
consumer projections and the final Docker audit remain unfinished. This
receipt does not promote support-table cells or claim registry publication.
