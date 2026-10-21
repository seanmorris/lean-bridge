# LeanZeropayloadcheckedrecords

Install the prepared Composer archive and require vendor/autoload.php. Call the generated LeanZeropayloadcheckedrecords functions. The package includes the compiled Lean libraries and loads its runtime automatically. Consumers do not compile Lean or configure a package-specific Zend extension.

Requires PHP 8.2+ (below 9), NTS CLI, Linux x86-64, the packaged glibc floor, and FFI enabled. This copied-value profile does not cover FPM, Apache, cli-server, ZTS or PHP-Wasm. Compatible packages share one process runtime; post-fork calls and an already loaded foreign Lean runtime are rejected. No per-package or shared runtime files are written during use.

Unit is null. Fixed-width integers use range-checked PHP int except UInt64, which uses BigInteger. Nat and Int also use Brick\Math\BigInteger::of with decimal text. Composer installs brick/math 1.0.0 automatically. Lean Bridge accepts integer objects up to 16384 decimal digits. String requires UTF-8, including NUL. ByteArray uses Bytes::fromString. Floats require PHP float; Float32 rounds to binary32 and preserves NaN classification, infinities and signed zero. Arrays are consecutive-key lists; records are final readonly value classes.

Input parameters deliberately use mixed with precise PHPDoc: generated checks reject coercion even if the caller omits strict_types. Records and lists have independent copied results. Copied types must be pure and acyclic, at most 32 levels deep. Validation, FFI scratch/output conversion, and native input/output copies each have a 16 MiB limit; PHP lists account for at least 32 bytes per element. These budgets do not bound the Lean algorithm's working memory. Native output owners are released in finally.

- LeanZeropayloadcheckedrecords\maybe_witness: lean:ZeroPayloadCheckedRecords.maybeWitness
- LeanZeropayloadcheckedrecords\produce_mark: lean:ZeroPayloadCheckedRecords.produceMark
- LeanZeropayloadcheckedrecords\produce_marker: lean:ZeroPayloadCheckedRecords.produceMarker
- LeanZeropayloadcheckedrecords\produce_token: lean:ZeroPayloadCheckedRecords.produceToken
- LeanZeropayloadcheckedrecords\produce_witness: lean:ZeroPayloadCheckedRecords.produceWitness
- LeanZeropayloadcheckedrecords\witnesses: lean:ZeroPayloadCheckedRecords.witnesses

## Options, results and products

Option uses null for None or new Some($value) for Some. Unit is null, so new Some(null) preserves a present Unit or an outer Some containing None, according to the declared type. Except uses new Ok($value) or new Err($error); both expose a readonly value property. Branch classes are final readonly classes in this component's namespace and require one payload. PHPDoc records the payload type; every call checks it recursively, including weak-mode callers. Domain errors return Err; bridge failures throw. Prod uses an exact two-element list, retaining nested binary products. These types compose with arrays and records. Returned values are independently copied. PHP === compares wrapper identity, while == follows PHP's property-comparison rules. Readonly wrappers do not make arbitrary constructor payloads deeply immutable; only values accepted by the declared copied type may cross a call. Compound callbacks, identity-bearing copied values and recursive copied schemas remain unsupported.

## Tagged variants

Concrete copied variants use abstract readonly family classes and final readonly constructor classes, such as SignalData extends Signal. Constructors take named or positional payload arguments with the original Lean field names. All payload checks apply in weak and strict PHP callers. Empty constructors and null Unit payloads stay distinct. Calls accept only exact generated constructor classes with their initialized fields; unknown family subclasses and uninitialized reflection-created objects reject. The native tag and union layout are private. Returned tags are checked before reading the active payload.

Accepted payloads include all nineteen primitives, copied arrays, Lists, records, options, results, products and other admitted variants. Returned payloads have independent copied storage. Readonly properties cannot be reassigned; arrays and objects still follow PHP's value and object semantics. PHP === compares object identity, while == compares properties under PHP rules. PHP does not check branch exhaustiveness. The 32-level schema limit and separate 16 MiB validation, PHP conversion and native-copy budgets remain in effect. Generic, indexed, proof-bearing, recursive, callable and identity-bearing payloads remain unsupported.

## Value comparison

Generated records, variant cases, Some/Ok/Err and Bytes expose equals($other) and hashCode(). equals compares nested copied contents without numeric-string or other weak coercion and keeps class/constructor identity distinct. NaNs compare equal and signed zeros differ. hashCode returns a matching 64-character hexadecimal value hash; hashes are not a proof of equality or a versioned serialization format. PHP == and === keep their built-in meanings. Comparisons and hashing have a 32-level nesting bound and a 16 MiB traversal budget. Cycles exceed that depth bound; uninitialized values, foreign objects, resources and non-list arrays reject. Do not mutate referenced payloads while using their hash as a lookup key.

## Bounded integers

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.

- LeanZeropayloadcheckedrecords\maybe_witness: result? projects proof-backed record payload fields
- LeanZeropayloadcheckedrecords\produce_mark: result.marked.witness projects proof-backed record payload fields
- LeanZeropayloadcheckedrecords\produce_token: result projects proof-backed record payload fields
- LeanZeropayloadcheckedrecords\produce_witness: result projects proof-backed record payload fields
- LeanZeropayloadcheckedrecords\witnesses: result[*] projects proof-backed record payload fields
