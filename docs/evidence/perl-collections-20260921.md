# Compiled Perl arrays and records

VO1219 adds installed evidence for copied arrays and records on both source
paths. The 35-export fixture reuses the independently specified npm Array and
record contracts. It covers all nineteen primitives, seven record types and
24 fixed levels of Array nesting. This is an acyclic schema, not a recursive
copied type.

## Installed validation

```sh
export LEAN_BRIDGE_PERLS='["/absolute/path/to/5.36.3-threaded/bin/perl","/absolute/path/to/5.36.3-unthreaded/bin/perl","/absolute/path/to/5.38.2-threaded/bin/perl","/absolute/path/to/5.38.2-unthreaded/bin/perl"]'
LEAN_BRIDGE_PERL_COLLECTION_TEST=1 node --test tests/perl-collections.test.mjs
node --test tests/perl-collection-contract.test.mjs tests/perl-collection-evidence.test.mjs
```

All eight source-path/ABI combinations pass 239,954 public assertions across
3,008 calls, including 132 rejection/recovery cases. Each consumer executes
twice. The [machine-readable record](perl-collections-20260921.json) binds source,
interpreter, original archive, receipt, probe and installed-file identities.

The suite removes author sources before installing the original runtime and
component archives offline in `prebuilt-only` mode. It relocates each
installation and removes the archive handoff before compiler-free execution.
All five loaded package libraries match their recorded hashes. Installed files
remain unchanged. The public caller uses no private converters, native layouts
or JSON value transport.

An independent rebuild reproduces both archives, all loaded libraries and the
installed payloads for every source-path/ABI combination. Three installation
metadata files differ because their paths change: `perllocal.pod` and the two
`.packlist` files. The record lists those exceptions and their hashes.

Inputs and results cover integer limits, exact 5,121-bit values, Float32 rounding,
signed zero, subnormals, infinities, NaN classification, Unicode scalars and
embedded NUL. Lean independently interprets boxed Array elements and primitive
record fields. Empty and single-field records, reversed field layouts, nested
arrays of records and repeated references preserve their meaning. Mutating
inputs or returned payloads does not change sibling copies.

Invalid containers, tied or sparse arrays, subclasses, wrong record classes,
missing or extra fields, unnamed constructor arguments, invalid scalars and
fixed-schema cycles reject. Oversized inputs and results reject without
preventing later calls. A generated 30,000-element Array also executes.

## Reentrant conversion and cleanup

The new installed caller reproduced a conversion bug: clearing an Array during
`Math::BigInt::bstr` made a later slot disappear. Array and record converters now
pin all input slots before invoking child converters. Records also require the
exact generated class and an untied hash. Constructors reject malformed named
arguments. Record keyword arguments keep Perl's last-value-wins hash semantics,
including `new(%old_fields, field => $replacement)`. Field names that would
replace Perl object methods or phase hooks fail before linking.

A separately compiled test-only copy of XS leaves the installed package files
untouched. Each source-path/ABI combination passes 1,187 checks:

- 1,141 injected failures after ownership registration, budget accounting,
  value retention or output insertion. Runtime snapshots show zero live scopes,
  callbacks and resource wrappers after each failure, followed by a successful call.
- 32 partial Array/record input failures, with weak-reference cleanup checks.
- Eight `Math::BigInt` input/output exceptions preserving the original exception
  object.
- Six reentrant record-field and outer-array mutations. The public caller also
  checks three inner-array mutations.

## Coverage

The inventory advances twelve Array/record cells across copied parameters,
results and fields on both paths, plus sixteen previously unaudited primitive
record fields on the reviewed path. Existing ordinary primitive-field, Char
and machine-word evidence remains unchanged. The older limited callback
observation remains limited; these checks do not establish compound callbacks.

Perl Arrays and records share a 16 MiB conversion budget and a 32-level schema
bound. These limits do not bound all host allocations or Lean working memory.
Recursive copied data, compound callable completion and explicitly owned
identity-bearing aggregates remain separate work.
