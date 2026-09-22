# Installed WIT/WASI arrays and copied records

The [machine record](wit-collections-20260922.json) binds ordinary-source and
independently reviewed-IR builds to original archives, parsed WIT and component
types, public callers and separate sanitizer probes.

## Installed calls

The unchanged shared Lean fixture has 35 exports, nineteen primitive element
types, seven record types and a 24-level nested Array. Each source path passes
800,719 assertions across 2,836 public calls, including 75 rejected inputs.
Independent Lean inspectors verify field and array-element contents, including
deliberately altered records. Every installed executable runs twice.

Arrays preserve empty rows, order, repeated elements and nesting. Records retain
field names, order and types, including empty and single-field records.
Keyword field names use percent escapes in WIT source and ordinary labels in
Wasmtime values. Both textual WIT and the compiled Component Model binary are
checked against the independent source signatures.

The callers cover exact primitive ranges, arbitrary-size integers, floating
point edge cases, UTF-8, embedded NUL and binary buffers. Output values do not
share mutable storage with inputs or sibling results and remain valid after
the session closes. Recursive comparisons check field and element contents;
floating point checks distinguish signed zeros and handle NaNs explicitly.

Malformed fields, names, counts, nested values, Unicode scalars and integer
magnitudes reject. Excessive counts and conversion work also reject. Every
failed call leaves its output slot unchanged, and the following valid call
succeeds.

## Reproduction and installation

Each author directory disappears before offline installation from the original
archive. The consumer compiles against the packaged public headers and then
relocates. The producer, handoff and installation project are absent during
execution, with compilers and runtime overrides unavailable. Packaged libraries,
the component and the consumer executable retain their original hashes.

Two independent builds produce identical archives, all 68 package-owned files,
the same public observations and identical consumer executables on each source
path. Temporary deployment paths are recorded separately from the comparison.
The package includes Wasmtime 42.0.1 and the native Lean runtime. Local acceptance
uses the existing test-only glibc 2.36 override; published packages retain their
glibc 2.38 floor.

## Failure probes

Synthetic native buffers exercise the actual generated converters under
AddressSanitizer, UndefinedBehaviorSanitizer and LeakSanitizer. These checks do
not execute Lean. The probe passes 52,227 assertions, including:

- Thirteen injected scratch-allocation failures.
- 4,386 input-budget and 6,941 output-budget failures.
- 1,778 malformed Bool, integer-sign and result-flag checks.
- Eleven malformed inputs and fifteen malformed outputs.
- Eight empty buffers with unusable pointers.
- A partial input failure and two poisoned inactive payloads.

Every entered conversion releases its tracked scratch allocations. Partial
Wasmtime output values can be deleted after a failure. The following valid
conversion succeeds, with no tracked live allocations left behind.

Converters inspect raw boolean bytes before typed reads. Buffer checks reject
null storage for nonempty values, misalignment and overflowing address
arithmetic. Empty buffers do not dereference their pointers. Native callers
still supply valid backing storage; these checks cannot establish an arbitrary
pointer's allocation size. Wasmtime allocation APIs do not expose recoverable
out-of-memory errors.

## Reproduce and scope

Use the pinned tools in the [WIT build guide](../publish/wit-wasi.md):

```sh
LEAN_BRIDGE_WIT_COLLECTION_TEST=1 node --test --test-concurrency=1 \
  tests/wit-collections.test.mjs tests/wit-collection-conversions.test.mjs
node --test tests/wit-collection-contract.test.mjs \
  tests/wit-collection-evidence.test.mjs
```

CI requires both collection reports and reruns List, compound, alias, variant,
primitive-callable and ordinary-package regressions. The machine record retains
the current regression probes without rewriting historical receipts.

Schema nesting stops at 32. Conversion work has a 16 MiB accounting budget;
canonical scratch memory has a 64 MiB cap. These are not limits on the Lean
algorithm's working memory or every Wasmtime allocation.

Inventory 0.76.0 assigns this evidence to 22 reviewed WIT/WASI cells: Array and
record parameters, results and fields, plus sixteen primitive field positions.
The existing Char, USize and ISize field evidence remains separate. Kotlin,
recursive copied values, compound callable payloads and explicitly owned
aggregates are not promoted by this receipt.
