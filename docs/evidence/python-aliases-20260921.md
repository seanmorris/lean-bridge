# Installed Python copied aliases, 21 September 2026

Prepared Python wheels preserve 27 concrete copied aliases, including all
nineteen primitive targets, chains, copied records and nested arrays, Lists,
options, results and binary products. The generated module, stubs, function
annotations and record fields retain their public names. `TypeAlias`
declarations use the target's normal Python values without `NewType` wrappers.
Record aliases are the same frozen dataclass. Container inputs still accept
exact lists or tuples; results own independent tuples.

## Installed checks

The fixture specifies reviewed IR independently of compiler extraction.
Ordinary-source and reviewed-IR builds each install offline from the handoff
after producer sources and staging are removed. Each wheel passes 4,460 checks,
then repeats them after moving the installed virtual environment. Consumer
execution has no Lean or C compiler on PATH and no loader-path override.
Every file in the installed package receipt retains its size and SHA-256.
Both source paths produce identical native libraries.

The independent Python consumer covers exact 5,121-bit integers, fixed-width
and native-word endpoints, Unicode and NUL, IEEE special values, all nested
Option Unit states, both result branches, mutable inputs and independent copies.
Lean inspects all nineteen record fields. Eighteen one-field mutations change
its result; invalid Unit is rejected at the boundary. Invalid values, cycles,
oversized inputs and oversized results reject and the next call succeeds.
Injected Python result-conversion failures trigger native output cleanup and
release scratch ownership before recovery.

Strict mypy 1.17.1 checks the installed stubs and a public-API consumer before
and after relocation. Eight invalid examples must each produce a type error,
including an attempt to modify a frozen record. The accepted typed consumer
also executes. An initial probe exposed that mypy rejects `NoneType` as a type
alias target; the generated Unit alias now uses `TypeAlias = None`.

The existing compound consumer assumed every export except Option and Result
was a class or function. It now checks the public `Deep` alias against the exact
24-layer option type instead of passing a type alias to `get_type_hints`.
The historical compound receipt retains its original consumer and archive hashes.
A narrowly scoped reconstruction authenticates the old consumer bytes after
removing only that added inspection; tests reject unrelated edits or a changed
expected depth. The current installed run records the updated consumer hash.

The local host has glibc 2.36. These recorded wheels use the existing test-only
floor override and carry the matching manylinux tag. The production and CI
default remains glibc 2.38. The first local installation rejected that default
tag as incompatible before the test selected the host's floor.

```sh
python3 -m venv build/python-alias-typecheck
build/python-alias-typecheck/bin/python -m pip install --no-cache-dir \
  mypy==1.17.1 typing_extensions==4.16.0 mypy_extensions==1.1.0 pathspec==1.1.1
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_PYTHON_ALIAS_TEST=1 node --test tests/python-aliases.test.mjs
node --test tests/python-alias-contract.test.mjs
```

CI runs the installed suite at its default floor and requires
`build/aliases/python.json`. The [source-bound receipt](python-aliases-20260921.json)
records both wheel hashes, native libraries, runtime checks, strict type checks
and independent consumer hashes. Inventory 0.47.0 promotes only six Python
alias cells: parameter, result and field on each source path. Historical archive
identities remain unchanged.

## Regression results

The full contract suite passes 1,544 checks with 66 explicitly gated skips.
Documentation tests pass 76 checks and the site passes 111. Lint, repository and
site type checks, generated references and the production site build pass.
Existing installed Python wheel checks cover reproducibility, runtime sharing,
fork rejection and tamper detection. Both source paths also pass 49,937 callable,
11,295 compound and 78,423 List checks per consumer. The compound count includes
the two new Deep alias checks; its historical receipt keeps the earlier count.

One concurrent contract run hit ENOSPC in an unprivileged CLI installation check
while the larger native test held its temporary files. After that test finished
and cleaned up, the complete contract suite passed without changing its checks.

Native variants, recursive aliases, compound callable payloads and
identity-bearing aggregates remain outside this installed fixture. VO1219
retains those requirements and all seventeen consumer profiles.
