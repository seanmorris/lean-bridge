# zeropayloadcheckedrecords

Use the prepared crate through Cargo. Public functions borrow strings, slices, records and big integers and return owned Result values. Rust widths enforce fixed-width integer ranges. Nat and Int use re-exported num-bigint BigUint and BigInt; Unit is (). Arrays use Vec, text uses String, bytes use Vec<u8>, and records are generated structs.

The crate embeds its compiled native libraries. Runtime loading is automatic and compatible crates share one Lean runtime. Executables work after the Cargo source tree is removed. Native extraction uses private directories removed after loading; small process registry files are removed at normal exit. Native libraries remain loaded until process exit. Requires Rust 1.90+, Linux x86-64, glibc matching the packaged platform record and writable /tmp. Forked reuse is rejected; embedding beside a runtime loaded outside this Rust loader is not accepted.

Pure acyclic copied types, at most 32 levels deep. Synchronous primitive callbacks accept FnMut functions returning Result and receive owned values. Returned LeanClosure values provide typed call, close and is_closed methods and automatic Drop cleanup. They are neither Send, Sync nor Clone. Callback errors return unchanged; unwinding panics resume in Rust after the native call returns. Abort cannot be caught. Host callbacks are borrowed only for the call; retained callback invocations fail. Compound callables, resources and async remain unsupported. Rust and native conversions each use a 16 MiB accounting budget; Rust array bookkeeping counts at least eight bytes per element. These limits do not bound Lean working memory or every Rust allocation. Native outputs use RAII even on errors or unwinding. Process abort and allocation failure that aborts Rust cannot run destructors.

- absent_count: lean:ZeroPayloadCheckedRecords.absentCount
- mark_count: lean:ZeroPayloadCheckedRecords.markCount
- marker_count: lean:ZeroPayloadCheckedRecords.markerCount
- maybe_witness: lean:ZeroPayloadCheckedRecords.maybeWitness
- produce_mark: lean:ZeroPayloadCheckedRecords.produceMark
- produce_marker: lean:ZeroPayloadCheckedRecords.produceMarker
- produce_token: lean:ZeroPayloadCheckedRecords.produceToken
- produce_witness: lean:ZeroPayloadCheckedRecords.produceWitness
- token_tag: lean:ZeroPayloadCheckedRecords.tokenTag
- witness_count: lean:ZeroPayloadCheckedRecords.witnessCount
- witnesses: lean:ZeroPayloadCheckedRecords.witnesses

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.

- zeropayloadcheckedrecords::absent_count: value0 checked by ZeroPayloadCheckedRecords.mkAbsent
- zeropayloadcheckedrecords::mark_count: value0.marked.witness checked by ZeroPayloadCheckedRecords.mkWitness
- zeropayloadcheckedrecords::maybe_witness: result? projects proof-backed record payload fields
- zeropayloadcheckedrecords::produce_mark: result.marked.witness projects proof-backed record payload fields
- zeropayloadcheckedrecords::produce_token: result projects proof-backed record payload fields
- zeropayloadcheckedrecords::produce_witness: result projects proof-backed record payload fields
- zeropayloadcheckedrecords::token_tag: value0 checked by ZeroPayloadCheckedRecords.mkToken
- zeropayloadcheckedrecords::witness_count: value0 checked by ZeroPayloadCheckedRecords.mkWitness
- zeropayloadcheckedrecords::witnesses: result[*] projects proof-backed record payload fields

Lean Option uses Rust Option, Except E T uses Result<T, E>, and binary products use (A, B), preserving their nesting. None, Some(()) and Some(None) retain presence. Compound inputs are borrowed; returned contents are owned independent copies. An exported Except result has two Result layers: the outer Result reports bridge failures, while the inner Result preserves the Lean domain success or error. These copied types can nest with arrays and records; they cannot contain callbacks or resources.

Concrete copied Lean variants export named Rust enums. Empty cases are unit variants; payload cases have named fields. Construct and match these cases without numeric tags or unsafe code. Constructor names use PascalCase and fields use snake_case, with reserved words gaining a trailing underscore. Inputs borrow the enum and outputs own independent copied contents. Only the active payload is converted. Variants can contain supported copied records, containers and other non-recursive variants. Conversion errors and unwinding release temporary storage and native outputs through RAII. Recursive, callable and identity-bearing payloads remain unsupported.
