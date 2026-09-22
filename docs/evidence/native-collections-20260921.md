# Compiled C and C++ arrays and records

VO1219 adds installed evidence for copied collections on both compiler-checked
source paths. The independent 35-export contract covers nineteen primitives,
seven records and 24 fixed levels of Array nesting. These are acyclic schemas;
this suite does not establish recursive copied types.

## Installed validation

```sh
LEAN_BRIDGE_NATIVE_COLLECTION_TEST=1 node --test tests/native-collections.test.mjs
node --test tests/native-collection-contract.test.mjs tests/native-collection-evidence.test.mjs
```

Both ordinary-source and reviewed-IR packages produce these results per execution:

| Public caller | Assertions | Calls | Rejected inputs/results | Injected host allocation failures |
| --- | ---: | ---: | ---: | ---: |
| C/GMP | 87,265 | 2,752 | 91 | 0 |
| C++ | 71,265 | 3,244 | 12 | 80 |

Each installed caller executes twice. The
[machine-readable record](native-collections-20260921.json) binds signatures,
source trees, original archives, receipts, dependencies, consumers and probes.

The suite removes author sources before extracting the original archives and
compiling the host callers offline. It removes host sources, compiler helpers
and archive handoffs, relocates the installation, then executes without Lean
or host compilers. All installed files and loaded libraries retain their
recorded identities. Public C uses GMP `mpz_t`; C++ uses the packaged Boost
headers. Neither caller uses private converters or Lean object layouts.

An independent rebuild reproduces both original archives for each source path,
all 34 C package files, all 224 C++ package files and every public observation.
Consumer and probe executable hashes are retained separately; temporary
compiler paths can make those independently compiled executables differ.

The publisher's `Parcels` Lean example also compiles into original C and C++
archives. The consumer examples execute after author and handoff removal,
printing `Seeds: 7, 2`; C++ then prints `7` after checking independent copies.
The record retains the example source hashes, archive identities and output.

Cases include integer limits, exact 5,121-bit values, Unicode and embedded NUL,
Float32 subnormals, infinities, NaN classification and signed zero. Lean
independently interprets every primitive Array element and record field.
Empty arrays, repeated elements, empty and single-field records, differently
ordered fields and nested arrays of records preserve their meaning. Mutating
returned payloads does not change inputs or sibling copies.

Calls reject invalid Unicode scalars, malformed UTF-8, negative naturals,
nonzero Unit, null nonempty spans, excessive lengths and over-budget copies.
A generated 30,000-element Array executes after rejecting an oversized result.
C pointers must still refer to valid storage for their declared lengths.

## Failure cleanup and sanitizer baselines

Separate instrumented copies leave the installed archives untouched and execute
the real compiled Lean functions. The native adapter probe passes 8,630 checks,
including 2,720 allocation failures, fifteen malformed-input/budget cases and
sixteen synthetically injected invalid native Unicode scalars. The C/GMP facade
probe passes 89,819 checks, including 1,296 allocation failures and 96 rejected
calls. Sixteen successful replacements release the caller's previous payload
exactly once; failed replacements preserve it.

Tracked bridge allocations return to zero after every failed conversion.
The probes run AddressSanitizer, LeakSanitizer and UndefinedBehaviorSanitizer.
They retain both the untouched startup report (128 bytes in twelve GMP
allocations) and the initialized-fixture report (384 bytes in twenty).

Lean creates persistent numeric constants when `record_inspect` and
`array_check_elements` first execute. Generated C uses `lean_obj_once` for those
constants. One initialization and 1,000 repeated initializations have identical
reports. Full conversion and failure-probe execution must match that warmed
report exactly. This checks for growth without claiming that the process has
zero runtime-owned allocations.

The installed C++ caller separately fails all eighty host allocation
checkpoints in a nested-record call. Each exception restores the tracked host
allocation baseline, and a later call succeeds.

## API corrections and coverage

The audit found that a valid Lean record field named `char` failed C-family
generation. Record members now retain snake_case normalization and append an
underscore to C/C++ keywords. Collisions after normalization still reject.
Generated declarations, native conversion and cleanup agree on names such as
`char_`.

C++ records now provide defaulted value equality even when their package has
no variants. Nested values compare field by field. Floating-point fields keep
C++ equality, including NaN inequality and equal signed zeros; conversion
preserves the sign of zero separately.

The inventory advances forty reviewed-path cells: twelve copied Array/record
positions and twenty-eight primitive record fields across C and C++.
Existing ordinary-source evidence, previously completed numeric fields and
callback claims retain their scope.

Copies share a 16 MiB conversion budget and a 32-level schema bound. Those
limits do not bound Lean working memory or every host allocation. Bounded
recursive copies, compound callable completion and explicitly owned
identity-bearing aggregates remain unfinished work.
