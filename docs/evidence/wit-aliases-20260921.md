# Installed WIT/WASI aliases

VO1219 adds installed acceptance for 27 copied aliases over all nineteen
primitives, records and supported containers. The
[machine record](wit-aliases-20260921.json) binds the original source contracts,
package archives, declarations, consumer source and loaded libraries.
Base revision: `f63a440`.

## Names and values

The WIT source and compiled Component Model binary retain alias names, chains,
parameter and result references, and original record-field types. Independent
checks reject a flattened alias chain even when its representation is unchanged.
Containers with different named element contracts keep distinct type references.
The installed binding manifest and README document the original names and
targets. Callers use ordinary Wasmtime values without alias wrapper resources.

Aliases use WIT's [named type declarations](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md#item-type-alias).
Their separate declaration graph retains the existing native converter indices.
Generated native conversion source is byte-identical to the preceding
implementation for the alias, List, compound and primitive-callable fixtures.
Alias-free WIT, component source and binding manifests are also unchanged.
An alias sharing a function's WIT spelling receives an `alias-` prefix. This
keeps existing exports such as `deep` callable when the source also defines
`Deep`; the manifest records the final WIT name.

## Installed execution

The unchanged shared Lean fixture exports 31 functions. Ordinary-source and
independently reviewed-IR builds each install the original archive offline,
after removing producer sources. The consumer compiles against packaged public
headers, relocates, and runs twice after removal of the installation project
and handoff. Execution has no compiler or runtime override. All five packaged
libraries load from the relocated directory; their bytes, the component and
the consumer executable remain unchanged.

Each execution passes 409,138 assertions across 2,653 calls, including 43
rejections followed by successful recovery. The checks cover all nineteen
primitive targets, integer limits, 5,121-bit magnitudes, IEEE special values,
Unicode, embedded NUL and binary data. Lean independently checks all nineteen
fields of a record and rejects eighteen single-field changes.

Other calls check Count wraparound, aliases used only as results, nested Option
presence, both result branches, List/Array ordering, duplicate elements and
record fields. Results retain independent storage after input destruction,
mutation of a sibling result and session close. Invalid types, fields, UTF-8,
Unicode scalars, noncanonical integers, tuple arity, missing buffers, excessive
counts and cyclic values reject before Wasmtime copies them. Budget failures
leave output slots unchanged and recover before a valid 30,000-byte output.

The first installed attempt caught an extra limb in the test's large-integer
input. The independent Lean `inspect` result was false. Correcting that test
input made the source and reviewed-IR runs pass; the algorithm was unchanged.

## Separate conversion probe

A synthetic contract wraps all copied levels and public sites in nine aliases,
including chains. It does not execute Lean. AddressSanitizer, LeakSanitizer and
UndefinedBehaviorSanitizer report no errors. Its 15,006 assertions cover four
scratch-allocation failures, 1,172 input-budget failures, 812 output-budget
failures, eleven malformed outputs, two malformed input buffers, an empty
poison pointer and three inactive payloads. Tracked live allocations return to
zero, and the next valid conversion succeeds.

## Reproduce

Use the [WIT author toolchain](../publish/wit-wasi.md#build-an-ordinary-lean-project)
with Lean 4.32.2, Wasmtime 42.0.1, wasm-tools 1.245.1 and a C compiler:

```sh
LEAN_BRIDGE_WIT_ALIAS_TEST=1 node --test --test-concurrency=1 \
  tests/wit-aliases.test.mjs tests/wit-alias-contract.test.mjs \
  tests/wit-alias-conversions.test.mjs
node --test tests/wit-alias-evidence.test.mjs
```

CI retains `build/aliases/wit.json` and `build/aliases/wit-conversions.json`.
The local run used GCC 12.2.0 and the explicit glibc 2.36 test override;
the supported CI package floor remains 2.38. Producer and consumer temporary
directories are removed between source paths. No registry package was published.

## Regression checks

The final alias rebuild reproduced both archive hashes. Existing installed
List, compound and primitive-callable suites pass on both source paths; the
callable component checks use the pinned Wasmtime SDK explicitly. The full
contract suite passed 1,599 tests with 67 gated skips. Site tests passed 111
checks, and repository-free CLI packaging passed five. Lint, root and site
typechecks, reference checks and the production site build passed.

The CLI package allowlist, Nix engine source boundary and JavaScript checking
inventory include the new WIT alias module. CLI installation tests import the
WIT generator from the packed archive to catch missing dependencies.

## Scope

Copied alias parameters, results and fields now have installed acceptance across
17/17 profiles and both source paths. Native/PHP-Wasm/WIT variants, bounded
recursive values, compound callable payloads and explicitly owned aggregates
remain in VO1219. Types remain limited to 32 levels. Host/native conversion
budgets and the 64 MiB canonical scratch cap are unchanged. Callers supply valid
C storage; Wasmtime's allocation API has no recoverable out-of-memory result.
