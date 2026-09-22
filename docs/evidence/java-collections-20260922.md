# Compiled Java arrays and records

VO1219 adds installed collection evidence for ordinary-source and independently
reviewed Maven packages. The 35-export contract covers all nineteen primitives,
seven record types and 24 statically typed Array nesting levels.

## Installed validation

Use the pinned JDK 22, Maven and author toolchain:

```sh
LEAN_BRIDGE_JVM_COLLECTION_TEST=1 LEAN_BRIDGE_JVM_COLLECTION_PROFILES=java \
  node --test tests/jvm-collections.test.mjs
node --test tests/jvm-collection-contract.test.mjs tests/java-collection-evidence.test.mjs
```

Each source path passes 158,171 assertions across 4,435 public calls and thirty
runtime rejections. Eight invalid callers fail with their expected compiler
diagnostics. The [machine-readable record](java-collections-20260922.json)
retains source signatures, original archives, installed files, compiler identities,
public caller hashes and two independent build logs.

The suite removes the author project before offline installation into an empty
Maven repository and user home. Maven resolves only the original JAR. The suite
verifies all 49 installed files, the POM and four bundled native libraries against
the package receipts. Consumers call typed public methods and record accessors.
Foreign-memory layouts and native conversion functions remain private.

After relocation, the suite removes the consumer project, sources, Maven cache
and handoff. A separate runtime contains only `java.base`. The public caller runs
twice there, including the exact arrays-and-records example from the Java guide.
Its output is checked independently. Both executions leave the package, runtime
and consumer classes unchanged and remove extracted native assets on shutdown.
An independent rebuild reproduces the original archives, installed contents,
dependencies and public observations. The two source paths have distinct source
receipts and identical native libraries.

Cases cover 5,121-bit integers, unsigned and signed limits, floating-point
subnormals, infinities, NaNs, signed zeros, Unicode, embedded NUL and byte arrays.
Lean independently checks every primitive element and record field. Empty and
single-field records, changed field order, repeated values, empty rows and
independent mutable copies retain their meanings. Four threads repeat 256 calls.
Oversized copies reject; a later valid call succeeds.

## Value equality and field names

Generated records, named variant cases, `Option`, `Result` and `Pair` compare
nested payloads by contents and produce matching hashes. Nominal record and
constructor identities remain distinct. Floating equality follows Java: NaNs
compare equal and positive and negative zero differ. Conversion tests separately
check the preserved floating-point bits.

Standalone arrays retain JVM reference equality. Use `Arrays.equals` or
`Arrays.deepEquals` in Java, or `contentEquals` or `contentDeepEquals` in Kotlin.
Arrays inside records remain mutable. Do not mutate their contents while the
containing record is a map key or set member.

A host-only compiled test passes 32,069 Java and 15,642 Kotlin equality/hash
checks across collections, compounds, Lists, aliases and variants. It loads no
Lean library and does not establish Kotlin installed collection acceptance.
Installed Java callers separately check record equality after copying through Lean.

Record accessors now escape Java keywords and preserve distinguishing trailing
underscores from the original Lean field names. Names that collide after
conversion still reject before compilation. The checks include keyword fields,
single and double trailing underscores, and fields named `candidate` or `other`.

## Failure cleanup and validation

Separate copies of the generated Java runtime inject exceptions at 679
conversion/allocation checkpoints per source path. The probe includes 64 partial
invalid inputs. Each started aggregate call clears its owned native output once;
all tracked arenas close. A valid call succeeds after each injected exception.
Original release JARs remain unchanged. These are Java conversion and arena
failure probes, not new native allocator interposition tests.

The conversion probe passes 984 checks and rejects 562 malformed values. It
checks every Unit/Bool marker byte, Unicode scalars, UTF-8 and UTF-16, bounded and
aligned native buffers, canonical integer limbs and signs, empty buffers,
negative zero, overflowing lengths, independent copies and 24 fixed Array levels.
It runs both without native libraries and against the instrumented installed
runtime, with zero native calls during malformed-value checks.

## Kotlin status

Kotlin's deep-array acceptance remains open. A direct call to the 24-level Java
array method stalls under Kotlin 2.2.0 and 2.4.20. A minimal Java identity method
reproduces the compiler problem without Lean, while an equivalent pure Kotlin
function compiles. Explicit result types, typed method references and tested
nullability annotations did not resolve it. Some annotation experiments exhausted
a 1 GiB compiler heap.

The Java receipt does not promote Kotlin's reviewed collection cells. The
24-level typed caller remains in the Kotlin fixture; it has not been replaced
with reflection, an erased public type or a shallower test. Existing Java/Kotlin
compound, List, alias and variant acceptance remains separately recorded.

## Coverage

The inventory advances 22 reviewed Java cells: six Array/record positions and
sixteen primitive record fields. Earlier ordinary-source, character,
platform-word and callable evidence retains its scope.

Copies remain acyclic, with a 32-level schema limit and separate 16 MiB managed
and native conversion accounting budgets. These budgets do not bound all JVM
allocations or Lean working memory. Kotlin deep-array acceptance, recursive
copied values, compound callable payloads and explicitly owned aggregates remain
unfinished work.
