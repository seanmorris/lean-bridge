# Compiled Python arrays and records

VO1219 adds installed collection checks for original ordinary-source and
independently reviewed wheels. The 35-export contract covers all nineteen
primitives, seven record types and 24 fixed Array nesting levels.

## Installed validation

Prepare CPython 3.11 and 3.12, the pinned checker and the offline dependency wheels
as described in [contributor testing](../contributing/testing.md), then run:

```sh
LEAN_BRIDGE_PYTHON_COLLECTION_TEST=1 node --test tests/python-collections.test.mjs
node --test tests/python-collection-contract.test.mjs tests/python-collection-evidence.test.mjs
```

Each source path runs on Python 3.11.16 with `typing_extensions` 4.6.0 and 4.16.0,
and on Python 3.12.14 without the backport. Each configuration passes 158,365
assertions across 3,225 public calls and 119 runtime rejections. The
[machine-readable record](python-collections-20260922.json) binds signatures,
original archives, installed files, dependency identities, callers and build logs.

The suite removes the author project before offline installation. Pip resolves
the original wheel's declared dependencies from a checksummed local feed, without
`--no-deps`. It checks all 28 installed receipt files and four loaded native
libraries against the original package. The consumer uses the public Python API.
After relocation and handoff removal, public callers run twice without compilers.
Installed package and dependency files remain unchanged after execution and the
separate in-memory failure probes.

An independent rebuild reproduced original archives, installed package files,
public results, failure counts, dependency identities and compiler checks.
Runtime annotation timings were measured independently and stayed below the two-second limit.
Dependency bytecode paths do not establish archive reproducibility.

Cases cover 5,121-bit integers, fixed-width limits, both floating-point widths,
subnormals, infinities, NaNs, signed zero, Unicode, embedded NUL and byte arrays.
Lean independently checks primitive elements and record fields. Empty and
single-field records, changed field order, nested arrays and independent copies
retain their meanings. Four workers exercise 256 concurrent public calls.

## Public types and field names

Arrays accept exact lists or tuples and return owned tuples. Records use generated
frozen dataclasses with named fields. Python keywords and reserved field names
gain a trailing underscore; the native layout retains the Lean field meaning.
Conflicting projected names stop generation. Record classes remain distinct,
and dictionaries or subclasses cannot stand in for a generated record.

Dataclass equality compares fields recursively using Python's normal comparison
rules. Caller-supplied list fields remain mutable and compare differently from
tuple fields. Returned arrays are tuples and returned byte arrays are bytes.

Deep runtime annotations use shared `TypeAliasType` nodes to bound repeated
expansion. Python 3.12 supplies the type; pip installs the declared backport on
Python 3.11 when needed. Shallow annotations and exact static list-or-tuple types
remain unchanged. The suite resolves every public annotation and independently
walks all 24 nested array levels.

The suite executes the valid caller after strict checking with mypy 2.3.1.
The checker reports thirteen expected errors in the invalid caller. Each process has a 30-second
deadline and a 1 GiB address-space limit. Mypy 1.17.1 expands this fixture's nested
union aliases excessively, so the collection checker uses a separate environment.

## Failure cleanup and documentation

Each isolated in-memory probe checks 80 allocation failures, 305 conversion
failures, 64 partial inputs and seven malformed native values. It observes 405
output-clear calls and checks later calls recover. Original installed files are
never patched. Separate converter checks reject misaligned nonempty buffers,
ignore unused pointers on empty buffers and enforce shared text conversion
accounting with released scratch after failures.

The suite also compiles the publisher's Parcels example and executes the actual
consumer documentation example twice from its relocated original wheel. It prints
`Seeds: 7, 2`, leaves the input list unchanged and returns tuple-valued counts.
This shallow package needs no typing backport, including on Python 3.11.

## Coverage

The inventory advances 22 reviewed-path cells: six Array/record positions and
sixteen primitive record fields. Earlier ordinary-source, character, platform-word
and callable evidence retains its scope. List, compound, alias, variant,
primitive-callable and native-package regressions cover the updated converters.

Copies remain acyclic, with a 32-level schema limit. Python conversion accounting
and native input/output copying each have a 16 MiB budget. These limits do not
bound every Python allocation or Lean working memory. Recursive copied values,
compound callable payloads and explicitly owned aggregates remain unfinished work.
