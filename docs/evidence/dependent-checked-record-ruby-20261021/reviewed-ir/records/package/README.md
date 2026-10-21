# LeanBridge::Dependentrecords

Require "lean_bridge/dependentrecords" and call LeanBridge::Dependentrecords functions. Prepared gems include the native component and shared runtime, which load automatically. Requires MRI Ruby 3.3 on Linux x86-64. No Lean compiler or extension build is needed by consumers.

Unit is LeanBridge::Dependentrecords::UNIT in every position. Integers remain exact; fixed-width values are range checked and Nat rejects negatives. Float32 rounds to binary32. Strings require valid UTF-8 or US-ASCII, including embedded NUL; ByteArray uses binary String. Arrays and generated keyword-initialized record values are copied at each call. Nil is rejected outside Option positions; implicit numeric coercions are rejected. Copied types must be pure, acyclic and at most 32 levels deep. Native input/output copies share a 16 MiB budget; input scratch is separately bounded. Native buffers are freed on failure. Compatible gems share one runtime for the process lifetime. Ractors and native-library unloading are not supported.

- LeanBridge::Dependentrecords.dependent_result: lean:DependentRecords.dependentResult
- LeanBridge::Dependentrecords.dependent_roundtrip: lean:DependentRecords.dependentRoundtrip
- LeanBridge::Dependentrecords.dependent_total: lean:DependentRecords.dependentTotal

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. A top-level closed generic checked record retains its compiler-authenticated type and value indices and may select Subtype constructors for payload fields. Generic checked records nested inside another value, Fin-refined fields inside a generic checked record, recursive, owned and callback checked-record positions remain unsupported.

- LeanBridge::Dependentrecords.dependent_result: result projects proof-backed record payload fields; result.below < result.bound
- LeanBridge::Dependentrecords.dependent_roundtrip: arg0 checked by DependentRecords.mkDependent; arg0.below < arg0.bound; result projects proof-backed record payload fields; result.below < result.bound
- LeanBridge::Dependentrecords.dependent_total: arg0 checked by DependentRecords.mkDependent; arg0.below < arg0.bound

Conversions use builtin exact-type checks and bounded snapshots of String bytes and Array slots. Overridden instance methods cannot change the native allocation size, copy length or element selection. Generated record and constructor fields are read from stored values, not overridden accessors. Inputs must not be mutated concurrently if a consistent snapshot of the entire nested value is required.

Generated records and variant constructors support field-by-field ==, eql?, hash and deconstruct_keys. Equality requires the same Ruby class and follows the contained values' Ruby semantics, including floating-point behavior. Objects are frozen; nested arrays and strings remain mutable. Do not mutate a nested payload while using its containing value as a Hash key.
