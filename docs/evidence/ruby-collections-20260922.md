# Compiled Ruby arrays and records

VO1219 adds installed collection evidence for ordinary-source and independently
reviewed Ruby gems. The 35-export contract covers all nineteen primitives,
seven record types and 24 fixed Array nesting levels.

## Installed validation

Use MRI Ruby 3.3 with the pinned author toolchain:

```sh
LEAN_BRIDGE_RUBY_COLLECTION_TEST=1 node --test tests/ruby-collections.test.mjs
node --test tests/ruby-collection-contract.test.mjs tests/ruby-collection-evidence.test.mjs
```

Both source paths pass 167,545 assertions across 3,225 public calls and 118
rejections per execution. Each installed consumer runs twice, before and after
a separate failure probe. The [machine-readable record](ruby-collections-20260922.json)
retains compiler signatures, original gems, source and consumer identities,
loaded libraries, installed files and both independent build logs.

The suite removes author sources before installing the original gem offline.
It relocates the installation and removes both the archive handoff and RubyGems
cache before executing without Lean or native compilers. All 24 installed files
and four loaded shared libraries retain their recorded identities. The public
consumer calls generated methods and value classes; it does not access Fiddle,
private converters or Lean object layouts.

An independent rebuild reproduces both original archives, every installed file
and all public observations. The ordinary and reviewed archives retain distinct
source receipts; their compiled native libraries are identical.

Cases cover exact 5,121-bit integers, fixed-width limits, Float32 and Float64
subnormals, infinities, NaN classification, signed zero, Unicode, embedded NUL
and binary strings. Lean independently checks each primitive element and record
field. Empty and single-field records, different field orders, nested arrays,
repeated values and independent mutable copies retain their meanings. A
30,000-element result succeeds after an oversized result is rejected. GC
compaction and four concurrent Ruby threads repeat public calls.

The publisher's `Parcels` example builds into an original gem. Its Ruby caller
executes after offline installation, source removal and relocation. It prints
`Seeds: 7, 2`, checks record value equality, mutates the returned array and prints
the unchanged input `[2, 7]`. The record retains both snippets' hashes, archive
identity and output.

## Snapshot and value semantics

The audit reproduced two defects in input conversion. An exact String can
override `bytesize`, supplying one size for allocation and another for copying.
An exact Array can override `length` or indexing and change which elements reach
Lean. Fiddle pointer sizes do not enforce write bounds.

Converters now bind builtin exact-type and identity checks. They charge the
actual String length or Array slot count, take a bounded frozen snapshot, and
use that snapshot's length for allocation and copying. String encoding checks
also use builtin methods. Record and variant fields, Option/Result payloads and
binary product entries are captured before nested conversions or allocation.
Overridden accessors cannot replace stored fields during conversion.

Installed public checks cover overridden String and Array methods and type
spoofing. Separate generated-converter tests mutate source values during
allocation to check pinned snapshots. These converter-only tests do not claim
additional compiled Lean executions.

Generated records and variant constructors implement nominal field-by-field
`==`, `eql?`, `hash` and `deconstruct_keys`. Contents follow Ruby equality rules,
including floating-point behavior. Objects are frozen; nested arrays and strings
remain mutable. Changing those payloads while the containing value is a Hash
key can invalidate lookup. Generated field names preserve the shared native
model's keyword escaping, including `char_`.

## Failure cleanup

A separate Ruby process instruments installed methods in memory without
rewriting package files. It injects `NoMemoryError` at 842 conversion,
allocation, buffer-retention and constructor checkpoints. The probe checks all
retained Fiddle pointers are freed, scratch collections are empty, and each
started native aggregate call has exactly one output-clear call. A later public
call must succeed after every injected failure.

The probe also checks 64 partial invalid inputs, four malformed sequence
descriptors and four invalid native Unicode scalars. It instruments 178 generated
conversion methods and probes all seven record constructors. Native descriptor probes
remain separate from the public consumer's independent expected results.

## Coverage and limits

The inventory advances twenty-two reviewed-path cells: six Array/record
positions and sixteen primitive record fields. Earlier ordinary-source,
character, platform-word and callable evidence retains its scope. Existing
compound, List, alias, variant, primitive-callable and original Ruby package
regressions pass with the new converters.

Copies remain acyclic, with a 32-level schema limit and shared 16 MiB native
input/output budget. Ruby scratch has a separate 16 MiB budget. These limits do
not bound every host allocation or Lean working memory. Snapshots do not provide
an atomic view of concurrently mutated nested values. Bounded recursive copies,
compound callable payloads and explicitly owned identity-bearing aggregates
remain unfinished work.
