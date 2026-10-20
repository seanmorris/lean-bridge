# checkedrecordvalueindices

Use the prepared crate through Cargo. Public functions borrow strings, slices, records and big integers and return owned Result values. Rust widths enforce fixed-width integer ranges. Nat and Int use re-exported num-bigint BigUint and BigInt; Unit is (). Arrays use Vec, text uses String, bytes use Vec<u8>, and records are generated structs.

The crate embeds its compiled native libraries. Runtime loading is automatic and compatible crates share one Lean runtime. Executables work after the Cargo source tree is removed. Native extraction uses private directories removed after loading; small process registry files are removed at normal exit. Native libraries remain loaded until process exit. Requires Rust 1.90+, Linux x86-64, glibc matching the packaged platform record and writable /tmp. Forked reuse is rejected; embedding beside a runtime loaded outside this Rust loader is not accepted.

Pure acyclic copied types, at most 32 levels deep. Synchronous primitive callbacks accept FnMut functions returning Result and receive owned values. Returned LeanClosure values provide typed call, close and is_closed methods and automatic Drop cleanup. They are neither Send, Sync nor Clone. Callback errors return unchanged; unwinding panics resume in Rust after the native call returns. Abort cannot be caught. Host callbacks are borrowed only for the call; retained callback invocations fail. Compound callables, resources and async remain unsupported. Rust and native conversions each use a 16 MiB accounting budget; Rust array bookkeeping counts at least eight bytes per element. These limits do not bound Lean working memory or every Rust allocation. Native outputs use RAII even on errors or unwinding. Process abort and allocation failure that aborts Rust cannot run destructors.

- produce_ab: lean:CheckedRecordValueIndices.produceAb
- produce_empty_sized: lean:CheckedRecordValueIndices.produceEmptySized
- produce_empty_string: lean:CheckedRecordValueIndices.produceEmptyString
- produce_false_bool: lean:CheckedRecordValueIndices.produceFalseBool
- produce_true_bool: lean:CheckedRecordValueIndices.produceTrueBool
- produce_unicode_string: lean:CheckedRecordValueIndices.produceUnicodeString
- produce_wide_nat: lean:CheckedRecordValueIndices.produceWideNat
- produce_zero_nat: lean:CheckedRecordValueIndices.produceZeroNat

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.

- checkedrecordvalueindices::produce_ab: result projects proof-backed record payload fields
- checkedrecordvalueindices::produce_empty_sized: result projects proof-backed record payload fields
- checkedrecordvalueindices::produce_empty_string: result projects proof-backed record payload fields
- checkedrecordvalueindices::produce_false_bool: result projects proof-backed record payload fields
- checkedrecordvalueindices::produce_true_bool: result projects proof-backed record payload fields
- checkedrecordvalueindices::produce_unicode_string: result projects proof-backed record payload fields
- checkedrecordvalueindices::produce_wide_nat: result projects proof-backed record payload fields
- checkedrecordvalueindices::produce_zero_nat: result projects proof-backed record payload fields

Lean Option uses Rust Option, Except E T uses Result<T, E>, and binary products use (A, B), preserving their nesting. None, Some(()) and Some(None) retain presence. Compound inputs are borrowed; returned contents are owned independent copies. An exported Except result has two Result layers: the outer Result reports bridge failures, while the inner Result preserves the Lean domain success or error. These copied types can nest with arrays and records; they cannot contain callbacks or resources.
