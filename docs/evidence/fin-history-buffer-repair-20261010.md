# Fin history Buffer-reader repair

The Perl 5.36.3 unthreaded job in downstream run
[38071834965](https://github.com/seanmorris/lean-bridge/actions/runs/38071834965/job/114270643906)
failed three history assertions at `d177236`. Each compared the current
`src/build/native-model.mjs` bytes with a different recorded source epoch.
The test readers converted Buffers to text using incomplete, hand-maintained
path lists. The later native-model transition was absent from those lists, so
the historical reader returned the current Buffer unchanged.

The same three assertions failed locally at
`69d82afba73db3ac876f850acd170c8194a238c5`: ten tests, seven passed, three failed,
none skipped. The original [TAP](fin-history-buffer-repair-20261010/local-reproduction.tap)
has SHA-256 `abb42414c2e4e4b9fa5105fcba9b564c2d629dcb14e558250c70ceb98d651f1c`.

The repair uses the existing `beforeFinRefinementSource` Buffer reader with
each inventory file's exact expected digest. It authenticates every applied
transition and stops at the requested epoch. Unknown edits and invalid binary
bytes remain unchanged and fail the digest comparison. Tests cover both
native-model epochs that appeared in the failed job.

The [new source ledger](fin-history-buffer-repair-source-history-20261010.json)
records six exact test-source transitions. Its SHA-256 is
`8aaed5927ae7d934dd754822b3ef1c7941d446017433526fa2ad4c8a9da9d383`.
An independent comparison reconstructs all six predecessors from Git.
The support inventory, production code and every older evidence file remain
unchanged. The inventory still contains 407 evidence entries and 509 observations.

Focused checks passed 18 tests with no failures or skips. Four registered roots
passed 120 tests, failed none and skipped 11 explicit compiler/installed gates.
Their TAP SHA-256 is
`4d9ac640d9ac5b312d134a90f301868e7660ef8ea8396500afb8fc2d3860970b`.
Full lint, type checking and all 16 generated reference-page checks passed.
These results verify the history repair; they do not rerun installed packages
or establish a successful hosted CI run.
