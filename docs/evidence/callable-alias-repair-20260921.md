# Alias CI regression repairs, 21 September 2026

[Consumer CI run 35562920527](https://github.com/seanmorris/lean-bridge/actions/runs/35562920527)
failed in all four Perl XS configurations after copied alias preservation.
Fresh extraction treated `abbrev Unary := Word → Word` as a copied alias and
rejected an existing specialized callback export. Its early failure also masked
the intended rejection points in four changed-contract tests.

The extractor now passes the current ownership context through alias expansion.
A top-level function alias keeps its callback contract, and a configured resource
alias keeps its resource contract. Copied containers and record fields still
reject hidden callbacks and resources. Primitive callable payloads normalize
their aliases only after definition, cycle and nesting validation.

A second failure came from the forged-ABI test. Changing only an alias's ABI now
fails the earlier alias/target consistency check. The test retains that rejection
as `alias-abi`. Its independent compiler probe changes each repeated alias and
target consistently, then requires the C compiler to reject disagreement with
Lean's emitted prototypes. Both failures must leave no linked or staged output.

The original local rejection run reproduced seven failures. After the repair,
all twenty focused checks pass. A new compiler regression passes in both metadata
profiles: function-alias chains keep callback ownership, primitive payloads keep
their exact type, and copied containers, copied records and excessive alias depth
still reject. The existing three copied-alias metadata checks also pass.

```sh
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test \
  --test-name-pattern 'native specializations reject|native extraction rejects forged' \
  tests/perl-native.test.mjs
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test \
  tests/compiler-callable-aliases.test.mjs tests/compiler-alias-metadata.test.mjs
```

The installed specialization test passes with Perl 5.38.2 unthreaded and this
machine's glibc 2.36. It builds identical archives from relocated source trees,
installs the package without producer sources and executes the specialized
callback/closure API. The CPAN component archive SHA-256 is
`46d9c7d371e2f162aba70528383d29ea5ed7f5b314f50454837634cb90919a79`.
The existing local test setting chooses the matching glibc floor; production and
CI defaults remain unchanged.

```sh
LEAN_BRIDGE_PERL_NATIVE_TEST=1 \
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-unthreaded/bin/perl \
node --test --test-name-pattern 'native finite specializations reproduce' \
  tests/perl-native.test.mjs
```

The same CI run failed two npm declaration checks. Both reproduced locally after
successful compiled, offline-installed execution: the checks expected reduced
primitive signatures where the public API now preserves `Word`. The custom
project must declare `Word = bigint` and use it in `add`; the generic specialization
must declare `Word = number` and use it in `echoWord`. Exports selected with plain
`UInt32` still require `number`, including `chooseWord`, `firstWord` and `plainWord`.
The repaired assertions require those exact declarations rather than accepting
either spelling.

```sh
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/unlocked-component.test.mjs
```

The enabled unlocked-build suite passes 28 checks. Its only skipped check needs
an unprivileged user to exercise an unwritable directory; this local run uses
root. Specialization and publication dry runs also verify clean-clone
reproducibility and package receipts. The finite-specialization component archive
SHA-256 is `f71b78d8e8cc9ed11b685593ad440683c55a4407935fbd288cd00bdf5408ac1b`.

The full contract suite passes 1,539 checks with 66 explicitly gated skips.
The separate compiler-analysis and elaborated-metadata suites pass all 34 checks
with both compiler gates enabled. All 57 historical archive inventories and the
installed coverage matrix remain unchanged.

This repairs existing callable behavior. It does not promote compound callable,
recursive or identity-bearing aggregate coverage. VO1219 remains open.
