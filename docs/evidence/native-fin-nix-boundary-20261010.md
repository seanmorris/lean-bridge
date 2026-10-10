# Nix Perl engine diagnostic source repair

[Downstream run 38026416897](https://github.com/seanmorris/lean-bridge/actions/runs/38026416897)
at `dc85b2787941cd250ddc694835a75cdd51914f71` failed in the pinned Nix
Perl engine job. The filtered source tree omitted
`src/backends/c/fin-diagnostic.mjs`, which `native-copied-values.mjs` imports.
Node reported `ERR_MODULE_NOT_FOUND` before the engine could build a package.

The repair adds that file to `nix/perl-engine-source-boundary.json`. The
regression copies exactly the manifest's files into an unrelated directory,
imports the native builder, and starts the actual Perl engine entry point.
Removing the diagnostic module then reproduces the missing-module error.
The positive import failed before the repair and passes afterward.

The [source-history ledger](native-fin-nix-boundary-source-history-20261010.json)
retains exact predecessors for the manifest and type inventory at
`a1916306286ae10ce6568e94116fdc2f6b1d7411`. It refreshes eighteen live
manifest hashes without changing observations, support claims or older
evidence. Tests retain the previous diagnostic ledger's complete hash and
its original 246-pin transition. Both new predecessor reconstructions were
independently compared with Git.

Local verification:

- Eight affected regression roots: 283 passed, zero failed, nineteen
  environment-gated skips. TAP SHA-256
  `dcb2d0f3869c516092e30d748a5bb22c8646b3a200d3ea91670eab0292304e27`.
- Perl contract and final filtered-tree controls: 51 passed, zero failed or
  skipped. TAP SHA-256
  `3e1bd3f528ebe7535699cec29d3f22dedd41121d2b73bdf4afeea3d0b04af674`.
- Six focused history controls passed. Changed-file lint and full checked
  JavaScript typechecking passed.

These checks execute Node against the same file selection used by the
flake. Nix is not installed locally; the hosted Nix build remains a
separate acceptance gate. The second failed job in that run, Perl receiver
5.36.3-threaded, failed while downloading Lean because DNS could not resolve
`release.lean-lang.org`. It did not reach package execution.
