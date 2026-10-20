# LeanBridge::Checkedrecordvalueindices

Require "lean_bridge/checkedrecordvalueindices" and call LeanBridge::Checkedrecordvalueindices functions. Prepared gems include the native component and shared runtime, which load automatically. Requires MRI Ruby 3.3 on Linux x86-64. No Lean compiler or extension build is needed by consumers.

Unit is LeanBridge::Checkedrecordvalueindices::UNIT in every position. Integers remain exact; fixed-width values are range checked and Nat rejects negatives. Float32 rounds to binary32. Strings require valid UTF-8 or US-ASCII, including embedded NUL; ByteArray uses binary String. Arrays and generated keyword-initialized record values are copied at each call. Nil is rejected outside Option positions; implicit numeric coercions are rejected. Copied types must be pure, acyclic and at most 32 levels deep. Native input/output copies share a 16 MiB budget; input scratch is separately bounded. Native buffers are freed on failure. Compatible gems share one runtime for the process lifetime. Ractors and native-library unloading are not supported.

- LeanBridge::Checkedrecordvalueindices.ab_string_index: lean:CheckedRecordValueIndices.abStringIndex
- LeanBridge::Checkedrecordvalueindices.empty_sized_index: lean:CheckedRecordValueIndices.emptySizedIndex
- LeanBridge::Checkedrecordvalueindices.empty_string_index: lean:CheckedRecordValueIndices.emptyStringIndex
- LeanBridge::Checkedrecordvalueindices.false_bool_index: lean:CheckedRecordValueIndices.falseBoolIndex
- LeanBridge::Checkedrecordvalueindices.produce_ab: lean:CheckedRecordValueIndices.produceAb
- LeanBridge::Checkedrecordvalueindices.produce_empty_sized: lean:CheckedRecordValueIndices.produceEmptySized
- LeanBridge::Checkedrecordvalueindices.produce_empty_string: lean:CheckedRecordValueIndices.produceEmptyString
- LeanBridge::Checkedrecordvalueindices.produce_false_bool: lean:CheckedRecordValueIndices.produceFalseBool
- LeanBridge::Checkedrecordvalueindices.produce_true_bool: lean:CheckedRecordValueIndices.produceTrueBool
- LeanBridge::Checkedrecordvalueindices.produce_unicode_string: lean:CheckedRecordValueIndices.produceUnicodeString
- LeanBridge::Checkedrecordvalueindices.produce_wide_nat: lean:CheckedRecordValueIndices.produceWideNat
- LeanBridge::Checkedrecordvalueindices.produce_zero_nat: lean:CheckedRecordValueIndices.produceZeroNat
- LeanBridge::Checkedrecordvalueindices.true_bool_index: lean:CheckedRecordValueIndices.trueBoolIndex
- LeanBridge::Checkedrecordvalueindices.unicode_string_index: lean:CheckedRecordValueIndices.unicodeStringIndex
- LeanBridge::Checkedrecordvalueindices.wide_nat_index: lean:CheckedRecordValueIndices.wideNatIndex
- LeanBridge::Checkedrecordvalueindices.zero_nat_index: lean:CheckedRecordValueIndices.zeroNatIndex

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.

- LeanBridge::Checkedrecordvalueindices.ab_string_index: arg0 checked by CheckedRecordValueIndices.mkAb
- LeanBridge::Checkedrecordvalueindices.empty_sized_index: arg0 checked by CheckedRecordValueIndices.mkEmptySized
- LeanBridge::Checkedrecordvalueindices.empty_string_index: arg0 checked by CheckedRecordValueIndices.mkEmptyToken
- LeanBridge::Checkedrecordvalueindices.false_bool_index: arg0 checked by CheckedRecordValueIndices.mkOff
- LeanBridge::Checkedrecordvalueindices.produce_ab: result projects proof-backed record payload fields
- LeanBridge::Checkedrecordvalueindices.produce_empty_sized: result projects proof-backed record payload fields
- LeanBridge::Checkedrecordvalueindices.produce_empty_string: result projects proof-backed record payload fields
- LeanBridge::Checkedrecordvalueindices.produce_false_bool: result projects proof-backed record payload fields
- LeanBridge::Checkedrecordvalueindices.produce_true_bool: result projects proof-backed record payload fields
- LeanBridge::Checkedrecordvalueindices.produce_unicode_string: result projects proof-backed record payload fields
- LeanBridge::Checkedrecordvalueindices.produce_wide_nat: result projects proof-backed record payload fields
- LeanBridge::Checkedrecordvalueindices.produce_zero_nat: result projects proof-backed record payload fields
- LeanBridge::Checkedrecordvalueindices.true_bool_index: arg0 checked by CheckedRecordValueIndices.mkOn
- LeanBridge::Checkedrecordvalueindices.unicode_string_index: arg0 checked by CheckedRecordValueIndices.mkUnicodeToken
- LeanBridge::Checkedrecordvalueindices.wide_nat_index: arg0 checked by CheckedRecordValueIndices.mkWideToken
- LeanBridge::Checkedrecordvalueindices.zero_nat_index: arg0 checked by CheckedRecordValueIndices.mkZeroToken

Conversions use builtin exact-type checks and bounded snapshots of String bytes and Array slots. Overridden instance methods cannot change the native allocation size, copy length or element selection. Generated record and constructor fields are read from stored values, not overridden accessors. Inputs must not be mutated concurrently if a consistent snapshot of the entire nested value is required.

Generated records and variant constructors support field-by-field ==, eql?, hash and deconstruct_keys. Equality requires the same Ruby class and follows the contained values' Ruby semantics, including floating-point behavior. Objects are frozen; nested arrays and strings remain mutable. Do not mutate a nested payload while using its containing value as a Hash key.
