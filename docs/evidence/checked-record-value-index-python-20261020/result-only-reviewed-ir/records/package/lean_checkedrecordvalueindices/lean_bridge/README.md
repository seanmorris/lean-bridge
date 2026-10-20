# lean_checkedrecordvalueindices

Install the prepared platform wheel and import lean_checkedrecordvalueindices. Native Lean libraries and runtime loading are included. No Lean compiler or extension build is needed by consumers. Python 3.11+, Linux x86-64 with glibc matching the wheel tag.

Unit is None in every position. Fixed-width integers are range checked; Nat and Int use exact Python integers. Boolean and numeric coercions are rejected. Float32 rounds a Python float to binary32, preserving NaN classification, infinities and signed zero. String is strict Unicode str, including NUL; ByteArray is bytes. Arrays accept tuples or lists and return tuples. Records are frozen dataclasses; nested copied values remain independent.

Types must be pure, acyclic and at most 32 levels deep. Python conversions and native input/output copies each have a 16 MiB budget. Python array conversions count at least eight bytes per element, and strings account for encoding/decoding. These limits do not bound the Lean algorithm's working memory. Native outputs are cleared in finally even if conversion raises. Calls can run on separate threads with independent scratch; do not mutate an input during its conversion. Compatible packages share a synchronized loader and native runtime. Free-threading and post-fork calls are rejected; subinterpreters and other Python implementations have not been accepted.

- lean_checkedrecordvalueindices.produce_ab: lean:CheckedRecordValueIndices.produceAb
- lean_checkedrecordvalueindices.produce_empty_sized: lean:CheckedRecordValueIndices.produceEmptySized
- lean_checkedrecordvalueindices.produce_empty_string: lean:CheckedRecordValueIndices.produceEmptyString
- lean_checkedrecordvalueindices.produce_false_bool: lean:CheckedRecordValueIndices.produceFalseBool
- lean_checkedrecordvalueindices.produce_true_bool: lean:CheckedRecordValueIndices.produceTrueBool
- lean_checkedrecordvalueindices.produce_unicode_string: lean:CheckedRecordValueIndices.produceUnicodeString
- lean_checkedrecordvalueindices.produce_wide_nat: lean:CheckedRecordValueIndices.produceWideNat
- lean_checkedrecordvalueindices.produce_zero_nat: lean:CheckedRecordValueIndices.produceZeroNat

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.
- lean_checkedrecordvalueindices.produce_ab: result projects proof-backed record payload fields
- lean_checkedrecordvalueindices.produce_empty_sized: result projects proof-backed record payload fields
- lean_checkedrecordvalueindices.produce_empty_string: result projects proof-backed record payload fields
- lean_checkedrecordvalueindices.produce_false_bool: result projects proof-backed record payload fields
- lean_checkedrecordvalueindices.produce_true_bool: result projects proof-backed record payload fields
- lean_checkedrecordvalueindices.produce_unicode_string: result projects proof-backed record payload fields
- lean_checkedrecordvalueindices.produce_wide_nat: result projects proof-backed record payload fields
- lean_checkedrecordvalueindices.produce_zero_nat: result projects proof-backed record payload fields

Option[T] is None or Some(value). Some(None) preserves a present Unit or absent inner Option; nested options retain every layer. Result[T, E] is Ok(value) or Err(value), including when both payload types match. These generated wrappers are frozen dataclasses with a value field. Domain errors return Err, not exceptions. Binary products use exact two-element tuples and retain their nesting. Copies can contain these types, arrays and records; resources and callbacks cannot be hidden in them.

Synchronous primitive host callbacks accept typed Python callables. Returned Lean closures are callable LeanClosure values: use a with block or close(), and invoke them on their creating thread. close() is idempotent and defers disposal during active reentry. Garbage collection is a fallback. Callback exceptions return as the original Python exception after native cleanup; later invocations in that call are suppressed. Callback values use the same checked primitive conversions and share the call's copy budgets. Host callbacks are borrowed only for the exporting call. Async or retained host callbacks, callable containers, resources and other effects are not enabled by this adapter.
