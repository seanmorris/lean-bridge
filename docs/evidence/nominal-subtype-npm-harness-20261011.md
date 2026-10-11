# Nominal Subtype npm acceptance harness

This milestone prepares installed acceptance for VO #1444. It does not record
a successful installed package run or promote a support cell. Full builds are
paused in response to the host-load report.

## Fixture and callers

`tests/fixtures/onboarding/nominal-subtypes/NominalSubtypes.lean` contains only
safe definitions. The full selection exports 26 functions; the result-only
selection exports 13 functions without any input constructor choice.
`tests/helpers/nominal-subtype-installed-fixture.mjs` independently specifies
both reviewed APIs and ordinary export configurations.

The full caller distinguishes two valid constructors for the same nominal type:
40 becomes 41 or 42 according to the input site. It covers records, repeated
record fields, variants, aliases, optional array elements, both result branches,
late constructor refusals, mixed Fin guards, input preservation and recovery.
Result checks include values above both input-constructor limits, empty branches
and 100-bit Nat values. Outputs must project their existing Lean values.

The portable JavaScript caller lives under
`tests/fixtures/nominal-subtype-consumers/`, alongside strict TypeScript examples.
It reuses the structural caller's type-sensitive snapshot function. Unit mutation
tests reject wrong constructor choices, precision loss, wrong projected values
and mutation of rejected inputs. These units use an explicit JavaScript runtime
double, not Wasm or Lean entry counters.

## Installed gate

`tests/helpers/nominal-subtype-npm-installed-tests.mjs` defines four gated cases:
ordinary/reviewed source, each with the full/result-only export selection. Each
case requires two author roots to reproduce the binding identity, receipt and
both npm archives. It removes both author roots, installs offline with a Node-only
PATH, compares installed files with the verified archive contents, and runs the
JavaScript and strict TypeScript callers. It then moves the installed consumer
directory, verifies that its original location is absent, and replays unchanged
callers against unchanged package bytes.

The gate records runtime versions, caller hashes and original build and execution
records. It explicitly reports that Wasm constructor/source entry counts are not
measured. It is imported by the existing component-refinement test root; ordinary
contract runs skip its four expensive cases.

After preparing the component engine and shared runtime, run one case serially
with a new output directory:

```sh
LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST=1 \
LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES=ordinary \
LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES=full \
LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT=build/nominal-npm-run-1 \
nice -n 19 ionice -c 3 taskset -c 3 \
  node --test --test-concurrency=1 \
  tests/helpers/nominal-subtype-npm-installed-tests.mjs
```

`LEAN_BRIDGE_LAKE_ENGINE` selects the locked engine; without it, the harness uses
the local component engine. `LEAN_BRIDGE_LAKE_RUNTIME_ROOT` selects the prepared
runtime directory. The defaults match the existing structural npm harness.
Existing output directories are refused. Failed build inputs remain available
for diagnosis; successful temporary installations are removed.

## Verification completed

- Lean 4.32.2 checked the fixture with `-j1` and no diagnostics. This was a source
  type check, not a generated-adapter or package build.
- The registered component-refinement and test-profile roots passed 32 tests,
  with zero failures and five explicit skips: the existing Lean source gate and
  the four new installed cases.
- Both strict TypeScript examples passed. The generated-API unit double exercised
  3,172 checks and 1,032 refusals for the full caller, and 2,078 checks for the
  result-only caller.
- Targeted ESLint and `git diff --check` passed.

The test log is `build/vo1444-nominal-npm-harness-regression-r1.tap`, SHA-256
`c11d1db33fd12af2ef706b23d9def61990a59f4e9b522b362acfcf79a0b4a3e0`.
The Lean fixture SHA-256 is
`a6a8860e98d12739ef16ea0b92b003a9e752326f39517dfe7eeb9d8b53ef3108`.

Next: execute all four npm cases, inspect their original reports, and add native
consumer callers for the shared fixture. Browser and PHP-Wasm acceptance, actual
entry probes and the remaining callback, owned, recursive, generic and
checked-record requirements of #1220 remain open.
