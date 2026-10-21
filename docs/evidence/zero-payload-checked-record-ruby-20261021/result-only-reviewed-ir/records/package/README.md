# LeanBridge::Zeropayloadcheckedrecords

Require "lean_bridge/zeropayloadcheckedrecords" and call LeanBridge::Zeropayloadcheckedrecords functions. Prepared gems include the native component and shared runtime, which load automatically. Requires MRI Ruby 3.3 on Linux x86-64. No Lean compiler or extension build is needed by consumers.

Unit is LeanBridge::Zeropayloadcheckedrecords::UNIT in every position. Integers remain exact; fixed-width values are range checked and Nat rejects negatives. Float32 rounds to binary32. Strings require valid UTF-8 or US-ASCII, including embedded NUL; ByteArray uses binary String. Arrays and generated keyword-initialized record values are copied at each call. Nil is rejected outside Option positions; implicit numeric coercions are rejected. Copied types must be pure, acyclic and at most 32 levels deep. Native input/output copies share a 16 MiB budget; input scratch is separately bounded. Native buffers are freed on failure. Compatible gems share one runtime for the process lifetime. Ractors and native-library unloading are not supported.

- LeanBridge::Zeropayloadcheckedrecords.maybe_witness: lean:ZeroPayloadCheckedRecords.maybeWitness
- LeanBridge::Zeropayloadcheckedrecords.produce_mark: lean:ZeroPayloadCheckedRecords.produceMark
- LeanBridge::Zeropayloadcheckedrecords.produce_marker: lean:ZeroPayloadCheckedRecords.produceMarker
- LeanBridge::Zeropayloadcheckedrecords.produce_token: lean:ZeroPayloadCheckedRecords.produceToken
- LeanBridge::Zeropayloadcheckedrecords.produce_witness: lean:ZeroPayloadCheckedRecords.produceWitness
- LeanBridge::Zeropayloadcheckedrecords.witnesses: lean:ZeroPayloadCheckedRecords.witnesses

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.

- LeanBridge::Zeropayloadcheckedrecords.maybe_witness: result? projects proof-backed record payload fields
- LeanBridge::Zeropayloadcheckedrecords.produce_mark: result.marked.witness projects proof-backed record payload fields
- LeanBridge::Zeropayloadcheckedrecords.produce_token: result projects proof-backed record payload fields
- LeanBridge::Zeropayloadcheckedrecords.produce_witness: result projects proof-backed record payload fields
- LeanBridge::Zeropayloadcheckedrecords.witnesses: result[*] projects proof-backed record payload fields

Options use nil or Some.new(value). Some.new(nil) is an outer Some containing an inner None; Some.new(UNIT) retains presence for Unit. Nil is admitted only at Option positions.

Branch wrappers are frozen Data classes with value equality and pattern matching. Wrapper fields are frozen, but nested strings and arrays remain mutable.

Payloads are checked against the concrete Lean type when called; no implicit coercion is used. Returned values own independent storage.

Conversions use builtin exact-type checks and bounded snapshots of String bytes and Array slots. Overridden instance methods cannot change the native allocation size, copy length or element selection. Generated record and constructor fields are read from stored values, not overridden accessors. Inputs must not be mutated concurrently if a consistent snapshot of the entire nested value is required.

Generated records and variant constructors support field-by-field ==, eql?, hash and deconstruct_keys. Equality requires the same Ruby class and follows the contained values' Ruby semantics, including floating-point behavior. Objects are frozen; nested arrays and strings remain mutable. Do not mutate a nested payload while using its containing value as a Hash key.

Concrete copied Lean variants use named constructor classes such as Signal::Data.new(count: 42, label: "ready"). Constructor payloads use required keyword arguments and read-only accessors; deconstruct_keys supports Ruby pattern matching. Constructor objects are frozen, but contained strings and arrays remain mutable and are copied at the boundary. The abstract family cannot be constructed with new. Unknown subclasses, nil cases, wrong field values and invalid native tags reject. Only the active payload is converted. Empty constructors and UNIT payloads remain distinct. Ruby does not check match exhaustiveness. Generic, indexed, recursive, proof-bearing, callable and identity-bearing payloads remain unsupported.
